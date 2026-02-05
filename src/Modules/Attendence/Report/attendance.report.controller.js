import moment from "moment";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import Report from "../../Reports/Reports.model.js";
import Attendance from "../Attendence.model.js";
import { asyncHandler } from "../../../Utils/asyncHandler.js";
import { ApiError } from "../../../Utils/ApiError.js";
import { parseDateStrict } from "../Utils/date.utils.js";

export const generateDailyAttendanceReport = asyncHandler(async (req, res) => {
  const { date, status } = req.body;
  if (!date) throw new ApiError(400, "Date required");

  const start = parseDateStrict(date);
  const end = moment(start).endOf("day").toDate();

  const query = { date: { $gte: start, $lte: end } };
  if (status) query.status = status;

  const records = await Attendance.find(query).populate(
    "staff",
    "email staff_name"
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily Attendance");

  sheet.columns = [
    { header: "Staff Name", key: "staff", width: 30 },
    { header: "Email", key: "email", width: 30 },
    { header: "Date", key: "date", width: 15 },
    { header: "Status", key: "status", width: 15 },
    { header: "Check-In", key: "check_in", width: 15 },
    { header: "Check-Out", key: "check_out", width: 15 },
    { header: "Working Hours", key: "working_hours", width: 15 },
  ];

  records.forEach((r) => {
    sheet.addRow({
      staff: r.staff?.staff_name,
      email: r.staff?.email,
      date: moment(r.date).format("YYYY-MM-DD"),
      status: r.status,
      check_in: r.check_in ? moment(r.check_in).format("HH:mm") : "",
      check_out: r.check_out ? moment(r.check_out).format("HH:mm") : "",
      working_hours: r.working_hours || 0,
    });
  });

  const dir = path.join(process.cwd(), "public", "temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `Daily_Attendance_${date}.xlsx`;
  const filepath = path.join(dir, filename);
  await workbook.xlsx.writeFile(filepath);

  const report = await Report.create({
    filename,
    filepath,
    expirationDate: new Date(Date.now() + 7 * 86400000),
  });

  res.json({ report, downloadUrl: `/temp/${filename}` });
});
export const getDailyReports = async (req, res) => {
  try {
    const { date } = req.query;
    const query = {};

    if (date) {
      const d = moment(date, "YYYY-MM-DD", true);
      if (!d.isValid()) {
        return res
          .status(400)
          .json({ message: "Invalid date format YYYY-MM-DD" });
      }

      query.createdAt = {
        $gte: d.clone().startOf("day").toDate(),
        $lte: d.clone().endOf("day").toDate(),
      };
    }

    const reports = await Report.find(query).sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching reports" });
  }
};

export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Delete file from disk
    if (fs.existsSync(report.filepath)) {
      fs.unlinkSync(report.filepath);
    }

    // Delete report document
    await Report.findByIdAndDelete(id);

    res.status(200).json({ message: "Report deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting report" });
  }
};
