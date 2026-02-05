import { Router } from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncementsForHR,
  getAnnouncementsForStaff,
  updateAnnouncement,
} from "./Announcement.Controler.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";


const router = Router();


router.post(
  "/create",
  authVerifyJWT,
  checkPermission("announcement:create"),
  createAnnouncement
);

router.get(
  "/all",
  authVerifyJWT,
  checkPermission("announcement:view"),
  getAllAnnouncementsForHR
);

router.patch(
  "/:id",
  authVerifyJWT,
  checkPermission("announcement:update"),
  updateAnnouncement
);

router.delete(
  "/:id",
  authVerifyJWT,
  checkPermission("announcement:delete"),
  deleteAnnouncement
);

router.get(
  "/my",
  authVerifyJWT,
  getAnnouncementsForStaff
);

export default router;
