import { uploadFile } from "../../service/UploadAws.js";
import { ApiError } from "../../Utils/ApiError.js";
import { Setting } from "./Setting.model.js";

export const initializeSettings = async () => {
  const exists = await Setting.findOne();

  if (exists) {
    return;
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    username: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    fromEmail: process.env.SMTP_FROM,
  };

  if (!smtpConfig.host || !smtpConfig.username) {
    return;
  }

  await Setting.create({ smtpConfig });
};

export const getSettings = async (req, res) => {
  try {
    // Fetch the first (or only) settings document
    const settings = await Setting.findOne();

    if (!settings) {
      throw new ApiError(404, "SMTP settings not found");
    }

    res.status(200).json({
      status: "success",
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching SMTP settings:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { host, port, username, password, fromEmail } = req.body;

    // Validate input
    if (!host || !port || !username || !password || !fromEmail) {
      throw new ApiError(400, "All SMTP fields are required");
    }

    // Get the first (or only) settings document
    let settings = await Setting.findOne();
    if (!settings) {
      // If no settings exist, create one
      settings = new Setting({
        smtpConfig: { host, port, username, password, fromEmail },
      });
    } else {
      // Update existing settings
      settings.smtpConfig = { host, port, username, password, fromEmail };
    }

    await settings.save();

    res.status(200).json({
      status: "Success",
      message: "SMTP settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating SMTP settings:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateCompanyPolicy = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Policy title is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Policy PDF is required",
      });
    }

    const uploaded = await uploadFile({
      file: req.file,
    });

    let settings = await Setting.findOne();
    if (!settings) settings = new Setting({});

    const nextVersion = (settings.companyPolicy?.currentVersion || 0) + 1;

    settings.companyPolicy.currentVersion = nextVersion;
    settings.companyPolicy.versions.push({
      version: nextVersion,
      title,
      pdf_url: uploaded.url,
      uploaded_at: new Date(),
      uploaded_by: req.user?.id || null,
      s3_key: uploaded.key,
    });

    await settings.save();

    return res.json({
      success: true,
      message: `Policy uploaded (v${nextVersion})`,
      data: {
        version: nextVersion,
        title,
        pdf_url: uploaded.url,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllPolicyVersions = async (req, res) => {
  try {
    const settings = await Setting.findOne().select("companyPolicy");

    return res.json({
      success: true,
      data: settings?.companyPolicy?.versions || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
export const getLatestCompanyPolicy = async (req, res) => {
  try {
    const settings = await Setting.findOne();

    if (!settings?.companyPolicy?.currentVersion) {
      return res.json({ success: true, data: null });
    }

    const latest = settings.companyPolicy.versions.find(
      (v) => v.version === settings.companyPolicy.currentVersion
    );

    return res.json({
      success: true,
      data: latest || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
