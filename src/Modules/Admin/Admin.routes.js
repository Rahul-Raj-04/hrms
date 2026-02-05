import { Router } from "express";
import {
  changeAdminPassword,
  forgotPassword,
  getAdminDetails,
  // loginAdmin,
  loginAdminduo,
  logoutAdmin,
  resetPassword,
  sendAdminDisable2FAOtp,
  setupAdmin2FA,
  updateAdmin,
  updateAdminProfilePhoto,
  verifyAdmin2FA,
  verifyAdminDisable2FAOtp,
} from "./Admin.controler.js";
import {
  assignStaffHierarchyBulk,
  assignStaffPermissions,
} from "./Admin.permission.controler.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import upload from "../../Middlewares/multer.js";


const router = Router();
router.route("/login").post(loginAdminduo);
router.post("/2fa/setup", setupAdmin2FA);
router.post("/2fa/verify", verifyAdmin2FA);
router.post("/2fa/disable/send-otp", sendAdminDisable2FAOtp);
router.post("/2fa/disable/verify-otp", verifyAdminDisable2FAOtp);

router.route("/forgot_password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);
router.use(authVerifyJWT);
router.post(
  "/assign-permissions",
  checkPermission("staff.update"),
  assignStaffPermissions
);
router.post(
  "/assign-hierarchy-bulk",
  checkPermission("staff.update"),
  assignStaffHierarchyBulk
);
router.route("/logout").post(logoutAdmin);
router.route("/Profile").get(getAdminDetails);
router.route("/update").patch(updateAdmin);
router.route("/change-password").post(authVerifyJWT, changeAdminPassword);
router.put(
  "/profile-photo",
  authVerifyJWT,
  upload.single("profilePhoto"),
  updateAdminProfilePhoto
);
export default router;
