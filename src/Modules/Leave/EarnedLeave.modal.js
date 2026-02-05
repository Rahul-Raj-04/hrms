import mongoose from "mongoose";

const EarnedLeave = new mongoose.Schema(
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
    year: {
      type: Number,
      required: true,
    },
    earnedDays: {
      type: Number,
      default: 0,
    },
    lastAccruedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("EarnedLeaveBalance", EarnedLeave);
