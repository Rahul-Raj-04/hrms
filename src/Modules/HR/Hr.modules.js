import mongoose from "mongoose";

const HrSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    role: {
      type: String,
      default: "HR",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    refreshToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const Hr = mongoose.model("Hr", HrSchema);

export default Hr;
