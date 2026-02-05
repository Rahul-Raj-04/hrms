import mongoose from "mongoose";

const weeklyHolidaySchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Hr", required: true },
    day: {
      type: String,
      enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: true,
    },
  },
  { timestamps: true }
);

const WeeklyHoliday = mongoose.model("WeeklyHoliday", weeklyHolidaySchema);
export default WeeklyHoliday;
