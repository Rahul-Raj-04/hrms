import mongoose from "mongoose";

const SalaryComponentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["earning", "deduction"], required: true },
    mandatory: { type: Boolean, default: false },
    rule: { type: String }, 
  },
  { timestamps: true }
);

const SalaryComponent = mongoose.model(
  "SalaryComponent",
  SalaryComponentSchema
);
export default SalaryComponent;
