// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";
// import { ApiError } from "../../Utils/ApiError.js";
// import { ApiResponse } from "../../Utils/ApiResponse.js";
// import Hr from "./Hr.modules.js";
// import { asyncHandler } from "../../Utils/asyncHandler.js";
// import sendEmail from "../../Utils/SendEmail.js";
// import { Setting } from "../Setting/Setting.model.js";


// export const addHr = async (req, res) => {
//   try {
//     if (!req.body) {
//       throw new ApiError(400, "Request body is missing or empty");
//     }

//     const { name, email, password, phone } = req.body;

//     // ✅ Validations
//     if (!name?.trim()) throw new ApiError(400, "Name is required");
//     if (!email?.trim()) throw new ApiError(400, "Email is required");
//     if (!password?.trim()) throw new ApiError(400, "Password is required");
//     if (!phone?.trim()) throw new ApiError(400, "Phone number is required");

//     // ✅ Check if HR already exists
//     const existingHr = await Hr.findOne({ email });
//     if (existingHr) {
//       throw new ApiError(400, "HR with this email already exists");
//     }

//     // ✅ Hash the password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // ✅ Create HR
//     const newHr = await Hr.create({
//       name,
//       email,
//       password: hashedPassword,
//       phone,
//     });

//     return res
//       .status(201)
//       .json(new ApiResponse(201, newHr, "HR created successfully"));
//   } catch (error) {
//     console.error("❌ Error adding HR:", error);

//     if (error.name === "ValidationError") {
//       const errors = Object.values(error.errors).map((err) => err.message);
//       return res
//         .status(400)
//         .json({ success: false, message: errors.join(", ") });
//     }

//     if (error instanceof ApiError) {
//       return res
//         .status(error.statusCode)
//         .json({ success: false, message: error.message });
//     }

//     return res
//       .status(500)
//       .json({ success: false, message: "Internal server error" });
//   }
// };
// export const getAllHrs = async (req, res) => {
//   try {
//     const hrs = await Hr.find().select("-password"); // hide password
//     return res
//       .status(200)
//       .json(new ApiResponse(200, hrs, "All HRs fetched successfully"));
//   } catch (error) {
//     return handleError(res, error);
//   }
// };

// export const deleteHr = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const hr = await Hr.findByIdAndDelete(id);
//     if (!hr) throw new ApiError(404, "HR not found");

//     return res.status(200).json(new ApiResponse(200, {}, "HR deleted successfully"));
//   } catch (error) {
//     console.error("❌ Error deleting HR:", error);

//     if (error instanceof ApiError) {
//       return res.status(error.statusCode).json({ success: false, message: error.message });
//     }

//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };
// export const updateHr = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, email, phone } = req.body;

//     const hr = await Hr.findById(id);
//     if (!hr) throw new ApiError(404, "HR not found");

//     if (name) hr.name = name;
//     if (email) hr.email = email;
//     if (phone) hr.phone = phone;

//     await hr.save();

//     const { password, ...hrData } = hr.toObject();
//     return res.status(200).json(new ApiResponse(200, hrData, "HR updated successfully"));
//   } catch (error) {
//     console.error("❌ Error updating HR:", error);

//     if (error instanceof ApiError) {
//       return res.status(error.statusCode).json({ success: false, message: error.message });
//     }

//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

// // 🔵 Update HR Status (active/inactive)
// export const updateHrStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     if (!["active", "inactive"].includes(status)) {
//       throw new ApiError(400, "Invalid status value (use 'active' or 'inactive')");
//     }

//     const hr = await Hr.findByIdAndUpdate(id, { status }, { new: true });
//     if (!hr) throw new ApiError(404, "HR not found");

//     const { password, ...hrData } = hr.toObject();
//     return res.status(200).json(new ApiResponse(200, hrData, "HR status updated successfully"));
//   } catch (error) {
//     console.error("❌ Error updating HR status:", error);

//     if (error instanceof ApiError) {
//       return res.status(error.statusCode).json({ success: false, message: error.message });
//     }

//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

// // 🟣 Get HR Profile by ID
// export const getHrProfile = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const hr = await Hr.findById(id).select("-password -refreshToken");
//     if (!hr) throw new ApiError(404, "HR not found");

//     return res.status(200).json(new ApiResponse(200, hr, "HR profile fetched successfully"));
//   } catch (error) {
//     console.error("❌ Error fetching HR profile:", error);

//     if (error instanceof ApiError) {
//       return res.status(error.statusCode).json({ success: false, message: error.message });
//     }

