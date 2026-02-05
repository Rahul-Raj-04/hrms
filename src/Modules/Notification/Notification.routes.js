import { Router } from "express";
import {
  clearAdminNotifications,
  clearMyNotifications,
  getAdminNotifications,
  getHrNotifications,
  getStaffNotifications,
  markAdminNotificationRead,
  markHrNotificationRead,
  markNotificationRead,
} from "./Notification.controler.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";


const router = Router();



router.get(
  "/",
  authVerifyJWT,
  getStaffNotifications
);

router.patch(
  "/mark-read/:notificationId",
  authVerifyJWT,
  markNotificationRead
);


router.get(
  "/admin",
  authVerifyJWT,
  getAdminNotifications
);
router.get("/hr", authVerifyJWT, getHrNotifications);

router.patch(
  "/hr/:notificationId/read",
  authVerifyJWT,
  markHrNotificationRead
);
router.patch("/clear", authVerifyJWT, clearMyNotifications);
router.patch("/admin/clear", authVerifyJWT, clearAdminNotifications);

router.patch(
  "/admin/notifications/:notificationId/read",
  authVerifyJWT,
  markAdminNotificationRead
);
export default router;
