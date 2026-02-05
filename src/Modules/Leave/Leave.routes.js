import express from "express";
import {
  addHoliday,
  addHolidayTemplate,
  addLeaveType,
  applyLeave,
  applyLeaveByHR,
  deleteHoliday,
  deleteHolidayTemplate,
  deleteLeave,
  deleteLeaveByAdmin,
  deleteLeaveType,
  deleteReport,
  deleteWeeklyHoliday,
  generateLeaveReport,
  getAllLeaves,
  getHolidays,
  getHolidayTemplates,
  getLeavesOfMyTeam,
  getLeaveTypes,
  getMyLeaveBalance,
  getMyLeaves,
  getMyLeaveTypes,
  getReports,
  getStaffLeaves,
  getWeeklyHoliday,
  setWeeklyHoliday,
  updateHoliday,
  updateHolidayTemplate,
  updateLeave,
  updateLeaveStatus,
  updateLeaveToStaffBucket,
  updateLeaveType,
} from "./Leave.controler.js";

import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";
import upload from "../../Middlewares/multer.js";

const router = express.Router();

router.post(
  "/weekly-holiday",
  authVerifyJWT,
  checkPermission("leave:create"),
  setWeeklyHoliday
);

router.get("/weekly-holiday", authVerifyJWT, getWeeklyHoliday);

router.delete(
  "/weekly-holiday/:id",
  authVerifyJWT,
  checkPermission("leave:delete"),
  deleteWeeklyHoliday
);

router.post(
  "/holiday",
  authVerifyJWT,
  checkPermission("leave:create"),
  addHoliday
);

router.post(
  "/holiday-template",
  authVerifyJWT,
  checkPermission( "settings:update"),
  addHolidayTemplate
);
router.patch(
  "/holiday-template/:id",
  authVerifyJWT,
  checkPermission("settings:update"),
  updateHolidayTemplate
);
router.get(
  "/holiday-template",
  authVerifyJWT,
  checkPermission(
    "leave:view",
    "staff:create",
    "staff:update",
    "settings:view"
  ),
  getHolidayTemplates
);

router.delete(
  "/holiday-template/:id",
  authVerifyJWT,
  checkPermission("leave:delete"),
  deleteHolidayTemplate
);

router.get(
  "/holiday",
  authVerifyJWT,
  checkPermission("leave:view"),
  getHolidays
);

router.patch(
  "/holiday/:id",
  authVerifyJWT,
  checkPermission("leave:update"),
  updateHoliday
);

router.delete(
  "/holiday/:id",
  authVerifyJWT,
  checkPermission("leave:delete"),
  deleteHoliday
);


router.post(
  "/leave-type",
  authVerifyJWT,
  checkPermission("leave:create"),
  addLeaveType
);
router.patch(
  "/staff-bucket",
  authVerifyJWT,
  checkPermission("leave:create"),
  updateLeaveToStaffBucket
);
router.get(
  "/leave-type",
  authVerifyJWT,
  checkPermission("leave:view", "staff:create", "staff:update"),
  getLeaveTypes
);

router.patch(
  "/leave-type/:id",
  authVerifyJWT,
  checkPermission("leave:update"),
  updateLeaveType
);

router.delete(
  "/leave-type/:id",
  authVerifyJWT,
  checkPermission("leave:delete"),
  deleteLeaveType
);


router.post(
  "/hr-apply",
  authVerifyJWT,
  checkPermission("leave:create"),
  applyLeaveByHR
);

router.get("/all", authVerifyJWT, checkPermission("leave:view"), getAllLeaves);


router.get("/myteam", authVerifyJWT, getLeavesOfMyTeam);

// Update leave status
router.patch(
  "/hr/update",
  authVerifyJWT,
  checkPermission("leave:update"),
  updateLeaveStatus
);

router.patch("/staff/update", authVerifyJWT, updateLeaveStatus);

// Staff self apply
router.post(
  "/my/apply",
  authVerifyJWT,
  upload.single("attachment"),
  applyLeave,
);
router.put("/my/:id", authVerifyJWT, upload.single("attachment"), updateLeave);
router.delete("/my/:id", authVerifyJWT, deleteLeave);
router.delete("/hr/:id", authVerifyJWT, deleteLeaveByAdmin);


router.get("/my/my-balance", authVerifyJWT, getMyLeaveBalance);
router.get(
  "/balance/:staffId",
  authVerifyJWT,
  getMyLeaveBalance
);
// Staff self data
router.get("/my/leave-type", authVerifyJWT, getMyLeaveTypes);

router.get("/my_leave", authVerifyJWT, getMyLeaves);

// Admin – staff leaves
router.get(
  "/staff_leave",
  authVerifyJWT,
  checkPermission("leave:view"),
  getStaffLeaves
);

router.post(
  "/report/generate",
  authVerifyJWT,
  checkPermission("reports:create"),
  generateLeaveReport
);
router.get(
  "/reports",
  authVerifyJWT,
  checkPermission("leave:view"),
  getReports
);

router.delete(
  "/reports/:id",
  authVerifyJWT,
  checkPermission("leave:delete"),
  deleteReport
);

export default router;
