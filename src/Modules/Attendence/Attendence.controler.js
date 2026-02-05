
import moment from "moment-timezone";
import fs from "fs";
import path from "path";
import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import Staff from "../Staff/Staff.model.js";
import Attendance from "./Attendence.model.js";
import LeaveApplication from "../Leave/LeaveApplication.model.js";
import WeeklyHoliday from "../Leave/WeeklyHoliday.model.js";
import Report from "../Reports/Reports.model.js";
import mongoose from "mongoose";

const parseDateStrict = (date) => {
  const d = moment(date, ["YYYY-MM-DD", "YYYY-M-DD"], true);
  if (!d.isValid()) {
    throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD");
  }
  return d.startOf("day").toDate();
};

const calculateWorkedSeconds = (sessions = []) => {
  let seconds = 0;
  const now = Date.now();

  sessions.forEach((s) => {
    if (s.start_time) {
      const end = s.end_time ? s.end_time.getTime() : now;
      seconds += (end - s.start_time.getTime()) / 1000;
    }
  });

  return Math.floor(seconds);
};

const calculateWorkHoursFromSessions = (sessions = []) => {
  let seconds = 0;
  sessions.forEach((s) => {
    if (s.start_time && s.end_time) {
      seconds += (s.end_time - s.start_time) / 1000;
    }
  });
  return Number((seconds / 3600).toFixed(2));
};

const IST_OFFSET = 5.5 * 60 * 60 * 1000;


const normalizeAttendanceDateFromIST = (dateInput = new Date()) => {
  let istBase;

  if (typeof dateInput === "string") {
    // HR flow → date already IST calendar date
    istBase = new Date(`${dateInput}T00:00:00+05:30`);
  } else {
    // Staff flow → actual timestamp
    istBase = new Date(dateInput);
  }

  // Extract IST date parts explicitly (NO math juggling)
  const istYear = istBase.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
  });
  const istMonth = istBase.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "2-digit",
  });
  const istDay = istBase.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
  });

  // Build IST midnight safely
  const istMidnight = new Date(
    `${istYear}-${istMonth}-${istDay}T00:00:00+05:30`
  );

  // Convert IST midnight → UTC for DB
  return new Date(istMidnight.getTime() - IST_OFFSET);
};

export const checkIn = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  // 🔥 IST-based attendance date
  const attendanceDate = normalizeAttendanceDateFromIST();

  const attendance = await Attendance.findOneAndUpdate(
    { staff: staffId, date: attendanceDate },
    {
      $setOnInsert: {
        staff: staffId,
        date: attendanceDate,
        status: "Present",
        check_in: new Date(), // actual time
      },
    },
    { upsert: true, new: true }
  );

  res.status(201).json(new ApiResponse(201, attendance, "Check-in successful"));
});


export const checkOut = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  // 🔥 latest open attendance (date safe)
  const attendance = await Attendance.findOne({
    staff: staffId,
    check_out: null,
  }).sort({ date: -1 });

  if (!attendance) throw new ApiError(404, "No active attendance found");

  // 🛑 CLOSE ACTIVE BREAK (if any)
  const activeBreak = attendance.breaks
    ?.slice()
    .reverse()
    .find((b) => !b.end_time);

  if (activeBreak) {
    activeBreak.end_time = new Date();
    activeBreak.duration = Math.ceil(
      (activeBreak.end_time - activeBreak.start_time) / (1000 * 60)
    );
  }

  // 🛑 CLOSE ACTIVE WORK (if any)
  const activeWork = attendance.work_sessions
    ?.slice()
    .reverse()
    .find((w) => !w.end_time);

  if (activeWork) {
    activeWork.end_time = new Date();
  }

  // 🟢 FINAL PUNCH OUT
  attendance.check_out = new Date();
  attendance.working_hours = calculateWorkHoursFromSessions(
    attendance.work_sessions
  );

  await attendance.save();

  res.json(new ApiResponse(200, attendance, "Check-out successful"));
});

