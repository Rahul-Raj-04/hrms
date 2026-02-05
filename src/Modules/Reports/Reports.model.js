import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "createdByModel",
  },

  createdByModel: {
    type: String,
    required: true,
    enum: ["Admin", "Staff"],
  },

  createdAt: { type: Date, default: Date.now },
  expirationDate: { type: Date, required: true },
});

const Report = mongoose.model("Report", reportSchema);
export default Report;
