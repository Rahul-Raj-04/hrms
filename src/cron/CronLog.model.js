// Modules/Cron/CronLog.model.js
import mongoose from "mongoose";

const cronLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    key: { type: String, required: true }, 
    ranAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

cronLogSchema.index({ type: 1, key: 1 }, { unique: true });

export default mongoose.model("CronLog", cronLogSchema);
