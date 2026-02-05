import mongoose from "mongoose";

const MonthlyAdjustmentSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    month: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["earning", "deduction"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    applied: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

MonthlyAdjustmentSchema.index({ staffId: 1, month: 1 });


export default mongoose.model("MonthlyAdjustment", MonthlyAdjustmentSchema);
