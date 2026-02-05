import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Day Shift",
    },
    startTime: {
      type: String,
      required: true,
      default: "10:00",
    },
    endTime: {
      type: String,
      required: true,
      default: "19:00",
    },
    bufferMinutes: {
      type: Number,
      default: 0,
    },
    allowedBreakMinutes: {
      type: Number,
      default: 70,
    },

    description: {
      type: String,
      default: "Day shift 10 to 7",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    staff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
      },
    ],
  },
  { timestamps: true },
);

const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;
