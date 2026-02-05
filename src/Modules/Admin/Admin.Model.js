import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";   

const { Schema } = mongoose;
const adminSchema = new Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    phoneNumber: { type: String },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    loginTime: { type: Date },
    designation: { type: String },
    website: { type: String },
    city: { type: String },
    state: { type: String },
    address: { type: String },
    postalCode: { type: String },
    username: { type: String, required: true, unique: true },
    profilePhoto: { type: String },
    portfolioLink: { type: String },
    loginHistory: [{ type: Date }],
    refreshToken: { type: String },
    forgotOtp: { type: String, default: null },
    forgotOtpExpires: { type: Date, default: null },

    isAdmin: { type: Boolean, default: true },
    two_factor_enabled: { type: Boolean, default: false },
    two_factor_verified: { type: Boolean, default: false },
    two_factor_secret: { type: String, default: null },
    two_factor_recovery_otp: { type: String, default: null },
    two_factor_recovery_expires: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});
adminSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};


export const Admin = mongoose.model("Admin", adminSchema);