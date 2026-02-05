// import mongoose from "mongoose";

// const loanPaymentSchema = new mongoose.Schema(
//   {
//     employeeLoan: { type: mongoose.Schema.Types.ObjectId, ref: "EmployeeLoan", required: true },
//     month: { type: Number, required: true },
//     amount: { type: Number, required: true },
//     status: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
//     paidAt: { type: Date },
//   },
//   { timestamps: true }
// );

// const LoanPayment = mongoose.model("LoanPayment", loanPaymentSchema);
// export default LoanPayment;
