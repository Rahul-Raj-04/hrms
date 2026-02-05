import mongoose from "mongoose";

const holidayTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Template name
    startMonth: { type: Number, required: true, min: 1, max: 12 }, // 1-12 for Jan-Dec
    endMonth: { type: Number, required: true, min: 1, max: 12 }, // 1-12 for Jan-Dec
    holidays: [{ type: mongoose.Schema.Types.ObjectId, ref: "Holiday" }], // List of holiday references
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Hr", required: true },
  },
  { timestamps: true }
);

const HolidayTemplate = mongoose.model("HolidayTemplate", holidayTemplateSchema);
export default HolidayTemplate;
