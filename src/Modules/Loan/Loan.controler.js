import mongoose from "mongoose";
import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import Staff from "../Staff/Staff.model.js";
import EmployeeLoan from "./EmployeeLoan.model.js";
import LoanType from "./LoanType.model.js";
import { Admin } from "../Admin/Admin.Model.js";
import { createNotification } from "../Notification/Notification.controler.js";
import { emitNotification } from "../../Utils/sseManager.js";
import MonthlyAdjustment from "../../Modules/Payroll/Deduction/MonthlyAdjustment.modal.js";

export const createLoanType = asyncHandler(async (req, res) => {
  const loanType = await LoanType.create(req.body);
  res
    .status(201)
    .json(new ApiResponse(201, loanType, "Loan type created successfully"));
});

export const getLoanTypes = asyncHandler(async (req, res) => {
  const loanTypes = await LoanType.find();
  res.json(new ApiResponse(200, loanTypes, "Loan types fetched successfully"));
});

export const updateLoanType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedLoanType = await LoanType.findByIdAndUpdate(id, req.body, {
    new: true, // return the updated document
    runValidators: true, // validate updates
  });

  if (!updatedLoanType) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Loan type not found"));
  }

  res.json(
    new ApiResponse(200, updatedLoanType, "Loan type updated successfully")
  );
});

export const deleteLoanType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedLoanType = await LoanType.findByIdAndDelete(id);

  if (!deletedLoanType) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Loan type not found"));
  }

  res.json(
    new ApiResponse(200, deletedLoanType, "Loan type deleted successfully")
  );
});
export const applyLoan = asyncHandler(async (req, res) => {
  const {  loanAmount, reason, staffId } = req.body;

  let finalStaffId;
  const appliedByRole = req.user.role;


  // 👤 STAFF → only self
  if (appliedByRole !== "admin") {
    finalStaffId = req.user.id;
  }

  if (appliedByRole === "admin") {
    if (!staffId) {
      throw new ApiError(400, "staffId is required when admin applies");
    }
    finalStaffId = staffId;
  }

  const staff = await Staff.findById(finalStaffId);
  if (!staff) throw new ApiError(404, "Staff not found");


 
 
  const loan = await EmployeeLoan.create({
    staff: staff._id,
    loanAmount,
    reason,
    appliedBy: req.user.id,
  });

  if (appliedByRole !== "admin") {
    const admins = await Admin.find({ isAdmin: true }).select("_id");

    if (admins.length > 0) {
      await createNotification({
        title: "💰 New Loan Request",
        message: `${staff.staff_name} applied for a loan of ₹${loanAmount}.`,
        createdByStaff: staff._id,
        audienceType: "admin",
        targetAdmins: admins.map((a) => a._id),
        sendAt: new Date(),
        meta: {
          type: "loan",
          loanId: loan._id,
          staffId: staff._id,
        },
      });

      
      emitNotification({
        audienceType: "admin",
        payload: {
          type: "loan",
          loanId: loan._id,
        },
      });
    }
  }

  // 🟢 CASE 2: ADMIN applied → notify STAFF
  if (appliedByRole === "admin") {
    await createNotification({
      title: "💰 Loan Applied by HR",
      message: `A loan of ₹${loanAmount} has been applied on your behalf.`,
      createdByAdmin: req.user.id,
      audienceType: "individual",
      targetStaff: [staff._id],
      sendAt: new Date(),
      meta: {
        type: "loan",
        loanId: loan._id,
      },
    });

    // 🔔 SSE → STAFF ONLY
    emitNotification({
      audienceType: "individual",
      staffIds: [staff._id],
      payload: {
        type: "loan",
        loanId: loan._id,
      },
    });
  }

  /* ================= RESPONSE ================= */

  res
    .status(201)
    .json(new ApiResponse(201, loan, "Loan request submitted successfully"));
});

export const listLoans = asyncHandler(async (req, res) => {
  const loans = await EmployeeLoan.find({}, { emiSchedule: 0 })
    .populate("staff", "staff_name personalemail basic_salary joining_date")
    .populate("loanType", "name") // ✅ THIS LINE
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, loans, "Loans fetched successfully"));
});

