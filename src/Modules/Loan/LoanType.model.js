import mongoose from "mongoose";

const loanTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    minServiceYears: { type: Number,  },
    maxAmountMultiplier: { type: Number, },

  },
  { timestamps: true }
);

const LoanType = mongoose.model("LoanType", loanTypeSchema);
export default LoanType;
