import express from "express";
import {
  createSalaryComponent,
  deleteSalaryComponent,
  getSalaryComponents,
  calculatePayroll,
  updateSalaryComponent,
  getStaffPayroll,
  getPayrollSummaryForHR,
  getPayrollOverview,
  markPayrollAsPaid,
  addMonthlyAdjustment,
  downloadSalarySlip,
  calculateStaffPayroll,
  getStaffMonthlyAdjustments,
} from "./Payroll.controler.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";

const router = express.Router();
router.post(
  "/salary-components",
  authVerifyJWT,
  checkPermission("payroll:create"),
  createSalaryComponent
);

router.get(
  "/salary-components",
  authVerifyJWT,
  checkPermission("payroll:view", "staff:create", "staff:update"),
  getSalaryComponents
);

router.patch(
  "/salary-components/:id",
  authVerifyJWT,
  checkPermission("payroll:update"),
  updateSalaryComponent
);
router.delete(
  "/salary-components/:id",
  authVerifyJWT,
  checkPermission("payroll:delete"),
  deleteSalaryComponent
);
router.post(
  "/adjustment",
  authVerifyJWT,
  checkPermission("payroll:create"),
  addMonthlyAdjustment
);
router.get(
  "/monthly-adjustments/:staffId",
  authVerifyJWT,
  checkPermission("payroll:view", "staff:create", "staff:update"),
  getStaffMonthlyAdjustments,
);

router.post(
  "/process",
  authVerifyJWT,
  checkPermission("payroll:create"),
  calculatePayroll
);
router.post("/staff/calculate", authVerifyJWT, calculateStaffPayroll);
router.patch(
  "/mark-paid",
  authVerifyJWT,
  checkPermission("payroll:update"),
  markPayrollAsPaid
);
router.get("/staff/month", authVerifyJWT, getStaffPayroll);
router.get("/hr/staff/month", authVerifyJWT, getStaffPayroll);
router.get(
  "/staff/month/all",
  authVerifyJWT,
  checkPermission("payroll:view"),
  getPayrollSummaryForHR
);
router.get(
  "/overview",
  authVerifyJWT,
  checkPermission("payroll:view", "staff:create", "staff:update"),
  getPayrollOverview
);
router.post("/staff/salary-slip", authVerifyJWT, downloadSalarySlip);

export default router;
