import moment from "moment-timezone";

import { asyncHandler } from "../../../Utils/asyncHandler.js";
import { ApiResponse } from "../../../Utils/ApiResponse.js";
import { ApiError } from "../../../Utils/ApiError.js";
import Staff from "../../Staff/Staff.model.js";
import WeeklyHoliday from "../../Leave/WeeklyHoliday.model.js";
import LeaveApplication from "../../Leave/LeaveApplication.model.js";
import Attendance from "../Attendence.model.js";

import { calculateLate } from "../Utils/late.utils.js";
import {
  getNowUTCFromIST,
  getTodayISTDate,
  getYesterdayISTDate,
} from "../../../Utils/date.js";
import AttendanceLog from "../AttendanceLog.modal.js";
import { findActiveAttendance } from "../Utils/findActiveAttendance.js";
import { applyAutoFines } from "../Fine/Fine.controler.js";
import { emitAttendanceUpdate } from "../../../Utils/sseManager.js";
import { calculateStaffPayroll } from "../../Payroll/Payroll.controler.js";

export const checkIn = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  const date = getTodayISTDate();
  const now = getNowUTCFromIST();

  /* ===================== FETCH STAFF + SHIFT ===================== */
  const staff = await Staff.findById(staffId).populate("work_shift");
  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  /* ===================== FIND / CREATE ATTENDANCE ===================== */
  let attendance = await Attendance.findOne({
    staff: staffId,
    date,
  });

  if (!attendance) {
    attendance = new Attendance({
      staff: staffId,
      date,
      status: "Present",
      work_sessions: [],
      breaks: [],
    });
  }

  /* ===================== ALREADY CHECKED IN ===================== */
  if (attendance.check_in) {
    throw new ApiError(400, "Already checked in");
  }

  /* ===================== SET CHECK-IN ===================== */
  attendance.check_in = now;

  /* ===================== LATE CALCULATION ===================== */
  if (staff?.work_shift?.startTime) {
    const buffer = staff.work_shift.bufferMinutes || 0;
    const { isLate, lateByMinutes } = calculateLate({
      date: moment(date).tz("Asia/Kolkata").format("YYYY-MM-DD"),
      checkInTime: now,
      shiftStartTime: staff.work_shift.startTime,
      shiftEndTime: staff.work_shift.endTime,
      graceMinutes: buffer,
    });

    attendance.is_late = isLate;
    attendance.late_by_minutes = lateByMinutes;
  }

  await attendance.save();
   emitAttendanceUpdate({ staffId });
  await applyAutoFines(attendance, "PUNCH_IN");
  res.status(201).json(new ApiResponse(201, attendance, "Check-in successful"));
});

export const checkOut = asyncHandler(async (req, res) => {
  const staffId = req.user.id;
  const attendance = await findActiveAttendance({
    staffId,
  });

  if (!attendance || !attendance.check_in) {
    throw new ApiError(400, "Not checked in");
  }

  if (attendance.check_out) {
    throw new ApiError(400, "Already checked out");
  }
  const activeWork = attendance.work_sessions
    .slice()
    .reverse()
    .find((w) => !w.end_time);

  if (activeWork) {
    activeWork.end_time = new Date();
  }

  // 🧠 Close active break if any
  const activeBreak = attendance.breaks
    .slice()
    .reverse()
    .find((b) => !b.end_time);

  if (activeBreak) {
    activeBreak.end_time = new Date();
    activeBreak.duration = Math.ceil(
      (activeBreak.end_time - activeBreak.start_time) / (1000 * 60)
    );
  }

  attendance.check_out = new Date();

  await attendance.save();
   emitAttendanceUpdate({ staffId });
  await applyAutoFines(attendance, "PUNCH_OUT");
  await calculateStaffPayroll(req, {
    json: () => {},
    status: () => ({ json: () => {} }),
  });
  res.json(new ApiResponse(200, attendance, "Check-out successful"));
});

