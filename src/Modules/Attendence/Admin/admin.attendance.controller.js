import moment from "moment";
import WeeklyHoliday from "../../Leave/WeeklyHoliday.model.js";
import Attendance from "../Attendence.model.js";
import Staff from "../../Staff/Staff.model.js";
import { calculateWorkHoursFromSessions } from "../Utils/work.utils.js";
import { asyncHandler } from "../../../Utils/asyncHandler.js";
import { ApiResponse } from "../../../Utils/ApiResponse.js";
import { ApiError } from "../../../Utils/ApiError.js";
import { calculateLate } from "../Utils/late.utils.js";
import { getISTStartDateUTC,  getUTCFromISTDateTime } from "../../../Utils/date.js";
import { istDayStartUTC, toIST } from "../../../Utils/dateUtils.js";
import mongoose from "mongoose";
import { applyAutoFines } from "../Fine/Fine.controler.js";
import { emitAttendanceUpdate, emitNotification } from "../../../Utils/sseManager.js";
import Fine from "../Fine/Fine.modal.js";
import AttendanceLog from "../AttendanceLog.modal.js";
import { createNotification } from "../../Notification/Notification.controler.js";
import { calculateStaffPayroll } from "../../Payroll/Payroll.controler.js";


export const markAttendance = asyncHandler(async (req, res) => {
  const {
    staffId,
    date,
    check_in,
    check_out,
    status,
    fine,
    remarks,
    mark_source,
    work_session_hours,
  } = req.body;

  const hasPunch = Boolean(check_in || check_out);
  const isPunchIn = Boolean(check_in);
  const isPunchOut = Boolean(check_out);

  if (!staffId || !date) {
    throw new ApiError(400, "staffId & date required");
  }
  const attendanceDate = getISTStartDateUTC(date);
  let finalDateToUse = date;
  if (
    moment
      .tz(attendanceDate, "Asia/Kolkata")
      .isAfter(moment.tz("Asia/Kolkata"), "day")
  ) {
    throw new ApiError(400, "Future date attendance not allowed");
  }

  const staff = await Staff.findById(staffId).populate("work_shift");
  if (!staff) throw new ApiError(404, "Staff not found");

  let attendance = await Attendance.findOne({
    staff: staffId,
    date: attendanceDate,
  });

  if (check_out && !check_in && !attendance?.check_in) {
    const yesterdayStr = moment
      .tz(date, "YYYY-MM-DD", "Asia/Kolkata")
      .subtract(1, "day")
      .format("YYYY-MM-DD");

    const yesterdayUTC = getISTStartDateUTC(yesterdayStr);

    const yesterdayAttendance = await Attendance.findOne({
      staff: staffId,
      date: yesterdayUTC,
      check_in: { $exists: true },
      check_out: { $exists: false },
    });

    if (yesterdayAttendance) {
      attendance = yesterdayAttendance;
      finalDateToUse = yesterdayStr;
      console.log(`Using yesterday (${yesterdayStr}) record for checkout`);
    } else {
      throw new ApiError(400, "No pending check-in found");
    }
  }

  if (!attendance) {
    attendance = new Attendance({
      staff: staffId,
      date: attendanceDate,
      status: status || "Absent",
      work_sessions: [],
      breaks: [],
      mark_source,
      marked_by:
        mark_source === "PANEL" || mark_source === "FACE"
          ? req.user?.id || null
          : null,
    });

  
  } else {
  
  }

 
  if (status === "Absent") {
    attendance.check_in = null;
    attendance.check_out = null;
    attendance.work_sessions = [];
    attendance.manual_working_hours = null;
    attendance.manual_working_hours_by = null;
    attendance.manual_working_hours_at = null;
    attendance.breaks = [];
    attendance.working_hours = 0;
    attendance.is_late = false;
    attendance.late_by_minutes = 0;
    attendance.overtime_hours = 0;
    attendance.status = "Absent";

  await attendance.save();
    emitAttendanceUpdate({ staffId });

    return res.json(
      new ApiResponse(200, attendance, "Attendance updated successfully"),
    );
  }

  let ciUTC, coUTC;
const isAdmin = req.user?.role === "admin";

if (
  isAdmin &&
  work_session_hours !== undefined &&
  work_session_hours !== null &&
  status !== "Absent"
) {
  const manualHours = Number(work_session_hours);

  if (Number.isNaN(manualHours) || manualHours < 0 || manualHours > 24) {
    throw new ApiError(400, "Invalid manual working hours");
  }

  // const hasRunningSession = attendance.work_sessions?.some((w) => !w.end_time);
  // const hasRunningBreak = attendance.breaks?.some((b) => !b.end_time);

  attendance.manual_working_hours = Number(manualHours.toFixed(2));
  attendance.manual_working_hours_by = req.user?.id || null;
  attendance.manual_working_hours_at = new Date();

  attendance.working_hours = attendance.manual_working_hours;
  attendance.status = attendance.working_hours < 4 ? "Half-Day" : "Present";
   
}

 if (check_in && status !== "Absent") {
   ciUTC = getUTCFromISTDateTime(date, check_in);
   attendance.check_in = ciUTC;
 if (
   attendance.manual_working_hours === null ||
   attendance.manual_working_hours === undefined
 ) {
   attendance.status = "Present";
 }


   if (staff?.work_shift?.startTime) {
     const buffer = staff.work_shift.bufferMinutes || 0;
     const { isLate, lateByMinutes } = calculateLate({
       date,
       checkInTime: ciUTC,
       shiftStartTime: staff.work_shift.startTime,
       graceMinutes: buffer,
     });
     attendance.is_late = isLate;
     attendance.late_by_minutes = lateByMinutes;
   }
 }


 if (check_out && status !== "Absent") {
   if (!attendance.check_in) {
     throw new ApiError(400, "Check-in required before check-out");
   }

   let coDate = finalDateToUse;

   const existingCheckInIST = moment
     .utc(attendance.check_in)
     .tz("Asia/Kolkata");

   const checkInMinutes =
     existingCheckInIST.hours() * 60 + existingCheckInIST.minutes();

   const [h, m] = check_out.split(":").map(Number);
   const checkOutMinutes = h * 60 + m;
   if (checkOutMinutes < checkInMinutes - 30) {
     coDate = moment
       .tz(finalDateToUse, "YYYY-MM-DD", "Asia/Kolkata")
       .add(1, "day")
       .format("YYYY-MM-DD");
   }

   coUTC = getUTCFromISTDateTime(coDate, check_out);

   if (coUTC < attendance.check_in) {
     throw new ApiError(400, "Check-out cannot be before check-in");
   }

   attendance.check_out = coUTC;
if (attendance.work_sessions?.length) {
  attendance.work_sessions.forEach((s) => {
    if (!s.end_time) s.end_time = coUTC;
  });
}
if (attendance.breaks?.length) {
  attendance.breaks.forEach((b) => {
    if (!b.end_time) {
      b.end_time = coUTC;
      b.duration = Math.ceil((b.end_time - b.start_time) / (1000 * 60));
    }
  });
}

 let calculatedHours = 0;

if (
  attendance.manual_working_hours !== null &&
  attendance.manual_working_hours !== undefined
) {
  calculatedHours = attendance.manual_working_hours;
} else if (attendance.work_sessions && attendance.work_sessions.length > 0) {
  calculatedHours = calculateWorkHoursFromSessions(attendance.work_sessions);
} else if (attendance.check_in && attendance.check_out) {
  calculatedHours =
    moment(attendance.check_out).diff(moment(attendance.check_in), "minutes") /
    60;
}

attendance.working_hours = Number(Number(calculatedHours).toFixed(2));
attendance.status = attendance.working_hours < 4 ? "Half-Day" : "Present";

 }
  const isManualFineApplied = fine && Number(fine) > 0;

  if (fine && Number(fine) > 0) {
    // 1️⃣ Add fine record
    await Fine.create({
      staff: staffId,
      attendance: attendance._id,
      date: attendance.date,
      rule_key: "MANUAL_FINE",
      type: "MANUAL_FINE",
      category: "DISCIPLINE_POLICY",
      amount: Number(fine),
      action: "DEDUCT",
      approved: true,
      approved_by: req.user?.id || null,
      approved_at: new Date(),
      remarks: remarks || "Manual fine by admin",
    });

    
    const totalFine = await Fine.aggregate([
      {
        $match: {
          attendance: attendance._id,
          approved: true,
          is_active: true,
          action: "DEDUCT",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    attendance.fine = totalFine[0]?.total || 0;
    attendance.has_fine = attendance.fine > 0;
    attendance.status = attendance.status === "Present" ? "Present" : "Fine";

  }

  if (remarks !== undefined) attendance.remarks = remarks;

  if (!isManualFineApplied) {
    if (isPunchIn && isPunchOut) {
      await applyAutoFines(attendance, "PUNCH_IN");
      await applyAutoFines(attendance, "PUNCH_OUT");
    } else if (isPunchIn) {
      await applyAutoFines(attendance, "PUNCH_IN");
    } else if (isPunchOut) {
      await applyAutoFines(attendance, "PUNCH_OUT");
    }
  }

  emitAttendanceUpdate({ staffId });

  let markedByName = null;

  if (req.user?.role === "admin") {
    markedByName = "Admin";
  } else {
    const markerStaff = await Staff.findById(req.user.id).select("staff_name");
    markedByName = markerStaff?.staff_name || "Staff";
  }
  const recognizedAtUTC = getUTCFromISTDateTime(
    date, // attendance date (can be back date)
    moment().tz("Asia/Kolkata").format("HH:mm")
  );

  await AttendanceLog.create({
    staff_doc_id: staff._id,
    staff_id: staff.staff_id,
    staff_name: staff.staff_name,

    recognized_at: recognizedAtUTC,
    confidence: null,
    image_url: null,
    source: "HR_PANEL",

    marked_by: {
      id: req.user?.id,
      name: markedByName,
    },
  });

  const prettyDate = moment
    .tz(finalDateToUse, "Asia/Kolkata")
    .format("DD MMM YYYY");

  const statusLabel =
    attendance.status === "Fine" ? "Present (Fine)" : attendance.status;

  const attendanceMessage = `Your attendance for ${prettyDate} has been marked ${statusLabel} by ${markedByName}.`;
await attendance.save();
if (check_out && attendance.check_out && attendance.status !== "Absent") {
  await calculateStaffPayroll(req, {
    json: () => {},
    status: () => ({ json: () => {} }),
  });
}
  await createNotification({
    title: "🕒 Attendance Marked",
    message: attendanceMessage,
    createdByAdmin: req.user?.role === "admin" ? req.user.id : null,
    createdByStaff: req.user?.role !== "admin" ? req.user.id : null,
    audienceType: "individual",
    targetStaff: [staffId],
    sendAt: new Date(),
    meta: {
      type: "attendance",
      attendanceId: attendance._id,
      status: attendance.status,
      date: finalDateToUse,
      markedBy: markedByName,
    },
  });

  emitNotification({
    audienceType: "individual",
    staffIds: [staffId],
    payload: {
      type: "attendance",
      attendanceId: attendance._id,
      status: attendance.status,
      message: attendanceMessage,
    },
  });

  res.json(new ApiResponse(200, attendance, "Attendance updated successfully"));
});


export const getStaffMonthlySummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;

  const current = moment();
  const monthNum = month ? +month : current.month() + 1;
  const yearNum = year ? +year : current.year();

  const paddedMonth = String(monthNum).padStart(2, "0");

  const start = moment(
    `${yearNum}-${paddedMonth}-01`,
    "YYYY-MM-DD",
    true
  ).startOf("month");

  const end = start.isSame(current, "month")
    ? current.clone().endOf("day")
    : start.clone().endOf("month");

  const staffList = await Staff.find({});
  const attendanceRecords = await Attendance.find({
    date: { $gte: start.toDate(), $lte: end.toDate() },
  });

  const summary = staffList.map((staff) => {
    const staffAttendance = attendanceRecords.filter(
      (a) => a.staff.toString() === staff._id.toString()
    );

    return {
      staffName: staff.staff_name,
      present: staffAttendance.filter((a) => a.status === "Present").length,
      absent: staffAttendance.filter((a) => a.status === "Absent").length,
      total: staffAttendance.length,
    };
  });

  res.json(
    new ApiResponse(
      200,
      { month: monthNum, year: yearNum, summary },
      "Summary fetched"
    )
  );
});

const diffInSeconds = (start, end = new Date()) =>
  Math.max(0, Math.floor((end - start) / 1000));

const calculateTimers = (attendance) => {
  const now = new Date();

  let workingSeconds = 0;
  let breakSeconds = 0;

  // ✅ Work sessions
  for (const w of attendance.work_sessions || []) {
    if (w.start_time) {
      workingSeconds += diffInSeconds(w.start_time, w.end_time || now);
    }
  }

  // ✅ Break sessions
  for (const b of attendance.breaks || []) {
    if (b.start_time) {
      breakSeconds += diffInSeconds(b.start_time, b.end_time || now);
    }
  }

  // ✅ Total elapsed from check-in
  const totalElapsedSeconds = attendance.check_in
    ? diffInSeconds(attendance.check_in, now)
    : 0;

  return {
    totalElapsedSeconds,
    workingSeconds,
    breakSeconds,
    serverTime: now,
  };
};

export const checkTodayPunch = asyncHandler(async (req, res) => {
  const staffId = new mongoose.Types.ObjectId(req.query.staffId || req.user.id);

  const todayStartUTC = moment.tz("Asia/Kolkata").startOf("day").utc().toDate();

  const todayEndUTC = moment.tz("Asia/Kolkata").endOf("day").utc().toDate();

  const yesterdayStartUTC = moment
    .tz("Asia/Kolkata")
    .subtract(1, "day")
    .startOf("day")
    .utc()
    .toDate();

  const attendanceResult = await Attendance.aggregate([
    {
      $match: {
        staff: staffId,
        $or: [
          {
            check_in: {
              $gte: todayStartUTC,
              $lte: todayEndUTC,
            },
          },
          {
            check_in: {
              $gte: yesterdayStartUTC,
              $lt: todayStartUTC,
            },
            $or: [
              { check_out: { $exists: false } },
              { check_out: null },
              {
                $expr: {
                  $lte: ["$check_out", "$check_in"],
                },
              },
            ],
          },
        ],
      },
    },
    { $sort: { check_in: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: "staffs",
        localField: "staff",
        foreignField: "_id",
        as: "staff",
      },
    },
    { $unwind: "$staff" },
    {
      $addFields: {
        profile_photo: "$staff.profile_photo",
        work_status: "$staff.work_status",
      },
    },
    {
      $project: {
        staff: 0,
      },
    },
  ]);

  const attendance = attendanceResult[0] || null;

  let isWorking = false;
  let isOnBreak = false;
  let currentStatus = "IDLE";

  if (attendance) {
    const activeBreak = attendance.breaks?.find((b) => !b.end_time);
    const activeWork = attendance.work_sessions?.find((w) => !w.end_time);

    if (attendance.check_out && attendance.check_out > attendance.check_in) {
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

  const timers = attendance ? calculateTimers(attendance) : null;

  const profilePhoto = attendance?.profile_photo || null;
  if (attendance) delete attendance.profile_photo;

  return res.json(
    new ApiResponse(
      200,
      {
        attendance,
        profile_photo: profilePhoto,
        timers: timers
          ? {
              totalElapsedSeconds: timers.totalElapsedSeconds,
              workingSeconds: timers.workingSeconds,
              breakSeconds: timers.breakSeconds,
              serverTime: timers.serverTime,
            }
          : null,
        punchedIn: !!attendance?.check_in,
        punchedOut:
          !!attendance?.check_out && attendance.check_out > attendance.check_in,
        isWorking,
        isOnBreak,
        currentStatus,
      },
      "Punch status with backend timers"
    )
  );
});


export const getActiveBreaksToday = asyncHandler(async (req, res) => {
  const tz = "Asia/Kolkata";

  const todayStart = moment.tz(tz).startOf("day").toDate();
  const todayEnd = moment.tz(tz).endOf("day").toDate();

  const yesterdayStart = moment
    .tz(tz)
    .subtract(1, "day")
    .startOf("day")
    .toDate();

  // 🔥 Find attendances of today OR yesterday (night shift)
  const attendances = await Attendance.find({
    check_out: null,
    date: {
      $gte: yesterdayStart,
      $lte: todayEnd,
    },
    breaks: {
      $elemMatch: {
        end_time: null,
      },
    },
  })
    .populate("staff", "staff_name staff_id")
    .select("staff breaks updatedAt");

  const activeBreaks = [];

  attendances.forEach((att) => {
    const activeBreak = att.breaks
      ?.slice()
      .reverse()
      .find((b) => !b.end_time);

    if (activeBreak) {
      activeBreaks.push({
        staffId: att.staff._id,
        staffName: att.staff.staff_name,
        staffCode: att.staff.staff_id,
        breakType: activeBreak.type,
        breakStart: activeBreak.start_time,
        updatedAt: att.updatedAt,
      });
    }
  });

  res.json({
    count: activeBreaks.length,
    activeBreaks,
  });
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

export const getStaffMonthlyAttendance = asyncHandler(async (req, res) => {
  const { month, year, staffId } = req.query;
  if (!staffId) throw new ApiError(400, "Staff ID is required");

  const staff = await Staff.findById(staffId).populate({
    path: "work_shift",
    select: "name _id",
  });
  if (!staff) throw new ApiError(404, "Staff not found");

  // ✅ Always take "now" in IST
  const nowIST = moment().tz("Asia/Kolkata");

  const monthNum = month ? +month : nowIST.month() + 1;
  const yearNum = year ? +year : nowIST.year();

  const paddedMonth = String(monthNum).padStart(2, "0");
  const firstDayStr = `${yearNum}-${paddedMonth}-01`;

  // ✅ IST month range → UTC
  const startOfMonthUTC = istDayStartUTC(firstDayStr);

  let endOfMonthUTC = moment(startOfMonthUTC)
    .add(1, "month")
    .subtract(1, "millisecond")
    .toDate();

  // ❌ Future month guard
  if (moment(startOfMonthUTC).isAfter(nowIST.toDate())) {
    return res.json(
      new ApiResponse(200, { staff, attendance: [] }, "Future month")
    );
  }

  // ✅ Current month → till today only
  if (nowIST.year() === yearNum && nowIST.month() + 1 === monthNum) {
    endOfMonthUTC = nowIST.utc().toDate();
  }

  // ✅ DB query always in UTC
  const attendanceRecords = await Attendance.find({
    staff: staffId,
    date: { $gte: startOfMonthUTC, $lte: endOfMonthUTC },
  });

  const weeklyHolidays = await WeeklyHoliday.find({});
  const holidayDays = weeklyHolidays.map((h) => h.day);

  const attendance = [];

  // ✅ Loop in IST days
  let cursor = moment(endOfMonthUTC).tz("Asia/Kolkata");
  const startCursor = moment(startOfMonthUTC).tz("Asia/Kolkata");

  while (cursor.isSameOrAfter(startCursor, "day")) {
    const cursorDateStr = cursor.format("YYYY-MM-DD");

    const record = attendanceRecords.find(
      (a) => toIST(a.date, "YYYY-MM-DD") === cursorDateStr
    );

    const dayName = cursor.format("dddd");
const workingHours = record ? sumWorkSessionsHours(record.work_sessions) : 0;

    attendance.push({
      date: cursorDateStr,

      check_in: record?.check_in ? toIST(record.check_in, "HH:mm") : null,
      check_out: record?.check_out ? toIST(record.check_out, "HH:mm") : null,

      working_hours: workingHours,

      status: record
        ? record.status
        : holidayDays.includes(dayName)
        ? "Week-Off"
        : "Absent",

      // ✅ ADD THESE
      remark: record?.remarks || "",
      fine: record?.fine || 0,
      is_late: record?.is_late || false,
      late_by_minutes: record?.late_by_minutes || 0,
    });

    cursor.subtract(1, "day");
  }

  res.json(
    new ApiResponse(
      200,
      {staff: staff.staff_name
,
        staffinfo: {
          _id: staff._id,
          staff_name: staff.staff_name,
          joining_date: staff.joining_date,
          work_shift: staff.work_shift,
        },

        month: monthNum,
        year: yearNum,
        attendance,
      },
      "Monthly attendance fetched"
    )
  );
});