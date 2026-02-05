export const leaveApplicationTemplate = ({
  staffName,
  employeeCode,
  department,
  leaveType,
  startDate,
  endDate,
  totalDays,
  reason,
}) => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
      <h3>Leave Application Request</h3>

      <p>Dear Sir/Madam,</p>

      <p>
        This is to inform you that <strong>${staffName}</strong> has applied for leave.
        Below are the details:
      </p>

      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <tr>
          <td><strong>Employee Name</strong></td>
          <td>${staffName}</td>
        </tr>
        <tr>
          <td><strong>Employee ID</strong></td>
          <td>${employeeCode}</td>
        </tr>
        <tr>
          <td><strong>Department</strong></td>
          <td>${department}</td>
        </tr>
        <tr>
          <td><strong>Leave Type</strong></td>
          <td>${leaveType}</td>
        </tr>
        <tr>
          <td><strong>Leave Period</strong></td>
          <td>${startDate} to ${endDate}</td>
        </tr>
        <tr>
          <td><strong>Total Days</strong></td>
          <td>${totalDays}</td>
        </tr>
        <tr>
          <td><strong>Reason</strong></td>
          <td>${reason}</td>
        </tr>
        <tr>
          <td><strong>Status</strong></td>
          <td>Pending Approval</td>
        </tr>
      </table>

      <p style="margin-top: 16px;">
        Kindly review and take the necessary action.
      </p>

      <p>
        Regards,<br/>
        <strong>HR Management System</strong>
      </p>
    </div>
  `;
};


export const otpResetPasswordTemplate = ({
  otp,
  staffEmail,
  expiryMinutes = 10,
}) => {
  return `
    <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:30px;">
      <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08);">
        
        <div style="background:#0f172a; padding:18px 22px;">
          <h2 style="margin:0; color:#ffffff; font-size:18px; letter-spacing:0.3px;">
            Password Reset OTP
          </h2>
        </div>

        <div style="padding:24px 22px;">
          <p style="margin:0 0 10px; font-size:14px; color:#334155;">
            Hello,
          </p>

          <p style="margin:0 0 14px; font-size:14px; color:#334155; line-height:1.6;">
            We received a request to reset your password for <b>${staffEmail}</b>.
            Use the OTP below to continue.
          </p>

          <div style="text-align:center; margin:18px 0;">
            <div style="display:inline-block; background:#f1f5f9; border:1px dashed #94a3b8; padding:14px 22px; border-radius:12px;">
              <span style="font-size:26px; font-weight:700; color:#0f172a; letter-spacing:6px;">
                ${otp}
              </span>
            </div>
          </div>

          <p style="margin:0 0 14px; font-size:13px; color:#475569; line-height:1.6;">
            This OTP will expire in <b>${expiryMinutes} minutes</b>.
          </p>

          <div style="background:#fff7ed; border:1px solid #fdba74; padding:12px 14px; border-radius:12px;">
            <p style="margin:0; font-size:13px; color:#9a3412; line-height:1.5;">
              ⚠️ Do not share this OTP with anyone. Our team will never ask for it.
            </p>
          </div>

          <p style="margin:18px 0 0; font-size:12px; color:#64748b;">
            If you didn’t request this, you can safely ignore this email.
          </p>
        </div>

        <div style="padding:14px 22px; background:#f8fafc; border-top:1px solid #e2e8f0;">
          <p style="margin:0; font-size:12px; color:#94a3b8;">
            © ${new Date().getFullYear()} HR Management System
          </p>
        </div>
      </div>
    </div>
  `;
};

export const adminDisable2FATemplate = ({ otp, email, expiryMinutes = 10 }) => {
  return `
    <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:30px;">
      <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08);">
        
        <div style="background:#0f172a; padding:18px 22px;">
          <h2 style="margin:0; color:#ffffff; font-size:18px;">
            Disable 2FA OTP
          </h2>
        </div>

        <div style="padding:24px 22px;">
          <p style="margin:0 0 10px; font-size:14px; color:#334155;">
            Hello Admin,
          </p>

          <p style="margin:0 0 14px; font-size:14px; color:#334155; line-height:1.6;">
            You requested to disable 2FA for <b>${email}</b>.
            Use the OTP below to continue:
          </p>

          <div style="text-align:center; margin:18px 0;">
            <div style="display:inline-block; background:#f1f5f9; border:1px dashed #94a3b8; padding:14px 22px; border-radius:12px;">
              <span style="font-size:26px; font-weight:700; color:#0f172a; letter-spacing:6px;">
                ${otp}
              </span>
            </div>
          </div>

          <p style="margin:0 0 14px; font-size:13px; color:#475569;">
            This OTP will expire in <b>${expiryMinutes} minutes</b>.
          </p>

          <div style="background:#fff7ed; border:1px solid #fdba74; padding:12px 14px; border-radius:12px;">
            <p style="margin:0; font-size:13px; color:#9a3412;">
              ⚠️ Do not share this OTP with anyone.
            </p>
          </div>

          <p style="margin:18px 0 0; font-size:12px; color:#64748b;">
            If you didn’t request this, ignore this email.
          </p>
        </div>

        <div style="padding:14px 22px; background:#f8fafc; border-top:1px solid #e2e8f0;">
          <p style="margin:0; font-size:12px; color:#94a3b8;">
            © ${new Date().getFullYear()} HR Management System
          </p>
        </div>
      </div>
    </div>
  `;
};
