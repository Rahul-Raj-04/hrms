import mongoose from "mongoose";

const cashbookSchema = new mongoose.Schema(
  {
    // existing
    type: {
      type: String,
      enum: ["Paid", "Received"],
      required: true,
    },
    name: { type: String, required: true }, // expense title
    amount: { type: Number, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    isStaffExpense: {
      type: Boolean,
      default: false,
      index: true,
    },

    category: {
      type: String,
      enum: ["Travel", "Food", "Office", "Other"],
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected","Paid"],
      default: "Pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff", // admin
    },
    proofs: [
      {
        url: String,
        publicId: String,
      },
    ],

    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Cashbook", cashbookSchema);