export const getMyTodayAttendance = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  const startOfDay = moment.tz("Asia/Kolkata").startOf("day").toDate();
  const endOfDay = moment.tz("Asia/Kolkata").endOf("day").toDate();

  const attendance = await Attendance.findOne({
    staff: staffId,
    check_in: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });

  let isWorking = false;
  let isOnBreak = false;
  let currentStatus = "IDLE";

  if (attendance) {
    const activeBreak = attendance.breaks?.find((b) => !b.end_time);
    const activeWork = attendance.work_sessions?.find((w) => !w.end_time);

    if (attendance.check_out) {
      currentStatus = "CHECKED_OUT";
    } else if (activeBreak) {
      isOnBreak = true;
      currentStatus = "ON_BREAK";
    } else if (activeWork) {
      isWorking = true;
      currentStatus = "WORKING";
    } else {
      currentStatus = "CHECKED_IN";
    }
  }

  res.json(
    new ApiResponse(
      200,
      {
        attendance: attendance || null,
        punchedIn: !!attendance,
        punchedOut: !!attendance?.check_out,
        isWorking,
        isOnBreak,
        currentStatus,
      },
      "Punch status"
    )
  );
});
const getWeekOffDatesInMonth = (start, end, weekOffDays) => {
  const dates = [];
  const current = start.clone();

  while (current.isSameOrBefore(end, "day")) {
    const dayName = current.format("dddd"); // Sunday, Monday...
    if (weekOffDays.includes(dayName)) {
      dates.push(current.format("YYYY-MM-DD"));
    }
    current.add(1, "day");
  }

  return dates;
};
const getAllDatesInRange = (start, end) => {
  const dates = [];
  const d = start.clone();

  while (d.isSameOrBefore(end, "day")) {
    dates.push(d.format("YYYY-MM-DD"));
    d.add(1, "day");
  }

  return dates;
};
export const getStaffMonthlySummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;

  const current = moment();
  const monthNum = month ? Number(month) : current.month() + 1;
  const yearNum = year ? Number(year) : current.year();

  const paddedMonth = String(monthNum).padStart(2, "0");

  const start = moment(`${yearNum}-${paddedMonth}-01`).startOf("month");
  const isCurrentMonth = start.isSame(current, "month");

  const end = isCurrentMonth
    ? current.clone().endOf("day")
    : start.clone().endOf("month");

  const allMonthDates = getAllDatesInRange(start, end);

  const staffList = await Staff.find({});
  const attendanceRecords = await Attendance.find({
    date: { $gte: start.toDate(), $lte: end.toDate() },
  });

  const approvedLeaves = await LeaveApplication.find({
    status: "Approved",
    startDate: { $lte: end.toDate() },
    endDate: { $gte: start.toDate() },
  });

  const weeklyHolidays = await WeeklyHoliday.find({});
  const weekOffDays = weeklyHolidays.map((w) => w.day);

  const rawWeekOffDates = getWeekOffDatesInMonth(start, end, weekOffDays);

  const validWeekOffDates = isCurrentMonth
    ? rawWeekOffDates.filter((d) => moment(d).isSameOrBefore(current, "day"))
    : rawWeekOffDates;

  const summary = staffList.map((staff) => {
    const staffAttendance = attendanceRecords.filter(
      (a) => a.staff.toString() === staff._id.toString(),
    );

    const staffLeaves = approvedLeaves.filter(
      (l) => l.staff.toString() === staff._id.toString(),
    );

    const attendanceDates = staffAttendance.map((a) =>
      moment(a.date).format("YYYY-MM-DD"),
    );

    const leaveDates = [];
    staffLeaves.forEach((l) => {
      let d = moment.max(moment(l.startDate), start);
      const leaveEnd = moment.min(moment(l.endDate), end);

      while (d.isSameOrBefore(leaveEnd, "day")) {
        leaveDates.push(d.format("YYYY-MM-DD"));
        d.add(1, "day");
      }
    });

    const weekOff = validWeekOffDates.filter(
      (d) => !attendanceDates.includes(d) && !leaveDates.includes(d),
    ).length;

    const present = staffAttendance.filter(
      (a) => a.status === "Present",
    ).length;

    const absent = staffAttendance.filter((a) => a.status === "Absent").length;

    const halfDay = staffAttendance.filter(
      (a) => a.status === "Half-Day",
    ).length;

    const paidLeave = leaveDates.length;

    const fineCount = staffAttendance.filter(
      (a) => a.status === "Fine" || a.fine > 0,
    ).length;

    const fineAmount = staffAttendance.reduce(
      (sum, a) => sum + (a.fine || 0),
      0,
    );

    const unmarked = allMonthDates.filter(
      (d) =>
        !attendanceDates.includes(d) &&
        !leaveDates.includes(d) &&
        !validWeekOffDates.includes(d),
    ).length;

    const totalDays =
      present + absent + halfDay + paidLeave + weekOff + unmarked;

    return {
      staffName: staff.staff_name,
      present,
      halfDay,
      absent,
      paidLeave,
      weekOff,
      unmarked,
      totalDays,
      fineCount,
      fineAmount,
      payableDays: present + paidLeave + halfDay * 0.5,
    };
  });

  res.json(
    new ApiResponse(
      200,
      { month: monthNum, year: yearNum, summary },
      "Monthly summary fetched successfully",
    ),
  );
});


