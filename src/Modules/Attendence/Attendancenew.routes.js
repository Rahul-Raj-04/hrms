import { Router } from "express";
import {
  deleteReport,
  generateDailyAttendanceReport,
  getDailyReports,
  getStaffAttendanceByDate,

  getStaffMonthlySummary,
  attendanceGlobalSync,
  generateStaffWiseAttendanceReport,
  fullBackup,
 
} from "./Attendence.controler.js";

import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";
import {
  checkIn,
  checkOut,
  endBreak,
  getAttendanceLogsByDate,
  getMyMonthAttendance,
  getMyTodayAttendance,
  startBreak,
  startWork,
} from "./Staff/staff.attendance.controller.js";
import {
  checkTodayPunch,
  getActiveBreaksToday,
  getStaffMonthlyAttendance,
  markAttendance,
} from "./Admin/admin.attendance.controller.js";
import { getPendingFines } from "./Fine/Fine.controler.js";

const router = Router();

router.post("/checkin", authVerifyJWT, checkIn);
router.post("/checkout", authVerifyJWT, checkOut);
router.patch("/start-work", authVerifyJWT, startWork);
router.patch("/start-break", authVerifyJWT, startBreak);
router.patch("/end-break", authVerifyJWT, endBreak);
router.get("/my_attendence", authVerifyJWT, getMyMonthAttendance);
router.get("/getMyTodayAttendance", authVerifyJWT, getMyTodayAttendance);
router.get("/sync", authVerifyJWT, attendanceGlobalSync);

router.patch(
  "/markattendence",
  authVerifyJWT,
  checkPermission("attendance:update"),
  markAttendance
);

router.get(
  "/staff-monthly",
  authVerifyJWT,
  checkPermission("attendance:view"),
  getStaffMonthlyAttendance
);

router.get(
  "/staff-fine",
  authVerifyJWT,
  checkPermission("attendance:view"),
  getPendingFines
);
router.get(
  "/summary-monthly",
  authVerifyJWT,
  checkPermission("attendance:view"),
  getStaffMonthlySummary
);

router.get(
  "/staff-today",
  authVerifyJWT,
  checkPermission("attendance:view"),
  getStaffAttendanceByDate
);

router.get(
  "/today-punch",
  authVerifyJWT,
  checkPermission("attendance:view"),
  checkTodayPunch
);

router.get(
  "/active-breaks/today",
  authVerifyJWT,
  checkPermission("attendance:view"),
  getActiveBreaksToday
);

router.get("/day-logs", authVerifyJWT, getAttendanceLogsByDate);
router.post(
  "/attendance/daily",
  authVerifyJWT,
  checkPermission("reports:create"),
  generateDailyAttendanceReport
);

router.post(
  "/full",
  fullBackup,
);
router.post(
  "/attendance/staff-wise",
  authVerifyJWT,
  checkPermission("reports:create"),
  generateStaffWiseAttendanceReport,
);
router.get(
  "/reports/daily",
  authVerifyJWT,
  checkPermission("attendance:view"),
  getDailyReports
);

router.delete(
  "/reports/daily/:id",
  authVerifyJWT,
  checkPermission("reports:delete"),
  deleteReport
);

export default router;
