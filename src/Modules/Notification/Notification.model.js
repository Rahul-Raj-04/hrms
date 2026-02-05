import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    // ====== Recipients ======
    staffRecipients: [
      {
        type: Schema.Types.ObjectId,
        ref: "Staff", // Individual staff
      },
    ],
    departmentRecipients: [
      {
        type: Schema.Types.ObjectId,
        ref: "Department", // Whole department
      },
    ],
    hrRecipients: [
      {
        type: Schema.Types.ObjectId,
        ref: "Hr", // For HR notifications
      },
    ],

    adminRecipients: [
      {
        type: Schema.Types.ObjectId,
        ref: "Admin",
      },
    ],

    allStaff: {
      type: Boolean,
      default: false, // true = broadcast to all staff
    },

    // ====== Created By ======
    createdByHr: {
      type: Schema.Types.ObjectId,
      ref: "Hr",
      default: null,
    },
    createdByStaff: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    readByAdmins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
    ],

    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },

    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },

    clearedByStaff: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }],
    clearedByHr: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hr" }],
    clearedByAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: "Admin" }],
    priority: {
      type: String,
      enum: ["low", "normal", "high", "critical"],
      default: "normal",
    },
    sendAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    readBy: [{ type: Schema.Types.ObjectId, ref: "Staff" }],
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Auto delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