const sumWorkSessionsHours = (sessions = []) => {
  let totalMs = 0;

  for (const s of sessions) {
    if (s?.start_time && s?.end_time) {
      const diff = s.end_time.getTime() - s.start_time.getTime();
      if (diff > 0) totalMs += diff;
    }
  }

  return Number((totalMs / 36e5).toFixed(2)); // hours
};

export const getStaffAttendanceByDate = asyncHandler(async (req, res) => {
  const targetDate = req.query.date
    ? moment.tz(req.query.date, ["YYYY-MM-DD", "YYYY-M-DD"], "Asia/Kolkata")
    : moment.tz("Asia/Kolkata");

  if (!targetDate.isValid()) {
    throw new ApiError(400, "Invalid date format (use YYYY-MM-DD)");
  }

  const startOfDay = targetDate.clone().startOf("day").toDate();
  const endOfDay = targetDate.clone().endOf("day").toDate();

  
  const staffList = await Staff.find({
    joining_date: { $lte: endOfDay },
  });

  // 🔹 Attendance records of that IST day
  const attendanceRecords = await Attendance.find({
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });

  const attendance = staffList.map((staff) => {
    const record = attendanceRecords.find(
      (a) => a.staff.toString() === staff._id.toString()
    );
const workingHours = record
  ? (record.manual_working_hours ?? sumWorkSessionsHours(record.work_sessions))
  : 0;
    return {
      staff_name: staff.staff_name,
      staff_id: staff.staff_id,
      staffId: staff._id,

      status: record?.status || "Absent",
      fine: record?.fine || 0,

      working_hours: workingHours,

      is_late: record?.is_late || false,
      late_by_minutes: record?.late_by_minutes || 0,

      check_in: record?.check_in || null,
      check_out: record?.check_out || null,
    };
  });

  res.json(
    new ApiResponse(
      200,
      {
        date: targetDate.format("YYYY-MM-DD"),
        attendance,
      },
      "Attendance fetched"
    )
  );
});

export const attendanceGlobalSync = asyncHandler(async (req, res) => {
  const { lastUpdatedAt } = req.query;

  const latest = await Attendance.findOne({})
    .sort({ updatedAt: -1 })
    .select("updatedAt staff date");

  if (!latest) {
    return res.json({ changed: false });
  }

  if (
    lastUpdatedAt &&
    moment(latest.updatedAt).isSameOrBefore(moment(lastUpdatedAt))
  ) {
    return res.json({ changed: false });
  }

  return res.json({
    changed: true,
    updatedAt: latest.updatedAt,
    staff: latest.staff,
    date: latest.date,
  });
});
export const generateDailyAttendanceReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, status } = req.body;
  if (!startDate || !endDate)
    throw new ApiError(400, "Start and end date required");

  const start = parseDateStrict(startDate);
  const end = moment(parseDateStrict(endDate)).endOf("day").toDate();

  const query = { date: { $gte: start, $lte: end } };

  if (status && status !== "All") {
    query.status = status;
  }

  const records = await Attendance.find(query).populate(
    "staff",
    "email staff_name",
  );

  let csv = "Staff Name,Email,Date,Status,Check-In,Check-Out,Working Hours\n";

  records.forEach((r) => {
    csv += `"${r.staff?.staff_name || ""}",`;
    csv += `"${r.staff?.email || ""}",`;
    csv += `"${moment(r.date).format("YYYY-MM-DD")}",`;
    csv += `"${r.status}",`;
    csv += `"${r.check_in ? moment(r.check_in).format("HH:mm") : ""}",`;
    csv += `"${r.check_out ? moment(r.check_out).format("HH:mm") : ""}",`;
    csv += `"${r.working_hours || 0}"\n`;
  });

  const dir = path.join(process.cwd(), "public", "temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `Attendance_${startDate}_to_${endDate}.csv`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, csv);

  const report = await Report.create({
    filename,
    filepath,
    expirationDate: new Date(Date.now() + 7 * 86400000),
    createdBy: req.user.id,
    createdByModel: req.user.role === "admin" ? "Admin" : "Staff",
  });

  res.status(201).json({
    report,
    downloadUrl: `/temp/${filename}`,
  });
});