export const getLoanById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const loan = await EmployeeLoan.findById(id)
    .populate(
      "staff",
      "staff_name staff_id personalemail basic_salary joining_date"
    ) // populate staff info
    .populate("loanType", "name minServiceYears maxAmountMultiplier"); // populate loan type info

  if (!loan) {
    throw new ApiError(404, "Loan not found");
  }

  res.status(200).json(new ApiResponse(200, loan, "Loan fetched successfully"));
});

export const getLoanHistory = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  // ✅ All loans for this staff (latest first)
  const loans = await EmployeeLoan.find({ staff: staffId })
    .populate("loanType", "name")
    .sort({ createdAt: -1 }); // 👈 latest first

  // ✅ Aggregated summary
  const summary = await EmployeeLoan.aggregate([
    { $match: { staff: new mongoose.Types.ObjectId(staffId) } },
    {
      $group: {
        _id: "$status",
        totalAmount: { $sum: "$loanAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  // Convert into clean object
  const history = {
    Approved: { totalAmount: 0, count: 0 },
    Pending: { totalAmount: 0, count: 0 },
    Rejected: { totalAmount: 0, count: 0 },
  };

  summary.forEach((s) => {
    history[s._id] = {
      totalAmount: s.totalAmount,
      count: s.count,
    };
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { loans, history },
        "Loan history fetched successfully"
      )
    );
});

export const approveLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  // Find loan and populate related staff and loanType
  const loan = await EmployeeLoan.findById(loanId).populate("loanType staff");
  if (!loan) throw new ApiError(404, "Loan not found");

  if (loan.status === "Approved") {
    throw new ApiError(400, "Loan is already approved");
  }

  // Only update status
  loan.status = "Approved";
  await loan.save();

  res.json(new ApiResponse(200, loan, "Loan approved successfully"));
});

// controllers/loanController.js
export const updateLoanStatus = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { action } = req.body; // "approve" | "reject"

  /* ================= FIND LOAN ================= */
  const loan = await EmployeeLoan.findById(loanId).populate("loanType staff");
  if (!loan) throw new ApiError(404, "Loan not found");

  let newStatus;
  let notificationTitle;
  let notificationMessage;

  /* ================= STATUS LOGIC ================= */
  if (action === "approve") {
    if (loan.status === "Approved") {
      throw new ApiError(400, "Loan is already approved");
    }

    loan.status = "Approved";
    newStatus = "approved";

    notificationTitle = "✅ Loan Approved";
    notificationMessage = `Your loan of ₹${loan.loanAmount} has been approved.`;
  } else if (action === "reject") {
    if (loan.status === "Rejected") {
      throw new ApiError(400, "Loan is already rejected");
    }
    if (loan.status === "Approved") {
      throw new ApiError(400, "Approved loan cannot be rejected");
    }

    loan.status = "Rejected";
    newStatus = "rejected";

    notificationTitle = "❌ Loan Rejected";
    notificationMessage = `Your loan request of ₹${loan.loanAmount} has been rejected.`;
  } else {
    throw new ApiError(400, "Invalid action");
  }

  await loan.save();

  /* ================= NOTIFY STAFF ================= */
  await createNotification({
    title: notificationTitle,
    message: notificationMessage,
    createdByAdmin: req.user.id,
    audienceType: "individual",
    targetStaff: [loan.staff._id],
    sendAt: new Date(),
    meta: {
      type: "loan",
      loanId: loan._id,
      status: loan.status,
    },
  });

  /* ================= REALTIME EMIT ================= */
  emitNotification({
    audienceType: "individual",
    staffIds: [loan.staff._id],
    payload: {
      type: "loan",
      loanId: loan._id,
      status: loan.status,
    },
  });

  /* ================= RESPONSE ================= */
  res.json(new ApiResponse(200, loan, `Loan ${newStatus} successfully`));
});

