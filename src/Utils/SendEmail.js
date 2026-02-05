import nodemailer from "nodemailer";
import { Setting } from "../Modules/Setting/Setting.model.js";

const sendEmail = async (options) => {
  const websiteSetting = await Setting.findOne();
  if (!websiteSetting?.smtpConfig) {
    throw new Error("SMTP settings are not configured.");
  }

  const { host, port, username, password, fromEmail } =
    websiteSetting.smtpConfig;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: username,
      pass: password,
    },
  });

  const mailOptions = {
    from: fromEmail,

    // ✅ OLD SUPPORT (OTP, simple emails)
    to: options.email || options.to,
    subject: options.subject,

    // ✅ NEW SUPPORT (HTML templates)
    text: options.message || undefined,
    html: options.html || undefined,

    // ✅ Optional
    cc: options.cc || undefined,
    bcc: options.bcc || undefined,
  };

  await transporter.verify();
  await transporter.sendMail(mailOptions);
};

export default sendEmail;
