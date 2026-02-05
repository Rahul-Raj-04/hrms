import { Router } from "express";
import {
  createShift,
  deleteShift,
  getAllShifts,
  toggleShiftStatus,
  updateShift,
} from "./Shift.controler.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";

const router = Router();

router.post(
  "/create",
  authVerifyJWT,
  checkPermission("settings:create"),
  createShift
);

router.patch(
  "/edit/:id",
  authVerifyJWT,
  checkPermission("settings:update"),
  updateShift
);
router.patch(
  "/status/:id",
  authVerifyJWT,
  checkPermission("settings:update"),
  toggleShiftStatus
);
router.delete(
  "/delete/:id",
  authVerifyJWT,
  checkPermission("settings:delete"),
  deleteShift
);
router.get("/", getAllShifts);

export default router;
