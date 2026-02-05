import bcrypt from "bcrypt";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { Admin } from "./Admin.Model.js";
import connectDB from "../../db/index.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import sendEmail from "../../Utils/SendEmail.js";
import { deleteFile, uploadFile } from "../../service/UploadAws.js";
import { adminDisable2FATemplate, otpResetPasswordTemplate } from "../../Utils/EmailTemplate.js";
import { Setting } from "../Setting/Setting.model.js";
import { duoPushAuth } from "../../Utils/duoauth.js";
let cachedSMTP = null;

const initializeAdmin = asyncHandler(async () => {
  await connectDB();
  const admin = await Admin.findOne({ isAdmin: true });

  if (!admin) {
    const adminuser = new Admin({
      username: "admin",
      password: "admin@1234",
      email: "admin@gmail.com",
      profilePhoto:
        "https://themesbrand.com/velzon/html/master/assets/images/users/avatar-1.jpg",
    });
    await adminuser.save();
    console.log("admin created");
  } else {
    console.log("admin already exists");
  }
});

const generateTemp2FAToken = (adminId, purpose = "2fa_setup") => {
  return jwt.sign({ _id: adminId, purpose }, process.env.TEMP_2FA_SECRET, {
    expiresIn: "5m",
  });
};

const verifyTemp2FAToken = (token) => {
  return jwt.verify(token, process.env.TEMP_2FA_SECRET);
};
const generateAdminAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  });
};

const generateAdminRefreshToken = (_id) => {
  return jwt.sign({ _id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};
export const setupAdmin2FA = asyncHandler(async (req, res) => {
  const { temp_token } = req.body;

  if (!temp_token) throw new ApiError(400, "temp_token is required");

  const decoded = verifyTemp2FAToken(temp_token);
  if (decoded.purpose !== "2fa_setup") {
    throw new ApiError(401, "Invalid temp token");
  }

  const admin = await Admin.findById(decoded._id);
  if (!admin) throw new ApiError(404, "Admin not found");

  const secret = speakeasy.generateSecret({
    name: `AdminPortal (${admin.email})`,
  });

  admin.two_factor_secret = secret.base32;
  admin.two_factor_enabled = true;
  admin.two_factor_verified = false;

  await admin.save({ validateBeforeSave: false });

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        qr: qrCodeDataUrl,
        secret: secret.base32,
      },
      "Admin 2FA secret generated, verify OTP to continue",
    ),
  );
});

export const verifyAdmin2FA = asyncHandler(async (req, res) => {
  const { temp_token, otp } = req.body;

  if (!temp_token || !otp) {
    throw new ApiError(400, "temp_token and otp are required");
  }

  const decoded = verifyTemp2FAToken(temp_token);
  if (decoded.purpose !== "2fa_setup") {
    throw new ApiError(401, "Invalid temp token");
  }

  const admin = await Admin.findById(decoded._id);
  if (!admin) throw new ApiError(404, "Admin not found");

  if (!admin.two_factor_secret) throw new ApiError(400, "2FA not setup yet");

  const isValid = speakeasy.totp.verify({
    secret: admin.two_factor_secret,
    encoding: "base32",
    token: otp,
    window: 1,
  });

  if (!isValid) throw new ApiError(400, "Invalid OTP");

  admin.two_factor_enabled = true;
  admin.two_factor_verified = true;

  const accessToken = generateAdminAccessToken({
    _id: admin._id,
    userType: "admin",
    email: admin.email,
    username: admin.username,
  });

  const refreshToken = generateAdminRefreshToken(admin._id);

  admin.refreshToken = refreshToken;
  admin.loginTime = new Date();
  admin.loginHistory.push(new Date());

  await admin.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        admin: {
          _id: admin._id,
          email: admin.email,
          username: admin.username,
          profilePhoto: admin.profilePhoto,
          role: "admin",
          two_factor_enabled: admin.two_factor_enabled,
          two_factor_verified: admin.two_factor_verified,
        },
        accessToken,
        refreshToken,
      },
      "Admin 2FA verified, login completed",
    ),
  );
});
// const loginAdmin = async (req, res) => {
//   try {
//     const { email, password, otp } = req.body;

