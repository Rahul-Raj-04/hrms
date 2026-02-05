import fs from "fs";
import path from "path";
import Report from "./Reports.model.js";

export const downloadReport = async (req, res) => {
  try {
    console.log("🔥 DOWNLOAD CONTROLLER HIT");
    console.log("ID 👉", req.params.id);

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (!fs.existsSync(report.filepath)) {
      return res.status(410).json({ message: "File expired or deleted" });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.filename}"`
    );

    return res.sendFile(path.resolve(report.filepath));
  } catch (err) {
    console.error("❌ DOWNLOAD ERROR", err);
    res.status(500).json({ message: "Download failed" });
  }
};