export const startWork = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  const attendance = await findActiveAttendance({
    staffId,
  });

  if (!attendance || !attendance.check_in) {
    throw new ApiError(400, "Not checked in");
  }

  if (attendance.check_out) {
    throw new ApiError(400, "Already checked out");
  }

  if (attendance.work_sessions.some((w) => !w.end_time)) {
    throw new ApiError(400, "Work already running");
  }

  if (attendance.breaks.some((b) => !b.end_time)) {
    throw new ApiError(400, "Break is active");
  }

  attendance.work_sessions.push({
    start_time: new Date(),
  });

  await attendance.save();
 emitAttendanceUpdate({ staffId });
  res.json(new ApiResponse(200, attendance, "Work started"));
});
export const startBreak = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;
  const { staffId, type } = req.body;
  const targetStaffId = staffId || loggedInUserId;

  const attendance = await findActiveAttendance({
    staffId: targetStaffId,
    requireActiveWork: true,
  });

  if (!attendance) {
    throw new ApiError(400, "Start work before break");
  }

  if (attendance.breaks.some((b) => !b.end_time)) {
    throw new ApiError(400, "Break already active");
  }

  const activeWork = attendance.work_sessions
    .slice()
    .reverse()
    .find((w) => !w.end_time);

  if (!activeWork) {
    throw new ApiError(400, "No active work session found");
  }

  const now = new Date();

  activeWork.end_time = now;

  attendance.breaks.push({
    type,
    start_time: now,
  });

  await attendance.save();
  
  emitAttendanceUpdate({ staffId: attendance.staff });
  res.json(new ApiResponse(200, attendance, "Break started"));
});

export const endBreak = asyncHandler(async (req, res) => {
  const loggedInUserId = req.user.id;
  const { staffId } = req.body;
  const targetStaffId = staffId || loggedInUserId;

  const attendance = await findActiveAttendance({
    staffId: targetStaffId,
    requireActiveBreak: true,
  });

  if (!attendance) {
    throw new ApiError(400, "No active break");
  }

  const activeBreak = attendance.breaks
    .slice()
    .reverse()
    .find((b) => !b.end_time);

  activeBreak.end_time = new Date();
  activeBreak.duration = Math.ceil(
    (activeBreak.end_time - activeBreak.start_time) / (1000 * 60)
  );

  attendance.work_sessions.push({
    start_time: new Date(),
  });

  await attendance.save();
 await applyAutoFines(attendance, "BREAK_END");
  emitAttendanceUpdate({ staffId: attendance.staff });

  res.json(new ApiResponse(200, attendance, "Break ended, work resumed"));
});

const diffInSeconds = (start, end = new Date()) =>
  Math.max(0, Math.floor((end - start) / 1000));
