import mongoose from "mongoose";

const leaveApplicationSchema = new mongoose.Schema(
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
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startSession: {
      type: String,
      enum: ["Morning", "Evening"],
      default: null,
    },
    endSession: {
      type: String,
      enum: ["Morning", "Evening"],
      default: null,
    },

    days: { type: Number },
    reason: { type: String },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    attachment: {
      url: { type: String, default: null },
      key: { type: String, default: null },
    },

    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "actionByModel",
      default: null,
    },
    actionByModel: {
      type: String,
      enum: ["Staff", "Admin"],
      default: null,
    },

    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

const LeaveApplication = mongoose.model(
  "LeaveApplication",
  leaveApplicationSchema
);
export default LeaveApplication;
