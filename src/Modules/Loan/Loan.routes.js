import express from "express";
import {
  addManualLoanDeduction,
  applyLoan,
  approveLoan,
  createLoanType,
  deleteLoan,
  deleteLoanType,
  editLoan,
  getLoanById,
  getLoanHistory,
  getLoanTypes,
  listLoans,
  markLoanEmiPaid,
  setupLoanEmi,
  updateLoanStatus,
  updateLoanType,
  viewLoanEmi,
} from "./Loan.controler.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import { checkPermission } from "../../Middlewares/checkPermission.js";

const router = express.Router();

router.post(
  "/loan-types",
  authVerifyJWT,
  checkPermission("loan:setting"),
  createLoanType
);
router.get("/loan-types", authVerifyJWT, getLoanTypes);
router.patch(
  "/loan-types/update/:id",
  authVerifyJWT,
  checkPermission("loan:setting"),
  updateLoanType
);
router.delete(
  "/loan-types/delete/:id",
  authVerifyJWT,
  checkPermission("loan:setting"),
  deleteLoanType
);
// Employee Loan
router.post("/apply-loans", authVerifyJWT, applyLoan);
router.post(
  "/admin/apply-loans",
  authVerifyJWT,
  checkPermission("loan:create"),
  applyLoan
);
router.get(
  "/employee-loans",
  authVerifyJWT,
  checkPermission("loan:view"),
  listLoans
);
router.get(
  "/employee-loans/:id",
  authVerifyJWT,
  checkPermission("loan:view"),
  getLoanById
);

router.get("/my-history", authVerifyJWT, getLoanHistory);
router.patch(
  "/employee-loans/:loanId/approve",
  authVerifyJWT,
  checkPermission("loan:update"),
  updateLoanStatus
);
router.patch(
  "/employee-loans/:loanId/edit",
  authVerifyJWT,
  checkPermission("loan:update"),
  editLoan,
);

router.delete(
  "/employee-loans/:loanId",
  authVerifyJWT,
  checkPermission("loan:delete"),
  deleteLoan,
);
router.patch(
  "/emi-setup/:loanId",
  authVerifyJWT,
  checkPermission("loan:update"),
  setupLoanEmi
);
router.patch(
  "/deduct",
  authVerifyJWT,
  checkPermission("loan:update"),
  addManualLoanDeduction,
);
router.patch(
  "/employee-loans/:loanId/emi/:emiId/pay",
  authVerifyJWT,
  checkPermission("loan:update"),
  markLoanEmiPaid
);

router.get("/view-emi/:loanId", authVerifyJWT, viewLoanEmi);

export default router;