//     if (!email || !password) {
//       return res
//         .status(400)
//         .json(new ApiResponse(400, null, "Email and password required"));
//     }

//     const admin = await Admin.findOne({ email });
//     if (!admin) {
//       return res
//         .status(401)
//         .json(new ApiResponse(401, null, "Invalid email or password"));
//     }

//     const isValidPass = await bcrypt.compare(password, admin.password);
//     if (!isValidPass) {
//       return res
//         .status(401)
//         .json(new ApiResponse(401, null, "Invalid email or password"));
//     }

   
//     if (!admin.two_factor_enabled) {
//       const tempToken = generateTemp2FAToken(admin._id);

//       return res.status(200).json(
//         new ApiResponse(
//           200,
//           {
//             setupRequired: true,
//             temp_token: tempToken,
//             portal: "admin",
//           },
//           "2FA setup required",
//         ),
//       );
//     }

    
//     if (admin.two_factor_enabled && !admin.two_factor_secret) {
//       return res
//         .status(403)
//         .json(
//           new ApiResponse(
//             403,
//             null,
//             "2FA secret missing, please setup 2FA again",
//           ),
//         );
//     }

  
//     if (admin.two_factor_enabled && !admin.two_factor_verified) {
//       const tempToken = generateTemp2FAToken(admin._id);

//       return res.status(200).json(
//         new ApiResponse(
//           200,
//           {
//             setupRequired: true,
//             temp_token: tempToken,
//             portal: "admin",
//           },
//           "2FA not verified, complete setup",
//         ),
//       );
//     }

  
//     if (admin.two_factor_enabled && admin.two_factor_verified) {
//       if (!otp) {
//         return res.status(200).json(
//           new ApiResponse(
//             200,
//             {
//               twoFactorRequired: true,
//               portal: "admin",
//             },
//             "OTP required",
//           ),
//         );
//       }

//       const otpValid = speakeasy.totp.verify({
//         secret: admin.two_factor_secret,
//         encoding: "base32",
//         token: otp,
//         window: 1,
//       });

//       if (!otpValid) {
//         return res.status(400).json(new ApiResponse(400, null, "Invalid OTP"));
//       }
//     }

  
//     const accessToken = jwt.sign(
//       {
//         _id: admin._id,
//         userType: "admin",
//         email: admin.email,
//         username: admin.username,
//       },
//       process.env.ACCESS_TOKEN_SECRET,
//       { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
//     );

//     const refreshToken = jwt.sign(
//       { _id: admin._id },
//       process.env.REFRESH_TOKEN_SECRET,
//       { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
//     );

//     admin.refreshToken = refreshToken;
//     admin.loginTime = new Date();
//     admin.loginHistory.push(new Date());

//     await admin.save({ validateBeforeSave: false });

//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         {
//           accessToken,
//           refreshToken,
//           admin: {
//             _id: admin._id,
//             email: admin.email,
//             username: admin.username,
//             profilePhoto: admin.profilePhoto,
//             role: "admin",
//             two_factor_enabled: admin.two_factor_enabled,
//             two_factor_verified: admin.two_factor_verified,
//           },
//         },
//         "Admin login successful",
//       ),
//     );
//   } catch (error) {
//     return res
//       .status(500)
//       .json(new ApiResponse(500, null, "Internal server error"));
//   }
// };

