// models/LeaveType.js
import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    maxDaysPerYear: {
      type: Number,
      required: true, 
      min: 0,
    },

    carryForward: {
      type: Boolean,
      default: false,
    },

    isPaid: {
      type: Boolean,
      default: true,
    },

    accrualType: {
      type: String,
      enum: ["monthly","yearly", null],
      default: null,
    },

    accrualRate: {
      type: Number,
      default: 0, // e.g. 0.5 per month
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

const LeaveType = mongoose.model("LeaveType", leaveTypeSchema);
export default LeaveType;
