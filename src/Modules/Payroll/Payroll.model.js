import mongoose from "mongoose";

const PayrollSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    staff_name: {
      type: String,
      required: true,
      trim: true,
    },
    month: { type: String, required: true }, // YYYY-MM
    gross_salary: { type: Number, required: true },
    staff_code: {
      type: String,
      required: true,
    },

    earnings: [
      {
        title: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
    deductions: [
      {
        title: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
    total_earnings: { type: Number, required: true },
    net_salary: { type: Number, required: true },
    attendance: {
      present: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
      weeklyOff: { type: Number, default: 0 },
      halfDays: { type: Number, default: 0 },
      overtime: { type: String, default: "0:00" },
      fine: { type: String, default: "0:00" },
      payableDays: { type: Number, default: 0 },
    },
    leave: {
      total: { type: Number, default: 0 },
      weeklyOff: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["Processed", "Paid", "Pending"],
      default: "Processed",
    },
  },
  { timestamps: true }
);

const Payroll = mongoose.model("Payroll", PayrollSchema);
export default Payroll;
