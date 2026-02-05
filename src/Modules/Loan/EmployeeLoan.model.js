import mongoose from "mongoose";

const employeeLoanSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    loanType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanType",
    },
    loanAmount: { type: Number, required: true },
    durationMonths: { type: Number },
    reason: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Closed"],
      default: "Pending",
    },
    emiAmount: { type: Number }, // monthly EMI
    remainingAmount: { type: Number }, // outstanding balance
    emiSchedule: [
      {
        month: Number, // e.g., 1, 2, 3...
        dueDate: Date,
        amount: Number,
        status: {
          type: String,
          enum: ["Pending", "Paid", "Closed"],
          default: "Pending",
        },
        paidDate: { type: Date }, // when marked as paid
      },
    ],
  },
  { timestamps: true },
);

const EmployeeLoan = mongoose.model("EmployeeLoan", employeeLoanSchema);
export default EmployeeLoan;
