import mongoose from "mongoose";

const AttendanceLogSchema = new mongoose.Schema(
  {
    staff_doc_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    staff_id: String,
    staff_name: String,
    recognized_at: Date,
    confidence: Number,
    image_url: String,
    source: String,
    marked_by: {
      id: mongoose.Schema.Types.ObjectId,
      name: String,
    },
  },
  {
    collection: "attendance_logs",
    timestamps: false,
  }
);

const AttendanceLog = mongoose.model("AttendanceLog", AttendanceLogSchema);

export default AttendanceLog;
