import express from "express";
import path from "path";

import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(express.static(path.join(process.cwd(), "public")));

app.use(cookieParser());

import adminrouter from "../src/Modules/Admin/Admin.routes.js";
import Department from "../src/Modules/Department/Department.routes.js";
import Staff from "../src/Modules/Staff/Staff.routes.js";
import Attendence from "../src/Modules/Attendence/Attendancenew.routes.js";
import Announcemnt from "../src/Modules/Announcement/Announcement.routes.js";
import Loan from "../src/Modules/Loan/Loan.routes.js";
import Leave from "../src/Modules/Leave/Leave.routes.js";
import Payroll from "../src/Modules/Payroll/Payroll.routes.js";
import Dashboard from "../src/Modules/Dashboard/Dashboard.routes.js";
import Setting from "../src/Modules/Setting/Setting.routes.js";
import Shift from "../src/Modules/Shift/Shift.routes.js";
import notification from "../src/Modules/Notification/Notification.routes.js";
import cashbook from "../src/Modules/Cashbook/Cashbook.routes.js";
import report from "../src/Modules/Reports/report.routes.js";
import fine from "../src/Modules/Attendence/Fine/Fine.routes.js";
import attendanceSSE from "../src/Modules/Attendence/attendanceSSE.route.js";
// import attendanceSSE from "../src/Modules/Attendence/attendanceSSE.route.js";

app.use("/api/v1/admin", adminrouter);
app.use("/api/v1/dashboard", Dashboard);
app.use("/api/v1/department", Department);
app.use("/api/v1/staff", Staff);
app.use("/api/v1/attendance", Attendence);
app.use("/api/v1/attendance-sse", attendanceSSE);
app.use("/api/v1/announcement", Announcemnt);
app.use("/api/v1/loan", Loan);
app.use("/api/v1/leave", Leave);
app.use("/api/v1/fine", fine);
app.use("/api/v1/payroll", Payroll);
app.use("/api/v1/setting", Setting);
app.use("/api/v1/shift", Shift);
app.use("/api/v1/notification", notification);
app.use("/api/v1/cashbook", cashbook);
app.use("/api/v1/reports", report);
app.use("/health", (req, res) => {
  res.status(200).send("OK");
});

export { app };
