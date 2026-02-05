export const salarySlipTemplate = (record) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Salary Slip</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, sans-serif; }
    body { font-size: 12px; color: #111; }
    .container {
      position: relative;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
    }
    .watermark {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .watermark span {
      font-size: 64px;
      font-weight: bold;
      color: #d1d5db;
      opacity: 0.3;
      transform: rotate(-30deg);
      white-space: nowrap;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h2 {
      margin: 0;
      font-size: 18px;
    }
    .header p {
      margin: 2px 0 0;
      font-size: 11px;
      color: #555;
    }
    .title {
      text-align: center;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 6px;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      text-align: center;
    }
    td { text-align: center; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .right { text-align: right; }
    .bold { font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="watermark">
      <span>WISH GEEKS TECHSERVE</span>
    </div>

    <div class="header">
      <div>
        <h2>Wish Geeks Techserve Pvt Ltd</h2>
        <p>A-13 A, Sector 62, Noida, Uttar Pradesh</p>
      </div>
      <img src="${record.companyLogo}" height="48" />
    </div>

    <div class="title">
      Salary Slip (${record.monthData.startDate} - ${record.monthData.endDate})
    </div>

    <div class="box">
      <div>
        <div>${record.employee.name}</div>
        <div>Designation: ${record.employee.designation}</div>
        <div>Department: ${record.employee.department}</div>
        <div>Joining: ${record.employee.joiningDate}</div>
      </div>
      <div>
        <div>Phone: ${record.employee.phone}</div>
        <div>Gross Salary: ₹${record.employee.grossSalary.toFixed(2)}</div>
        <div>Emp ID: ${record.employee.empId}</div>
        <div>PAN: ${record.employee.pan}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Present</th>
          <th>Absent</th>
          <th>Weekly Off</th>
          <th>Half Days</th>
          <th>Overtime</th>
          <th>Fine</th>
          <th>Payable Days</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${record.monthData.attendance.present}</td>
          <td>${record.monthData.attendance.absent}</td>
          <td>${record.monthData.attendance.weeklyOff}</td>
          <td>${record.monthData.attendance.halfDays}</td>
          <td>${record.monthData.attendance.overtime}</td>
          <td>${record.monthData.attendance.fine}</td>
          <td>${record.monthData.attendance.payableDays}</td>
        </tr>
      </tbody>
    </table>

    <div class="grid-2">
      <div>
        <div class="bold">Earnings</div>
        <table>
          ${record.monthData.earnings
            .map(
              (e) => `
              <tr>
                <td>${e.title}</td>
                <td class="right">₹${e.amount.toFixed(2)}</td>
              </tr>`
            )
            .join("")}
          <tr class="bold">
            <td>Total</td>
            <td class="right">₹${record.monthData.totalEarnings.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div>
        <div class="bold">Deductions</div>
        <table>
          ${
            record.monthData.deductions.length
              ? record.monthData.deductions
                  .map(
                    (d) => `
                    <tr>
                      <td>${d.title}</td>
                      <td class="right">₹${d.amount.toFixed(2)}</td>
                    </tr>`
                  )
                  .join("")
              : `<tr><td colspan="2">No Deductions</td></tr>`
          }
          <tr class="bold">
            <td>Net Payable</td>
            <td class="right">₹${record.monthData.netPayable.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
`;
};
