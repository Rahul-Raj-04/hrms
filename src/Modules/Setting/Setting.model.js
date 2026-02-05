import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    smtpConfig: {
      host: { type: String, default: "smtp.example.com" },
      port: { type: Number, default: 587 },
      username: { type: String, default: "user@example.com" },
      password: { type: String, default: "password123" },
      fromEmail: { type: String, default: "no-reply@example.com" },
    },
    companyPolicy: {
      currentVersion: { type: Number, default: 0 },

      versions: [
        {
          title: { type: String, required: true },
          version: Number,
          pdf_url: String,
          uploaded_at: Date,
          uploaded_by: {
            type: mongoose.Schema.Types.ObjectId,
          },
        },
      ],
    },
  },
  { timestamps: true }
);

export const Setting = mongoose.model("Setting", settingSchema);
