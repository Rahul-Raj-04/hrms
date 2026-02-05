// Utils/emailTemplates/staffInviteTemplate.js

export const staffInviteTemplate = ({ staffName, loginEmail, loginUrl }) => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
      <h3>Staff Portal Invitation</h3>

      <p>Dear ${staffName},</p>

      <p>
        You have been invited to access the <strong>Staff Management System</strong>.
        Please find your login details below:
      </p>

      <table border="1" cellpadding="8" cellspacing="0"
        style="border-collapse: collapse; width: 100%;">
        <tr>
          <td><strong>Portal URL</strong></td>
          <td>
            <a href="${loginUrl}" target="_blank">${loginUrl}</a>
          </td>
        </tr>
        <tr>
          <td><strong>Login Email</strong></td>
          <td>${loginEmail}</td>
        </tr>
        <tr>
          <td><strong>Access</strong></td>
          <td>Staff Panel</td>
        </tr>
        <tr>
          <td><strong>Status</strong></td>
          <td>Active</td>
        </tr>
      </table>

      <p style="margin-top: 16px;">
        Please login using your existing password.
        <br/>
        We recommend changing your password after first login.
      </p>

      <p>
        Regards,<br/>
        <strong>HR Management System</strong>
      </p>
    </div>
  `;
};
