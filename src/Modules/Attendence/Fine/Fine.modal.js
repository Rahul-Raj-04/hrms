import mongoose from "mongoose";

const fineSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },

    date: {
      type: Date,
      required: true,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },
    rule_key: {
      type: String,
      required: true,
    },

    type: { type: String, required: true },

    minutes: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      default: 0,
    },

    action: {
      type: String,
      enum: ["PARDON", "DEDUCT"],
      default: "PARDON",
    },

    approved: {
      type: Boolean,
      default: false,
    },

    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    category: {
      type: String,
      enum: ["TIME_ATTENDANCE", "BREAK", "LEAVE_ABSENCE", "DISCIPLINE_POLICY"],
    },
    is_active: {
      type: Boolean,
      default: true,
    },

    approved_at: Date,

    remarks: String,
  },
  { timestamps: true }
);

fineSchema.index({ staff: 1, date: 1 });

const Fine = mongoose.model("Fine", fineSchema);
export default Fine;