const calculateTimers = (attendance) => {
  const now = new Date();

  let workingSeconds = 0;
  let totalBreakSeconds = 0;
  let currentBreakSeconds = 0;

  // ✅ Work sessions (completed + active)
  for (const w of attendance.work_sessions || []) {
    if (w.start_time) {
      workingSeconds += diffInSeconds(w.start_time, w.end_time || now);
    }
  }

  // ✅ Break sessions (SEPARATED)
  for (const b of attendance.breaks || []) {
    if (!b.start_time) continue;

    const seconds = diffInSeconds(b.start_time, b.end_time || now);

    if (b.end_time) {
      // completed break → summary
      totalBreakSeconds += seconds;
    } else {
      // active break → LIVE TIMER
      currentBreakSeconds = seconds;
    }
  }

  const totalElapsedSeconds = attendance.check_in
    ? diffInSeconds(attendance.check_in, now)
    : 0;

  return {
    totalElapsedSeconds,
    workingSeconds,
    totalBreakSeconds,
    currentBreakSeconds,
    serverTime: now,
  };
};
export const getMyTodayAttendance = asyncHandler(async (req, res) => {
  const staffId = req.query.staffId || req.user.id;

  const todayStartUTC = moment.tz("Asia/Kolkata").startOf("day").utc().toDate();

  const todayEndUTC = moment.tz("Asia/Kolkata").endOf("day").utc().toDate();

  const yesterdayStartUTC = moment
    .tz("Asia/Kolkata")
    .subtract(1, "day")
    .startOf("day")
    .utc()
    .toDate();

  const attendance = await Attendance.findOne({
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
  }).sort({ check_in: -1 });

  let isWorking = false;
  let isOnBreak = false;
  let currentStatus = "IDLE";

  if (attendance) {
    const activeBreak = attendance.breaks?.some((b) => !b.end_time);
    const activeWork = attendance.work_sessions?.some(
      (w) => w.start_time && !w.end_time
    );

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

  res.json(
    new ApiResponse(
      200,
      {
        attendance: attendance || null,
        timers: timers
          ? {
              totalElapsedSeconds: timers.totalElapsedSeconds,
              workingSeconds: timers.workingSeconds,
              totalBreakSeconds: timers.totalBreakSeconds,
              currentBreakSeconds: timers.currentBreakSeconds,
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
export const getMyMonthAttendance = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins cannot access staff attendance",
      });
    }

    const staffId = req.user.id;
    let { month, year } = req.query;

    month = month || moment().month() + 1;
    year = year || moment().year();

    const paddedMonth = String(month).padStart(2, "0");

    let startDate = moment(`${year}-${paddedMonth}-01`).startOf("day");
    let endDate = moment(`${year}-${paddedMonth}-01`).endOf("month");

    const today = moment().endOf("day");
    if (today.isBefore(endDate)) endDate = today;

    const staff = await Staff.findById(staffId).select(
      "staff_name joining_date"
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    if (moment(staff.joining_date).isAfter(endDate)) {
      return res.status(200).json({
        staff,
        attendances: [],
      });
    }

    if (moment(staff.joining_date).isAfter(startDate)) {
      startDate = moment(staff.joining_date).startOf("day");
    }

    const attendances = await Attendance.find({
      staff: staffId,
      date: {
        $gte: startDate.clone().subtract(1, "day").toDate(),
        $lte: endDate.clone().add(1, "day").toDate(),
      },
    }).sort({ check_in: 1 });

    const approvedLeaves = await LeaveApplication.find({
      staff: staffId,
      status: "Approved",
      $or: [
        {
          startDate: { $lte: endDate.toDate() },
          endDate: { $gte: startDate.toDate() },
        },
      ],
    });

    const attendanceMap = {};

    attendances.forEach((a) => {
      const key = moment(a.check_in || a.date)
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD");

      attendanceMap[key] = {
        ...a.toObject(),
        date: key,
      };
    });

    approvedLeaves.forEach((leave) => {
      let current = moment.max(moment(leave.startDate), startDate);
      const leaveEnd = moment.min(moment(leave.endDate), endDate);

      while (current.isSameOrBefore(leaveEnd, "day")) {
        const key = current.format("YYYY-MM-DD");
        if (!attendanceMap[key]) {
          attendanceMap[key] = { date: key, status: "Leave" };
        }
        current.add(1, "day");
      }
    });

    const weeklyHolidays = await WeeklyHoliday.find({});
    const weeklyHolidayDays = weeklyHolidays.map((wh) =>
      wh.day.trim().toLowerCase()
    );

    let cursor = moment(startDate);

    while (cursor.isSameOrBefore(endDate, "day")) {
      const key = cursor.format("YYYY-MM-DD");
      const dayName = cursor.format("dddd").toLowerCase();

      if (!attendanceMap[key] && weeklyHolidayDays.includes(dayName)) {
        attendanceMap[key] = { date: key, status: "Week-Off" };
      }

      cursor.add(1, "day");
    }

    const mergedAttendance = Object.values(attendanceMap).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    return res.status(200).json({
      staff,
      attendances: mergedAttendance,
    });
  } catch (error) {
    console.error("Error in getMyMonthAttendance:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
export const getAttendanceLogsByDate = async (req, res) => {
  try {
    const { date, staffId } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    let staff;

    // ✅ CASE 1: ADMIN + staffId passed
    if (req.user.role === "admin" && staffId) {
      staff = await Staff.findById(staffId).select("staff_id staff_name");
    }
    // ✅ CASE 2: STAFF (self logs)
    else {
      staff = await Staff.findById(req.user.id).select("staff_id staff_name");
    }

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const start = moment.tz(date, "YYYY-MM-DD", "Asia/Kolkata").startOf("day");
    const end = moment(start).endOf("day");

    const logs = await AttendanceLog.find({
      staff_id: staff.staff_id,
      recognized_at: {
        $gte: start.toDate(),
        $lte: end.toDate(),
      },
    }).sort({ recognized_at: 1 });

    const formattedLogs = logs.map((l) => {
      let action = "Punched via Face Scan";

      if (l.source === "face_recognition") {
        action = "Punched via Face Scan";
      } else if (l.marked_by?.name) {
        action = `Marked by ${l.marked_by.name}`;
      }

      return {
        time: l.recognized_at,
        image_url: l.image_url || null,
        confidence: l.confidence || null,
        action,
      };
    });

    return res.json({
      staff_id: staff.staff_id,
      staff_name: staff.staff_name,
      date,
      logs: formattedLogs,
    });
  } catch (e) {
    console.error("❌ getAttendanceLogsByDate error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};