export const setupLoanEmi = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { durationMonths, startDate } = req.body;

  const loan = await EmployeeLoan.findById(loanId)
    .populate("staff", "staff_name staff_id phone basic_salary")
    .populate(
      "loanType",
      "name minServiceYears maxAmountMultiplier interestRate"
    );

  if (!loan) throw new ApiError(404, "Loan not found");
 if (loan.status === "Rejected") {
   throw new ApiError(400, "Cannot create EMI for a rejected loan");
 }
  if (!durationMonths || durationMonths <= 0) {
    throw new ApiError(400, "Invalid durationMonths");
  }

  // ✅ Equal EMI with decimals
  const rawEmi = loan.loanAmount / durationMonths;

  // fix to 2 decimals
  const emiAmount = Number(rawEmi.toFixed(2));

  const schedule = [];
  const firstDate = new Date(startDate || Date.now());

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = new Date(firstDate);
    dueDate.setMonth(firstDate.getMonth() + i);

    schedule.push({
      month: i + 1,
      dueDate,
      amount: emiAmount,
      status: "Pending",
    });
  }

  loan.durationMonths = durationMonths;
  loan.emiAmount = emiAmount;
  loan.remainingAmount = loan.loanAmount;
  loan.emiSchedule = schedule;

  await loan.save();

  res.json(new ApiResponse(200, loan, "✅ EMI schedule created successfully"));
});
export const addManualLoanDeduction = asyncHandler(async (req, res) => {
  const { loanId, month, amount } = req.body;

  if (!loanId || !month || !amount) {
    throw new ApiError(400, "loanId, month and amount are required");
  }

  const loan = await EmployeeLoan.findById(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  if (loan.status !== "Approved") {
    throw new ApiError(400, "Loan is not approved");
  }

 
  await MonthlyAdjustment.create({
    staffId: loan.staff,
    month,
    type: "deduction",
    title: "Loan Deduction",
    amount: Number(amount),
  });

 
  loan.remainingAmount =
    (loan.remainingAmount ?? loan.loanAmount) - Number(amount);

  if (loan.remainingAmount <= 0) {
    loan.remainingAmount = 0;
    loan.status = "Closed";
  }

  await loan.save();

  res.json(
    new ApiResponse(200, loan, "Manual loan deduction added (payroll-based)"),
  );
});


export const viewLoanEmi = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  const loan = await EmployeeLoan.findById(loanId)
    .populate("staff", "staff_name staff_id basic_salary")
    .populate("loanType", "name maxAmountMultiplier minServiceYears");

  if (!loan) throw new ApiError(404, "Loan not found");

  if (!loan.emiSchedule || loan.emiSchedule.length === 0) {
    throw new ApiError(400, "EMI schedule not set for this loan");
  }

  res.json(
    new ApiResponse(
      200,
      {
        loanId: loan._id,
        staff: loan.staff,
        loanType: loan.loanType,
        loanAmount: loan.loanAmount,
        durationMonths: loan.durationMonths,
        emiAmount: loan.emiAmount,
        remainingAmount: loan.remainingAmount,
        status: loan.status,
        emiSchedule: loan.emiSchedule,
      },
      "Loan EMI details fetched successfully"
    )
  );
});

export const markLoanEmiPaid = asyncHandler(async (req, res) => {
  const { loanId, emiId } = req.params;

  const loan = await EmployeeLoan.findById(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  const emi = loan.emiSchedule.id(emiId);
  if (!emi) throw new ApiError(404, "EMI not found");

  if (emi.status === "Paid") {
    throw new ApiError(400, "EMI already paid");
  }

  // ✅ Mark paid
  emi.status = "Paid";
  emi.paidAt = new Date();

  // ✅ Reduce remaining amount
  loan.remainingAmount = Number(
    Math.max(loan.remainingAmount - emi.amount, 0).toFixed(2)
  );

  // ✅ Auto close loan
  if (loan.remainingAmount === 0) {
    loan.status = "Closed";
  }

  await loan.save();

  res.json(
    new ApiResponse(
      200,
      {
        loanId,
        emiId,
        remainingAmount: loan.remainingAmount,
        status: loan.status,
      },
      "✅ EMI marked as paid"
    )
  );
});

export const editLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { loanAmount, reason } = req.body;

  const loan = await EmployeeLoan.findById(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  if (loan.status === "Approved") {
    throw new ApiError(400, "Approved loan cannot be edited");
  }

  if (loanAmount !== undefined) {
    if (loanAmount <= 0) {
      throw new ApiError(400, "Invalid loan amount");
    }
    loan.loanAmount = loanAmount;
  }

  if (reason !== undefined) {
    loan.reason = reason;
  }

  await loan.save();

  res.json(new ApiResponse(200, loan, "Loan updated successfully"));
});

export const deleteLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  const loan = await EmployeeLoan.findById(loanId);
  if (!loan) throw new ApiError(404, "Loan not found");

  if (loan.status === "Approved") {
    throw new ApiError(400, "Approved loan cannot be deleted");
  }

  await loan.deleteOne();

  res.json(new ApiResponse(200, null, "Loan deleted successfully"));
});