export const generateStaffWiseAttendanceReport = asyncHandler(
  async (req, res) => {
    const { startDate, endDate, staffId, status } = req.body;

    if (!startDate || !endDate) {
      throw new ApiError(400, "Start and end date required");
    }

    const start = parseDateStrict(startDate);
    const end = moment(parseDateStrict(endDate)).endOf("day").toDate();

    const query = {
      date: { $gte: start, $lte: end },
    };

    if (staffId && staffId !== "All") {
      query.staff = staffId;
    }

    if (status && status !== "All") {
      query.status = status;
    }

    const records = await Attendance.find(query).populate(
      "staff",
      "email staff_name",
    );

    let csv = "Staff Name,Email,Date,Status,Check-In,Check-Out,Working Hours\n";

    records.forEach((r) => {
      csv += `"${r.staff?.staff_name || ""}",`;
      csv += `"${r.staff?.email || ""}",`;
      csv += `"${moment(r.date).format("YYYY-MM-DD")}",`;
      csv += `"${r.status}",`;
      csv += `"${r.check_in ? moment(r.check_in).format("HH:mm") : ""}",`;
      csv += `"${r.check_out ? moment(r.check_out).format("HH:mm") : ""}",`;
      csv += `"${r.working_hours || 0}"\n`;
    });

    const dir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `Attendance_${staffId || "All"}_${startDate}_to_${endDate}.csv`;
    const filepath = path.join(dir, filename);

    fs.writeFileSync(filepath, csv);

    const report = await Report.create({
      filename,
      filepath,
      expirationDate: new Date(Date.now() + 7 * 86400000),
      createdBy: req.user.id,
      createdByModel: req.user.role === "admin" ? "Admin" : "Staff",
    });

    res.status(201).json({
      report,
      downloadUrl: `/temp/${filename}`,
    });
  },
);
export const fullBackup = asyncHandler(async (req, res) => {
  let backupConn;
  const startTime = Date.now();

  const DELETE_KEY = "HRMS_BACKUP";
  const allowDelete = req.body?.deleteKey === DELETE_KEY;

  try {
    backupConn = await mongoose
      .createConnection(
        "mongodb+srv://hrmssystem:hrms123456@cluster0.7snkech.mongodb.net/hrmsbackup?appName=Cluster0",
      )
      .asPromise();

    const mainDb = mongoose.connection.db;
    const backupDb = backupConn.db;

    const collections = await mainDb.collections();
    for (const collection of collections) {
      const name = collection.collectionName;
      if (name.startsWith("system.")) continue;

      const colStart = Date.now();

      const data = await mainDb.collection(name).find({}).toArray();
      if (!data.length) {
        continue;
      }

      const historyCollection = `${name}__history`;

      await backupDb.collection(historyCollection).insertMany(
        data.map(({ _id, ...rest }) => ({
          ...rest,
          original_id: _id,
          backup_at: new Date(),
        })),
        { ordered: false },
      );

      await backupDb.collection(name).deleteMany({});
      await backupDb.collection(name).insertMany(data);

      if (allowDelete) {
        await mainDb.collection(name).deleteMany({});
      }
    }
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          durationMs: Date.now() - startTime,
          deletedFromMainDb: allowDelete,
        },
        "Backup completed successfully",
      ),
    );
  } finally {
    if (backupConn) {
      await backupConn.close();
    }
  }
});



export const getDailyReports = async (req, res) => {
  try {
    const { date } = req.query;
    const query = {};

    if (date) {
      const d = moment(date, "YYYY-MM-DD", true);
      if (!d.isValid()) {
        return res
          .status(400)
          .json({ message: "Invalid date format YYYY-MM-DD" });
      }

      query.createdAt = {
        $gte: d.clone().startOf("day").toDate(),
        $lte: d.clone().endOf("day").toDate(),
      };
    }

    const reports = await Report.find(query).sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching reports" });
  }
};

export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Delete file from disk
    if (fs.existsSync(report.filepath)) {
      fs.unlinkSync(report.filepath);
    }

    // Delete report document
    await Report.findByIdAndDelete(id);

    res.status(200).json({ message: "Report deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting report" });
  }
};
