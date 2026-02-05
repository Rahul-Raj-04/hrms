// models/StaffLeaveBalance.js
import mongoose from "mongoose";

const staffLeaveBalanceSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
    },

    totalAssigned: {
      type: Number,
      required: true,
      min: 0,
    },

    used: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

staffLeaveBalanceSchema.index({ staff: 1, leaveType: 1 }, { unique: true });

export const StaffLeaveBalance = mongoose.model(
  "StaffLeaveBalance",
  staffLeaveBalanceSchema
);
