import { Router } from "express";
import {
  addStaffNew,
  assignedshiftToStaff,
  assignInsuranceToStaff,
  changePassword,
  deleteInsuranceOfStaff,
  deleteStaff,
  forgotPassword,
  getAllStaff,
  getNextStaffId,
  getReporteesByManager,
  getStaffByAttendanceSupervisor,
  getStaffById,
  inviteStaff,
  loginStaff,
  loginStaffForAdminPortal,
  logoutStaff,
  resetStaffPassword,
  setAttendanceSupervisor,
  setReportingManager,
  setStaff2FA,
  setup2FA,
  toggleStaffStatus,
  updateInsuranceOfStaff,
  updateMyProfile,
  updateProfilePhotoOnly,
  updateStaff2,
  upsertStaffDocument,
  verify2FA,
  
} from "./Staff.controler.js";

import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";
import upload from "../../Middlewares/multer.js";

const router = Router();

router.post("/login", loginStaff);
router.post("/login-portal", loginStaffForAdminPortal);
router.post("/logout", logoutStaff);
router.post("/2fa/setup", setup2FA);
router.post("/2fa/verify", verify2FA);
router.patch("/:staffId/2fa", authVerifyJWT, setStaff2FA);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetStaffPassword);

router.post("/change-password", authVerifyJWT, changePassword);


router.get(
  "/next-id",
  authVerifyJWT,
  checkPermission("staff:view"),
  getNextStaffId
);

router.get("/", authVerifyJWT, checkPermission("staff:view"), getAllStaff);

router.get("/:id", getStaffById);

router.post(
  "/add",
  authVerifyJWT,
  checkPermission("staff:create"),
  upload.fields([{ name: "profile_photo", maxCount: 1 }]),
  addStaffNew
);
router.post("/:staffId/invite", authVerifyJWT, inviteStaff);

router.patch(
  "/updatenew/:id",
  authVerifyJWT,
  checkPermission("staff:update"),
  upload.fields([
    { name: "profile_photo", maxCount: 1 },
    { name: "documents", maxCount: 20 },
  ]),
  updateStaff2,
);
router.post(
  "/assign-shift",
  authVerifyJWT,
  assignedshiftToStaff,
);
router.patch(
  "/updatedoc/:id",
  authVerifyJWT,
  checkPermission("staff:update"),
  upload.fields([{ name: "document", maxCount: 1 }]),
  upsertStaffDocument,
);

router.patch(
  "/profile",
  authVerifyJWT, 
  upload.fields([
    { name: "profile_photo", maxCount: 1 }, 
  ]),
  updateMyProfile
);

router.patch(
  "/:staffId/set-reporting-manager",
  authVerifyJWT,
  checkPermission("staff:update"),
  setReportingManager
);

router.patch(
  "/:staffId/set-attendance-supervisor",
  authVerifyJWT,
  checkPermission("staff:update"),
  setAttendanceSupervisor
);

router.patch(
  "/profile/photo",
  authVerifyJWT,
  upload.fields([{ name: "profile_photo", maxCount: 1 }]),
  updateProfilePhotoOnly
);

router.get(
  "/reporting-manager/:managerId/staff",
  authVerifyJWT,
  getReporteesByManager
);

router.get(
  "/attendance-supervisor/:supervisorId/staff",
  authVerifyJWT,
  getStaffByAttendanceSupervisor
);

router.delete(
  "/:id",
  authVerifyJWT,
  checkPermission("staff:delete"),
  deleteStaff
);
router.patch("/:staffId/toggle-status", authVerifyJWT, toggleStaffStatus);
router.post(
  "/:staffId/insurance",
  authVerifyJWT,
  checkPermission(" staff:update"),
  upload.single("document"),
  assignInsuranceToStaff,
);
router.put(
  "/:staffId/insurance/:insuranceId",
  authVerifyJWT,
  checkPermission(" staff:update"),
  upload.single("document"),
  updateInsuranceOfStaff,
);

router.delete(
  "/:staffId/insurance/:insuranceId",
  authVerifyJWT,
  checkPermission(" staff:update"),
  deleteInsuranceOfStaff,
);

export default router;
