import { Router } from "express";
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from "./Department.controler.js";

import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";

const router = Router();

// CREATE
router.post(
  "/create",
  authVerifyJWT,
  checkPermission("department:create"),
  createDepartment
);

// UPDATE
router.patch(
  "/edit/:id",
  authVerifyJWT,
  checkPermission("department:update"),
  updateDepartment
);

// DELETE
router.delete(
  "/delete/:id",
  authVerifyJWT,
  checkPermission("department:delete"),
  deleteDepartment
);

// VIEW
router.get(
  "/",
  authVerifyJWT,
  checkPermission("department:view","staff:create"),
  getDepartments
);

export default router;
