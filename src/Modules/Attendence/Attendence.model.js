import mongoose from "mongoose";

const workSessionSchema = new mongoose.Schema(
  {
    start_time: { type: Date, required: true },
    end_time: { type: Date },
  },
  { _id: false }
);

const breakSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Lunch", "Bio", "Short"],
      required: true,
    },
    start_time: { type: Date, required: true },
    end_time: { type: Date },
    duration: { type: Number }, // in minutes
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    date: { type: Date, required: true, immutable: true },

    status: {
      type: String,
      enum: ["Present", "Absent", "Leave", "Half-Day", "Week-Off", "Fine"],
      required: true,
    },
    mark_source: {
      type: String,
      enum: ["FACE", "PANEL", "AUTO_PUNCHOUT_CRON"],
    },

    marked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    work_sessions: [workSessionSchema],

    breaks: [breakSchema],

    check_in: { type: Date },
    check_out: { type: Date },
    working_hours: { type: Number },
    manual_working_hours: { type: Number, default: null },

    manual_working_hours_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },

    manual_working_hours_at: { type: Date, default: null },

    is_late: { type: Boolean, default: false },
    late_by_minutes: { type: Number, default: 0 },
    overtime_hours: { type: Number, default: 0 },
    fine: { type: Number, default: 0 },
    has_fine: {
      type: Boolean,
      default: false,
    },
    remarks: { type: String },
  },
  { timestamps: true },
);

attendanceSchema.index({ staff: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