//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

// export const loginHr = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and password are required",
//       });
//     }

//     const hr = await Hr.findOne({ email });
//     if (!hr) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid email or password",
//       });
//     }

//     // ✅ Status check
//     if (hr.status !== "active") {
//       return res.status(403).json({
//         success: false,
//         message: "Your account is inactive. Contact admin.",
//       });
//     }

//     const isPasswordValid = await bcrypt.compare(password, hr.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid email or password",
//       });
//     }

//     // ✅ Generate tokens
//    const accessToken = jwt.sign(
//   { _id: hr._id, role: hr.role },
//   process.env.ACCESS_TOKEN_SECRET,
//   { expiresIn: process.env.ACCESS_TOKEN_EXPIRY } // 1 day
// );

// const refreshToken = jwt.sign(
//   { _id: hr._id },
//   process.env.REFRESH_TOKEN_SECRET,
//   { expiresIn: process.env.REFRESH_TOKEN_EXPIRY } // 10 days
// );

//     // ✅ Save refreshToken in DB
//     hr.refreshToken = refreshToken;
//     await hr.save({ validateBeforeSave: false });

//     // ✅ HR data without sensitive fields
//     const hrSafeData = {
//       _id: hr._id,
//       name: hr.name,
//       email: hr.email,
//       phone: hr.phone,
//       role: hr.role,
//       status: hr.status,
//       createdAt: hr.createdAt,
//       updatedAt: hr.updatedAt,
//     };

//     return res.status(200).json(
//       new ApiResponse(200, { accessToken, refreshToken, hr: hrSafeData }, "Login successful")
//     );
//   } catch (error) {
//     console.error("❌ Login error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };

// export const logoutHr = asyncHandler(async (req, res) => {
//   const hrId = req.hr?._id;

//   // Remove refreshToken only if hrId exists
//   if (hrId) {
//     await Hr.findByIdAndUpdate(hrId, { $unset: { refreshToken: 1 } });
//   }

//   // Always clear cookies
//   res.clearCookie("accessToken");
//   res.clearCookie("refreshToken");

//   return res
//     .status(200)
//     .json(new ApiResponse(200, {}, "Logout successful"));
// });

// export const changeHrPassword = async (req, res) => {
//   try {
//     const hrId = req.hr._id; // ✅ HR from JWT
//     const { oldPassword, newPassword } = req.body;

//     if (!oldPassword?.trim()) throw new ApiError(400, "Old password is required");
//     if (!newPassword?.trim()) throw new ApiError(400, "New password is required");

//     const hr = await Hr.findById(hrId);
//     if (!hr) throw new ApiError(404, "HR not found");

//     const isMatch = await bcrypt.compare(oldPassword, hr.password);
//     if (!isMatch) throw new ApiError(400, "Old password is incorrect");

//     hr.password = await bcrypt.hash(newPassword, 10);
//     await hr.save();

//     return res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
//   } catch (error) {
//     console.error("❌ Error updating HR password:", error);

//     if (error instanceof ApiError) {
//       return res.status(error.statusCode).json({ success: false, message: error.message });
//     }

//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

// export const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       throw new ApiError(400, "Email is required");
//     }

//     const hr = await Hr.findOne({ email });
//     if (!hr) {
//       return res.status(404).json({ status: "HR not found" });
//     }

//     // Generate a reset token
//     const token = jwt.sign({ id: hr._id }, process.env.ACCESS_TOKEN_SECRET, {
//       expiresIn: "1d",
//     });

//     const frontendUrl = req.headers.origin || "http://localhost:5173"; // fallback
//     const resetLink = `${frontendUrl}/Reset-password?id=${hr._id}&token=${token}`;

//     // Fetch SMTP settings from DB
//     const settings = await Setting.findOne();
//     if (!settings) {
//       throw new ApiError(500, "SMTP settings not configured");
//     }

   
//     await sendEmail({
//       email: hr.email,
//       subject: "Reset Password Link",
//       message: `Click the link to reset your password: ${resetLink}`,
//       smtpConfig: settings.smtpConfig, // pass SMTP config to sendEmail if needed
//     });

//     res.status(200).json({
//       status: "Success",
//       message: "Password reset link sent to your email",
//     });
//   } catch (error) {
//     console.error("Error during forgot password:", error);

//     if (error instanceof ApiError) {
//       return res
//         .status(error.statusCode)
//         .json({ success: false, message: error.message });
//     }

//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };