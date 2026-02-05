import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    audienceType: {
      type: String,
      enum: ["all", "department", "individual"],
      default: "all"
    },
    targetDepartments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    targetStaff: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }],
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

announcementSchema.pre("save", function (next) {
  const now = new Date();

  if (this.expiryDate && this.expiryDate < now) {
    this.isActive = false;
  } else {
    this.isActive = true;
  }

  next();
});



const Announcement = mongoose.model("Announcement", announcementSchema);
export default Announcement;