const logoutAdmin = async (req, res) => {
  try {
    const adminId = req.body.adminId || req.query.adminId;

    if (!adminId) {
      throw new ApiError(400, "Admin ID is required");
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw new ApiError(404, "Admin not found");
    }

    // ✅ Clear session-related fields
    admin.loginstatus = false;
    admin.refreshToken = null; // 🔥 remove refresh token
    await admin.save({ validateBeforeSave: false });

    // ✅ Clear cookies
    res.clearCookie("accessToken", { httpOnly: true, secure: true });
    res.clearCookie("refreshToken", { httpOnly: true, secure: true });

    return res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    console.error("Error during logout:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getAdminDetails = async (req, res) => {
  connectDB();
  try {
    const adminId = req.query.adminId; // Extract adminId from query params
    if (!adminId) {
      throw new ApiError(400, "Admin ID is required in query params");
    }

    // Fetch admin details from the database based on the adminId
    const admin = await Admin.findById(adminId);

    if (!admin) {
      throw new ApiError(404, "Admin not found");
    }

    const adminDetails = {
      firstName: admin.firstName || "", // If firstName is null or undefined, assign an empty string
      lastName: admin.lastName || "",
      phoneNumber: admin.phoneNumber || "",
      email: admin.email || "",
      loginTime: admin.loginTime || null, // You can set a default value for dates as needed
      designation: admin.designation || "",
      website: admin.website || "",
      city: admin.city || "",
      state: admin.state || "",
      postalCode: admin.postalCode || "",
      address: admin.address || "",
      username: admin.username || "",
      profilePhoto: admin.profilePhoto || "",
      portfolioLink: admin.portfolioLink || "",
      loginHistory: admin.loginHistory || [],
      isAdmin: admin.isAdmin,
    };

    // Send admin details in the response
    res.json(
      new ApiResponse(200, adminDetails, "Admin details retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching admin details:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
const updateAdmin = async (req, res) => {
  try {
    // 🔐 adminId from JWT
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const adminId = req.user.id;

    const {
      firstName,
      lastName,
      phoneNumber,
      email,
      designation,
      website,
      city,
      state,
      address,
      postalCode,
      username,
      profilePhoto,
      portfolioLink,
    } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      adminId,
      {
        $set: {
          firstName,
          lastName,
          phoneNumber,
          email,
          designation,
          website,
          city,
          state,
          address,
          postalCode,
          username,
          profilePhoto,
          portfolioLink,
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    return res.status(200).json({
      message: "Account details updated successfully",
      admin,
    });
  } catch (error) {
    console.error("Error updating account details:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
const changeAdminPassword = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized access" });
  }

  const { oldPassword, newPassword } = req.body;

  const admin = await Admin.findById(req.user.id);
  if (!admin) {
    return res.status(404).json({ success: false, message: "Admin not found" });
  }

  const isPasswordCorrect = await admin.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    return res
      .status(400)
      .json({ success: false, message: "Incorrect current password" });
  }

  admin.password = newPassword;
  await admin.save({ validateBeforeSave: false });

  return res.status(200).json({
    success: true,
    message: "Password updated successfully!",
  });
});


export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) throw new ApiError(400, "Email is required");

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select(
      "_id email",
    );

    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
  
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    admin.forgotOtp = otpHash;
    admin.forgotOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await admin.save();

    if (!cachedSMTP) {
      const settings = await Setting.findOne().lean();
      if (!settings?.smtpConfig) {
        throw new ApiError(500, "SMTP settings not configured");
      }
      cachedSMTP = settings.smtpConfig;
    }

    await sendEmail({
      email: admin.email,
      subject: "Password Reset OTP",
      message: `Your password reset OTP is: ${otp}\nThis OTP expires in 10 minutes.`,
      html: otpResetPasswordTemplate({
        otp,
        staffEmail: admin.email,
        expiryMinutes: 10,
      }),
      smtpConfig: cachedSMTP,
    });

    res.json({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email) throw new ApiError(400, "Email is required");
    if (!otp) throw new ApiError(400, "OTP is required");
    if (!password) throw new ApiError(400, "Password is required");

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    if (!admin.forgotOtp || !admin.forgotOtpExpires) {
      return res
        .status(400)
        .json({ success: false, message: "OTP not generated" });
    }

    if (admin.forgotOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    const otpHash = crypto
      .createHash("sha256")
      .update(String(otp))
      .digest("hex");

    if (otpHash !== admin.forgotOtp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    admin.password = password;
    admin.forgotOtp = undefined;
    admin.forgotOtpExpires = undefined;

    await admin.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateAdminProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Only admin can update profile photo");
  }

  if (!req.file) {
    throw new ApiError(400, "Profile photo is required");
  }

  const admin = await Admin.findById(req.user.id);
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }
  if (admin.profilePhoto) {
    const url = new URL(admin.profilePhoto);
    const oldKey = decodeURIComponent(url.pathname.substring(1));
    await deleteFile(oldKey);
  }
  const uploadResult = await uploadFile({
    file: req.file,
    staffId: `Admin/${admin._id}`,
  });

  if (!uploadResult?.url) {
    throw new ApiError(500, "Image upload failed");
  }

  admin.profilePhoto = uploadResult.url;
  await admin.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { profilePhoto: admin.profilePhoto },
        "Admin profile photo updated successfully"
      )
    );
});
export const sendAdminDisable2FAOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) throw new ApiError(400, "Email is required");

  const admin = await Admin.findOne({ email });
  if (!admin) throw new ApiError(404, "Admin not found");

  if (!admin.two_factor_enabled) {
    throw new ApiError(400, "2FA already disabled");
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  admin.two_factor_recovery_otp = otpHash;
  admin.two_factor_recovery_expires = new Date(Date.now() + 10 * 60 * 1000);
  await admin.save({ validateBeforeSave: false });

  await sendEmail({
    to: admin.email,
    subject: "Disable 2FA OTP",
    html: adminDisable2FATemplate({
      otp,
      staffEmail: admin.email,
      expiryMinutes: 10,
    }),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { otpSent: true },
        "OTP sent to your email to disable 2FA",
      ),
    );
});
export const verifyAdminDisable2FAOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) throw new ApiError(400, "Email and OTP are required");

  const admin = await Admin.findOne({ email });
  if (!admin) throw new ApiError(404, "Admin not found");

  if (!admin.two_factor_enabled) {
    throw new ApiError(400, "2FA already disabled");
  }

  if (!admin.two_factor_recovery_otp || !admin.two_factor_recovery_expires) {
    throw new ApiError(400, "No OTP request found, please request OTP again");
  }

  if (admin.two_factor_recovery_expires < new Date()) {
    throw new ApiError(400, "OTP expired, please request again");
  }

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  if (otpHash !== admin.two_factor_recovery_otp) {
    throw new ApiError(400, "Invalid OTP");
  }

  admin.two_factor_enabled = false;
  admin.two_factor_verified = false;
  admin.two_factor_secret = null;

  admin.two_factor_recovery_otp = null;
  admin.two_factor_recovery_expires = null;

  await admin.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { disabled: true },
        "2FA disabled successfully. You can login using email & password.",
      ),
    );
});
export const loginAdminduo = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Email and password required"));
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "Invalid email or password"));
    }

    const isValidPass = await bcrypt.compare(password, admin.password);
    if (!isValidPass) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "Invalid email or password"));
    }

    /* ===== DUO PUSH (instead of OTP) ===== */

    const duoUsername = admin.duo_username || admin.email;

    const duoResult = await duoPushAuth({ username: duoUsername });

    if (duoResult.stat !== "OK" || duoResult.response?.result !== "allow") {
      return res.status(401).json(
        new ApiResponse(
          401,
          {
            duo_result: duoResult.response?.result,
            status_msg: duoResult.response?.status_msg,
          },
          "Duo authentication failed",
        ),
      );
    }

    

    const accessToken = jwt.sign(
      {
        _id: admin._id,
        userType: "admin",
        email: admin.email,
        username: admin.username,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
    );

    const refreshToken = jwt.sign(
      { _id: admin._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
    );

    admin.refreshToken = refreshToken;
    admin.loginTime = new Date();
    admin.loginHistory.push(new Date());

    await admin.save({ validateBeforeSave: false });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          accessToken,
          refreshToken,
          admin: {
            _id: admin._id,
            email: admin.email,
            username: admin.username,
            profilePhoto: admin.profilePhoto,
            role: "admin",
          },
        },
        "Admin login successful",
      ),
    );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal server error"));
  }
};

export {
  // loginAdmin,
  logoutAdmin,
  getAdminDetails,
  updateAdmin,
  changeAdminPassword,
  initializeAdmin,

};
