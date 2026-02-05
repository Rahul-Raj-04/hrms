import bcrypt from "bcrypt";
import Staff from "./Staff.model.js";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import { ApiError } from "../../Utils/ApiError.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import { Setting } from "../Setting/Setting.model.js";
import sendEmail from "../../Utils/SendEmail.js";
import LeaveType from "../Leave/LeaveType.model.js";
import { StaffLeaveBalance } from "../Leave/StaffLeaveBalance/StaffLeaveBalance.modal.js";
import { staffInviteTemplate } from "../../Utils/staffInviteTemplate.js";
import { deleteFile, uploadFile } from "../../service/UploadAws.js";
import { emitAttendanceUpdate, emitForceLogout } from "../../Utils/sseManager.js";
import Attendance from "../Attendence/Attendence.model.js";
import { otpResetPasswordTemplate } from "../../Utils/EmailTemplate.js";
import { duoPushAuth } from "../../Utils/duoauth.js";

let cachedSMTP = null;
export const getNextStaffId = async (req, res) => {
  try {
    const lastStaff = await Staff.aggregate([
      {
        $match: {
          staff_id: { $regex: /^[A-Za-z]+-\d+$/ },
        },
      },
      {
        $addFields: {
          prefix: {
            $arrayElemAt: [{ $split: ["$staff_id", "-"] }, 0],
          },
          number: {
            $toInt: {
              $arrayElemAt: [{ $split: ["$staff_id", "-"] }, 1],
            },
          },
        },
      },
      {
        $sort: { number: -1 },
      },
      {
        $limit: 1,
      },
    ]);

    if (!lastStaff.length) {
      return res.status(200).json({
        success: true,
        nextId: "",
      });
    }

    const { prefix, number } = lastStaff[0];

    return res.status(200).json({
      success: true,
      nextId: `${prefix}-${number + 1}`,
    });
  } catch (error) {
    console.error("❌ Error generating staff_id:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating staff ID",
    });
  }
};

const addStaffNew = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  const { id: createdBy, role } = req.user;
  const requiredFields = [
    "staff_name",
    "staff_id",
    "personalemail",
    "phone",
    "joining_date",
    "gender",
    "department",
    "login_email",
    "username",
    "password",
    "basic_salary",
  ];

  const missingFields = requiredFields.filter(
    (f) => !body[f] || body[f].toString().trim() === ""
  );

  if (missingFields.length > 0) {
    throw new ApiError(400, "Missing required fields", missingFields);
  }
  const existingStaff = await Staff.findOne({
    $or: [
      { staff_id: body.staff_id },
      { personalemail: body.personalemail },
      { login_email: body.login_email },
      { username: body.username },
    ],
  });

  if (existingStaff) {
    const errors = [];
    if (existingStaff.staff_id === body.staff_id)
      errors.push("Staff ID already exists");
    if (existingStaff.personalemail === body.personalemail)
      errors.push("Personal email already exists");
    if (existingStaff.login_email === body.login_email)
      errors.push("Login email already exists");
    if (existingStaff.username === body.username)
      errors.push("Username already exists");
    throw new ApiError(409, "Duplicate data found", errors);
  }

  body.password = await bcrypt.hash(body.password, 10);
 if (req.files) {
   const singleFileFields = [
     "profile_photo",
     "resume",
     "id_proof",
     "address_proof",
     "appointment_letter",
     "relieving_letter",
   ];

   for (const field of singleFileFields) {
     if (req.files[field]?.[0]) {
       const result = await uploadFile({
         file: req.files[field][0],
         staffId: body.staff_id,
       });

       body[field] = result?.url || "";
     }
   }

   const multiFileFields = [
     "education_certificates",
     "experience_certificates",
     "others",
   ];

   for (const field of multiFileFields) {
     if (req.files[field]?.length) {
       const urls = [];

       for (const file of req.files[field]) {
         const result = await uploadFile({
           file,
           staffId: body.staff_id,
         });

         if (result?.url) urls.push(result.url);
       }

       body[field] = urls;
     }
   }
 }


  for (const key in body) {
    if (body[key] === undefined || body[key] === null) {
      body[key] = "";
    }
  }

  if (body.salary_components) {
    try {
      const parsed = JSON.parse(body.salary_components);
      body.salary_components = Array.isArray(parsed)
        ? parsed.map((sc) => ({
            component: sc.component,
            amount: Number(sc.amount) || 0,
          }))
        : [];
    } catch {
      body.salary_components = [];
    }
  } else {
    body.salary_components = [];
  }

  body.created_by = createdBy; 
  body.created_by_role = role; 
  const staff = new Staff(body);
  await staff.save();
if (Array.isArray(body.leave_template) && body.leave_template.length > 0) {
  const uniqueLeaveIds = [
    ...new Set(
      body.leave_template.filter((id) => mongoose.Types.ObjectId.isValid(id))
    ),
  ];

  const leaveTypes = await LeaveType.find({
    _id: { $in: uniqueLeaveIds },
  });

  for (const lt of leaveTypes) {
    const days =
      Number.isFinite(Number(lt.maxDays)) && Number(lt.maxDays) > 0
        ? Number(lt.maxDays)
        : 0;
    await StaffLeaveBalance.updateOne(
      {
        staff: staff._id,
        leaveType: lt._id,
      },
      {
        $setOnInsert: {
          totalAssigned: days,
          used: 0,
        },
      },
      { upsert: true }
    );
  }
}
  return res
    .status(201)
    .json(new ApiResponse(201, staff, "Staff added successfully"));
});
const getAllStaff = asyncHandler(async (req, res) => {
  const { search = "", page = 1, limit = 10 } = req.query;

  const query = search
    ? {
        $or: [
          { staff_name: { $regex: search, $options: "i" } },
          { staff_id: { $regex: search, $options: "i" } },
          { login_email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const skip = (Number(page) - 1) * Number(limit);

  const [staff, total] = await Promise.all([
    Staff.find(query)
      .select("-password -refresh_token")
      .populate("department", "name")
      .populate("attendance_supervisor", "staff_name staff_id")
      .populate("reporting_manager", "staff_name staff_id")
      .populate("hod", "staff_name staff_id")
      .populate("work_shift", "name startTime endTime description")
      .populate("weekly_off", "name")
      .populate("holiday_template", "name startMonth endMonth")
      .populate("leave_template", "name maxDays")
      .populate("salary_components.component", "name type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),

    Staff.countDocuments(query),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        staff,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
      "Staff fetched successfully",
    ),
  );
});


const getStaffById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const staff = await Staff.findById(id)
    .select("-password -refresh_token") // sensitive fields remove
    .populate("department", "name") // Department ka sirf name
    .populate("attendance_supervisor", "staff_name staff_id") // supervisor ka naam
    .populate("reporting_manager", "staff_name staff_id") // reporting manager ka naam
    .populate("hod", "staff_name staff_id") // hod ka naam
    .populate("work_shift", "name startTime endTime description") // shift info
    .populate("weekly_off", "name") // WeeklyHoliday ka naam
    .populate("holiday_template", "name startMonth endMonth") // holiday template info
    .populate("leave_template", "name maxDays") // leave template info
    .populate("salary_components.component", "name type"); // 👈 yeh line add karo

  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, staff, "Staff fetched successfully"));
});

const deleteStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const staff = await Staff.findByIdAndDelete(id);

  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, staff, "Staff deleted successfully"));
});
 const updateStaff2 = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const body = { ...req.body };

   const { id: updatedBy, role } = req.user;

   const staff = await Staff.findById(id);
   if (!staff) throw new ApiError(404, "Staff not found");

   delete body.staff_id;

   const duplicateConditions = [];

   if (body.personalemail && body.personalemail !== staff.personalemail) {
     duplicateConditions.push({ personalemail: body.personalemail });
   }

   if (body.login_email && body.login_email !== staff.login_email) {
     duplicateConditions.push({ login_email: body.login_email });
   }

   if (body.username && body.username !== staff.username) {
     duplicateConditions.push({ username: body.username });
   }

   if (duplicateConditions.length) {
     const duplicateCheck = await Staff.findOne({
       _id: { $ne: id },
       $or: duplicateConditions,
     });

     if (duplicateCheck) {
       const errors = [];
       if (duplicateCheck.personalemail === body.personalemail)
         errors.push("Personal email already exists");
       if (duplicateCheck.login_email === body.login_email)
         errors.push("Login email already exists");
       if (duplicateCheck.username === body.username)
         errors.push("Username already exists");

       throw new ApiError(409, "Duplicate data found", errors);
     }
   }

   
   if (body.password) {
     body.password = await bcrypt.hash(body.password, 10);
   }
if (req.files) {
  const singleFileFields = [
    "profile_photo",
    "resume",
    "id_proof",
    "address_proof",
    "appointment_letter",
    "relieving_letter",
  ];

  for (const field of singleFileFields) {
    if (req.files[field]?.[0]) {
      const result = await uploadFile({
        file: req.files[field][0],
        staffId: staff.staff_id,
      });

      body[field] = result?.url || "";
    }
  }

  const multiFileFields = [
    "education_certificates",
    "experience_certificates",
    "others",
  ];

  for (const field of multiFileFields) {
    if (req.files[field]?.length) {
      const urls = [];

      for (const file of req.files[field]) {
        const result = await uploadFile({
          file,
          staffId: staff.staff_id,
        });

        if (result?.url) urls.push(result.url);
      }

      body[field] = urls;
    }
  }
}


   
   if (body.salary_components) {
     try {
       const parsed = JSON.parse(body.salary_components);
       body.salary_components = Array.isArray(parsed)
         ? parsed.map((sc) => ({
             component: sc.component,
             amount: Number(sc.amount) || 0,
           }))
         : [];
     } catch {
       body.salary_components = [];
     }
   }

 
   let updatedBasicSalary = staff.basic_salary || 0;

   if (
     body.first_hike !== undefined &&
     Number(body.first_hike) > 0 &&
     Number(body.first_hike) !== Number(staff.first_hike)
   ) {
     updatedBasicSalary += (updatedBasicSalary * Number(body.first_hike)) / 100;
   }


   if (
     body.second_hike !== undefined &&
     Number(body.second_hike) > 0 &&
     Number(body.second_hike) !== Number(staff.second_hike)
   ) {
     updatedBasicSalary +=
       (updatedBasicSalary * Number(body.second_hike)) / 100;
   }

   if (updatedBasicSalary !== staff.basic_salary) {
     body.basic_salary = Math.round(updatedBasicSalary);
   }
   Object.keys(body).forEach((key) => {
     if (body[key] === undefined || body[key] === null) {
       delete body[key];
     }
   });

  if (Array.isArray(body.leave_template)) {
    const leaveTypes = await LeaveType.find({
      _id: { $in: body.leave_template },
    });

    for (const lt of leaveTypes) {
      const days =
        Number.isFinite(Number(lt.maxDays)) && Number(lt.maxDays) > 0
          ? Number(lt.maxDays)
          : 0;

      // 🔥 UPSERT (KEY FIX)
      await StaffLeaveBalance.updateOne(
        {
          staff: staff._id,
          leaveType: lt._id,
        },
        {
          $setOnInsert: {
            totalAssigned: days,
            used: 0,
          },
        },
        { upsert: true }
      );
    }

    // ❌ REMOVE DELETED LEAVES (SAFE)
    const oldTemplates = (staff.leave_template || []).map(String);
    const newTemplates = body.leave_template.map(String);

    const removed = oldTemplates.filter((id) => !newTemplates.includes(id));

    if (removed.length) {
      const balances = await StaffLeaveBalance.find({
        staff: staff._id,
        leaveType: { $in: removed },
      });

      for (const bal of balances) {
        if (bal.used > 0) {
          throw new ApiError(
            400,
            "Cannot remove leave template because leave is already used"
          );
        }
        await StaffLeaveBalance.deleteOne({ _id: bal._id });
      }
    }
  }

   
   body.updated_by = updatedBy;
   body.updated_by_role = role;

  
   const updatedStaff = await Staff.findByIdAndUpdate(id, body, {
     new: true,
   });

   return res
     .status(200)
     .json(new ApiResponse(200, updatedStaff, "Staff updated successfully"));
 });
export const upsertStaffDocument = asyncHandler(async (req, res) => {
  const staffMongoId = req.params.id;
  const { documentId, name, description } = req.body;

  const staff = await Staff.findById(staffMongoId);
  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  let docIndex = -1;

  if (documentId) {
    docIndex = staff.documents.findIndex(
      (d) => d._id.toString() === documentId
    );

    if (docIndex === -1) {
      throw new ApiError(404, "Document not found");
    }
  }

  if (!documentId && !req.files?.document?.[0]) {
    throw new ApiError(400, "Document file is required");
  }

  let fileUrl;

  if (req.files?.document?.[0]) {
    if (documentId && staff.documents[docIndex]?.file) {
      const url = new URL(staff.documents[docIndex].file);
      const oldKey = decodeURIComponent(url.pathname.substring(1));
      await deleteFile(oldKey);
    }

    const result = await uploadFile({
      file: req.files.document[0],
      staffId: staff.staff_id,
    });

    if (!result?.url) {
      throw new ApiError(500, "Document upload failed");
    }

    fileUrl = result.url;
  }

  const payload = {
    ...(name && { name }),
    ...(description && { description }),
    ...(fileUrl && { file: fileUrl }),
    uploaded_at: new Date(),
  };

  if (documentId) {
    staff.documents[docIndex] = {
      ...staff.documents[docIndex]._doc,
      ...payload,
    };
  } else {
    staff.documents.push({
      name: name || req.files.document[0].originalname,
      description: description || "",
      file: fileUrl,
      uploaded_at: new Date(),
    });
  }

  staff.updated_by = staffMongoId;
  await staff.save();

  const updatedStaff = await Staff.findById(staffMongoId).populate("work_shift");

  return res.status(200).json(
    new ApiResponse(
      200,
      updatedStaff,
      documentId
        ? "Document updated successfully"
        : "Document uploaded successfully"
    )
  );
});


const updateMyProfile = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  const allowedFields = ["staff_name", "personalemail"];
  const body = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      body[field] = req.body[field];
    }
  });

  const staff = await Staff.findById(staffId);
  if (!staff) throw new ApiError(404, "Staff not found");


  if (body.personalemail && body.personalemail !== staff.personalemail) {
    const exists = await Staff.findOne({
      _id: { $ne: staffId },
      personalemail: body.personalemail,
    });

    if (exists) {
      throw new ApiError(409, "Personal email already exists");
    }
  }

 if (req.files?.profile_photo?.[0]) {
   const file = req.files.profile_photo[0];

   // delete old image (optional but recommended)
   if (staff.profile_photo) {
     const url = new URL(staff.profile_photo);
     const oldKey = decodeURIComponent(url.pathname.substring(1));
     await deleteFile(oldKey);
   }

   const result = await uploadFile({
     file,
     staffId: staff.staff_id,
   });

   if (!result?.url) {
     throw new ApiError(500, "Profile photo upload failed");
   }

   body.profile_photo = result.url;
 }


  
  body.updated_by = staffId;
  body.updated_by_role = "staff";

  /* =============================
     6️⃣ UPDATE
     ============================= */
  const updatedStaff = await Staff.findByIdAndUpdate(staffId, body, {
    new: true,
  }).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedStaff, "Profile updated successfully"));
});
const updateProfilePhotoOnly = asyncHandler(async (req, res) => {
  const staffMongoId = req.user.id;

  if (!req.files?.profile_photo?.[0]) {
    throw new ApiError(400, "Profile photo is required");
  }

  const staff = await Staff.findById(staffMongoId);
  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  if (staff.profile_photo) {
    const url = new URL(staff.profile_photo);
    const oldKey = decodeURIComponent(url.pathname.substring(1));
    await deleteFile(oldKey);
  }

  const result = await uploadFile({
    file: req.files.profile_photo[0],
    staffId: staff.staff_id,
  });

  if (!result?.url) {
    throw new ApiError(500, "Profile photo upload failed");
  }

  staff.profile_photo = result.url;
  staff.updated_by = staffMongoId;

  await staff.save();

  const updatedStaff =
    await Staff.findById(staffMongoId).populate("work_shift");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedStaff, "Profile photo updated successfully"),
    );
});

const generateTemp2FAToken = (staffId) => {
  return jwt.sign(
    { _id: staffId, purpose: "2fa_setup" },
    process.env.TEMP_2FA_SECRET,
    { expiresIn: "5m" },
  );
};

const verifyTemp2FAToken = (token) => {
  return jwt.verify(token, process.env.TEMP_2FA_SECRET);
};
const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
    }
  );
};

const generateRefreshToken = (_id) => {
  return jwt.sign({ _id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};
export const setup2FA = asyncHandler(async (req, res) => {
  const { temp_token } = req.body;

  if (!temp_token) throw new ApiError(400, "temp_token is required");

  const decoded = verifyTemp2FAToken(temp_token);
  if (decoded.purpose !== "2fa_setup")
    throw new ApiError(401, "Invalid temp token");

  const staff = await Staff.findById(decoded._id);
  if (!staff) throw new ApiError(404, "Staff not found");

  const secret = speakeasy.generateSecret({
    name: `StaffPortal (${staff.login_email})`,
  });

  staff.two_factor_secret = secret.base32;
  staff.two_factor_enabled = false;
  staff.two_factor_verified = false;
  await staff.save();

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        qr: qrCodeDataUrl,
        secret: secret.base32,
      },
      "2FA secret generated, verify OTP to continue",
    ),
  );
});

export const verify2FA = asyncHandler(async (req, res) => {
  const { temp_token, otp } = req.body;

  if (!temp_token || !otp) {
    throw new ApiError(400, "temp_token and otp are required");
  }

  const decoded = verifyTemp2FAToken(temp_token);
  if (decoded.purpose !== "2fa_setup")
    throw new ApiError(401, "Invalid temp token");

  const staff = await Staff.findById(decoded._id).populate("work_shift");
  if (!staff) throw new ApiError(404, "Staff not found");

  if (!staff.two_factor_secret) throw new ApiError(400, "2FA not setup yet");

  const isValid = speakeasy.totp.verify({
    secret: staff.two_factor_secret,
    encoding: "base32",
    token: otp,
    window: 1,
  });

  if (!isValid) throw new ApiError(400, "Invalid OTP");

  staff.two_factor_enabled = true;
  staff.two_factor_verified = true;

  const accessToken = generateAccessToken({
    _id: staff._id,
    userType: "staff",
    role: staff.access_level,
    permissions: staff.permissions || [],
  });

  const refreshToken = generateRefreshToken(staff._id);

  staff.refresh_token = refreshToken;
  staff.last_login = new Date();
  await staff.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        staff: {
          _id: staff._id,
          name: staff.staff_name,
          login_email: staff.login_email,
          access_level: staff.access_level,
          last_login: staff.last_login,
          permissions: staff.permissions || [],
          work_shift: staff.work_shift,
          profile_photo: staff.profile_photo,
          two_factor_enabled: staff.two_factor_enabled,
          two_factor_verified: staff.two_factor_verified,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      "2FA verified, login completed",
    ),
  );
});

// const loginStaff = asyncHandler(async (req, res) => {
//   const { login_email, password, otp } = req.body;

//   if (!login_email || !password) {
//     throw new ApiError(400, "Email and password are required");
//   }

//   const staff = await Staff.findOne({ login_email }).populate("work_shift");
//   if (!staff) throw new ApiError(404, "Staff not found");

//   const isMatch = await bcrypt.compare(password, staff.password);
//   if (!isMatch) throw new ApiError(401, "Invalid credentials");

//   if (staff.portal_access !== "Yes") {
//     throw new ApiError(403, "Portal access denied. Please contact HR.");
//   }

  
//   if (!staff.two_factor_enabled) {
//     const tempToken = generateTemp2FAToken(staff._id);

//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         {
//           setupRequired: true,
//           temp_token: tempToken,
//         },
//         "2FA setup required",
//       ),
//     );
//   }

  
//   if (staff.two_factor_enabled && !staff.two_factor_secret) {
//     throw new ApiError(403, "2FA secret missing, please setup 2FA again");
//   }

 
//   if (staff.two_factor_enabled && !staff.two_factor_verified) {
//     throw new ApiError(403, "2FA setup incomplete, verify OTP first");
//   }

  
//   if (staff.two_factor_enabled && staff.two_factor_verified) {
//     if (!otp) {
//       return res.status(200).json(
//         new ApiResponse(
//           200,
//           {
//             twoFactorRequired: true,
//           },
//           "OTP required",
//         ),
//       );
//     }

//     const isValid = speakeasy.totp.verify({
//       secret: staff.two_factor_secret,
//       encoding: "base32",
//       token: otp,
//       window: 1,
//     });

//     if (!isValid) throw new ApiError(400, "Invalid OTP");
//   }

 
//   const accessToken = generateAccessToken({
//     _id: staff._id,
//     userType: "staff",
//     role: staff.access_level,
//     permissions: staff.permissions || [],
//   });

//   const refreshToken = generateRefreshToken(staff._id);

//   staff.refresh_token = refreshToken;
//   staff.last_login = new Date();
//   await staff.save();

//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       {
//         staff: {
//           _id: staff._id,
//           name: staff.staff_name,
//           login_email: staff.login_email,
//           access_level: staff.access_level,
//           last_login: staff.last_login,
//           permissions: staff.permissions || [],
//           work_shift: staff.work_shift,
//           profile_photo: staff.profile_photo,
//           two_factor_enabled: staff.two_factor_enabled,
//           two_factor_verified: staff.two_factor_verified,
//         },
//         access_token: accessToken,
//         refresh_token: refreshToken,
//       },
//       "Login successful",
//     ),
//   );
// });


const loginStaff = asyncHandler(async (req, res) => {
  const { login_email, password } = req.body;

  if (!login_email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const staff = await Staff.findOne({ login_email }).populate("work_shift");
  if (!staff) throw new ApiError(404, "Staff not found");

  const isMatch = await bcrypt.compare(password, staff.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  if (staff.portal_access !== "Yes") {
    throw new ApiError(403, "Portal access denied. Please contact HR.");
  }

  /* ===== DUO PUSH ===== */
  const duoUsername = staff.duo_username || staff.login_email;

  const duoResult = await duoPushAuth({ username: duoUsername });

  if (duoResult.stat !== "OK" || duoResult.response?.result !== "allow") {
    throw new ApiError(401, "Duo authentication failed");
  }

  /* ===== TOKENS ===== */
  const accessToken = generateAccessToken({
    _id: staff._id,
    userType: "staff",
    role: staff.access_level,
    permissions: staff.permissions || [],
  });

  const refreshToken = generateRefreshToken(staff._id);

  staff.refresh_token = refreshToken;
  staff.last_login = new Date();
  await staff.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        staff: {
          _id: staff._id,
          name: staff.staff_name,
          login_email: staff.login_email,
          access_level: staff.access_level,
          last_login: staff.last_login,
          permissions: staff.permissions || [],
          work_shift: staff.work_shift,
          profile_photo: staff.profile_photo,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      "Login successful",
    ),
  );
});

// const loginStaffForAdminPortal = asyncHandler(async (req, res) => {
//   const { login_email, password, otp } = req.body;

//   if (!login_email || !password) {
//     throw new ApiError(400, "Login email and password are required");
//   }

//   const staff = await Staff.findOne({ login_email });
//   if (!staff) {
//     throw new ApiError(404, "Staff not found");
//   }

//   const isMatch = await bcrypt.compare(password, staff.password);
//   if (!isMatch) {
//     throw new ApiError(401, "Invalid credentials");
//   }

//   if (staff.portal_access !== "Yes") {
//     throw new ApiError(403, "Portal access denied. Please contact HR.");
//   }

//   const allowedRoles = ["HR", "HOD", "Manager", "FM"];
//   if (!allowedRoles.includes(staff.access_level)) {
//     throw new ApiError(
//       403,
//       "You are not authorized to access the admin portal",
//     );
//   }

 
//   if (!staff.two_factor_enabled) {
//     const tempToken = generateTemp2FAToken(staff._id);

//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         {
//           setupRequired: true,
//           temp_token: tempToken,
//           portal: "admin",
//         },
//         "2FA setup required",
//       ),
//     );
//   }

 
//   if (staff.two_factor_enabled && !staff.two_factor_secret) {
//     throw new ApiError(403, "2FA secret missing, please setup 2FA again");
//   }

 
//  if (staff.two_factor_enabled && !staff.two_factor_verified) {
//    const tempToken = generateTemp2FAToken(staff._id);

//    return res.status(200).json(
//      new ApiResponse(
//        200,
//        {
//          setupRequired: true,
//          temp_token: tempToken,
//        },
//        "2FA not verified, complete setup",
//      ),
//    );
//  }

 
//   if (staff.two_factor_enabled && staff.two_factor_verified) {
//     if (!otp) {
//       return res.status(200).json(
//         new ApiResponse(
//           200,
//           {
//             twoFactorRequired: true,
//             portal: "admin",
//           },
//           "OTP required",
//         ),
//       );
//     }

//     const isValid = speakeasy.totp.verify({
//       secret: staff.two_factor_secret,
//       encoding: "base32",
//       token: otp,
//       window: 1,
//     });

//     if (!isValid) {
//       throw new ApiError(400, "Invalid OTP");
//     }
//   }

//   const accessToken = generateAccessToken({
//     _id: staff._id,
//     userType: "staff",
//     role: staff.access_level,
//     permissions: staff.permissions || [],
//     portal: "admin",
//   });

//   const refreshToken = generateRefreshToken(staff._id);

//   const lastLogin = new Date();

//   await Staff.updateOne(
//     { _id: staff._id },
//     { $set: { refresh_token: refreshToken, last_login: lastLogin } },
//   );

//   const staffData = {
//     _id: staff._id,
//     name: staff.staff_name,
//     login_email: staff.login_email,
//     access_level: staff.access_level,
//     permissions: staff.permissions || [],
//     last_login: lastLogin,
//     two_factor_enabled: staff.two_factor_enabled,
//     two_factor_verified: staff.two_factor_verified,
//   };

//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       {
//         staff: staffData,
//         access_token: accessToken,
//         refresh_token: refreshToken,
//       },
//       "Admin portal login successful",
//     ),
//   );
// });
const loginStaffForAdminPortal = asyncHandler(async (req, res) => {
  const { login_email, password } = req.body;

  if (!login_email || !password) {
    throw new ApiError(400, "Login email and password are required");
  }

  const staff = await Staff.findOne({ login_email });
  if (!staff) throw new ApiError(404, "Staff not found");

  const isMatch = await bcrypt.compare(password, staff.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  if (staff.portal_access !== "Yes") {
    throw new ApiError(403, "Portal access denied. Please contact HR.");
  }

  const allowedRoles = ["HR", "HOD", "Manager", "FM"];
  if (!allowedRoles.includes(staff.access_level)) {
    throw new ApiError(
      403,
      "You are not authorized to access the admin portal",
    );
  }

  /* ===== DUO PUSH ===== */
  const duoUsername = staff.duo_username || staff.login_email;

  const duoResult = await duoPushAuth({ username: duoUsername });

  if (duoResult.stat !== "OK" || duoResult.response?.result !== "allow") {
    throw new ApiError(401, "Duo authentication failed");
  }

  /* ===== TOKENS ===== */
  const accessToken = generateAccessToken({
    _id: staff._id,
    userType: "staff",
    role: staff.access_level,
    permissions: staff.permissions || [],
    portal: "admin",
  });

  const refreshToken = generateRefreshToken(staff._id);
  const lastLogin = new Date();

  await Staff.updateOne(
    { _id: staff._id },
    { $set: { refresh_token: refreshToken, last_login: lastLogin } },
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        staff: {
          _id: staff._id,
          name: staff.staff_name,
          login_email: staff.login_email,
          access_level: staff.access_level,
          permissions: staff.permissions || [],
          last_login: lastLogin,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      "Admin portal login successful",
    ),
  );
});

export const setStaff2FA = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const { enabled } = req.body;

  if (!staffId) throw new ApiError(400, "Staff ID is required");
  if (typeof enabled !== "boolean") {
    throw new ApiError(400, "enabled must be boolean (true/false)");
  }

  const staff = await Staff.findById(staffId);
  if (!staff) throw new ApiError(404, "Staff not found");
  if (enabled === true) {
    throw new ApiError(
      403,
      "Admin cannot enable 2FA. Staff must enable from login/setup.",
    );
  }

  // ✅ Allow only DISABLE
  staff.two_factor_enabled = false;
  staff.two_factor_verified = false;
  staff.two_factor_secret = null;

  await staff.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        staff_id: staff.staff_id,
        two_factor_enabled: staff.two_factor_enabled,
        two_factor_verified: staff.two_factor_verified,
      },
      "2FA disabled for staff",
    ),
  );
});


const logoutStaff = asyncHandler(async (req, res) => {
  const staffId =
    req.user?._id || // if coming from JWT middleware
    req.body?.staffId || // if sent in body
    req.query?.staffId || // if sent in query
    req.params?.id || // if sent as /logout/:id
    null;

  if (!staffId) {
    throw new ApiError(
      400,
      "Staff ID is required (body, query, params or JWT)"
    );
  }
  // DB se refresh_token hatao
  await Staff.findByIdAndUpdate(staffId, { refresh_token: null });

  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const { id: userId, role } = req.user;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Both old and new password are required");
  }

  /* ================= ADMIN ================= */
  if (role === "admin") {
    const admin = await Admin.findById(userId);
    if (!admin) throw new ApiError(404, "Admin not found");

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) throw new ApiError(401, "Old password is incorrect");

    admin.password = await bcrypt.hash(newPassword, 10);

    // ✅ skip validation
    await admin.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Admin password changed successfully"));
  }

  /* ================= STAFF / HR / MANAGER ================= */
  const staff = await Staff.findById(userId);
  if (!staff) throw new ApiError(404, "Staff not found");

  const isMatch = await bcrypt.compare(oldPassword, staff.password);
  if (!isMatch) throw new ApiError(401, "Old password is incorrect");

  staff.password = await bcrypt.hash(newPassword, 10);

  // ✅ FIX HERE
  await staff.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) throw new ApiError(400, "Email is required");

    const staff = await Staff.findOne({
      login_email: email.toLowerCase(),
    }).select("_id login_email");

    if (!staff) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    staff.forgotOtp = otpHash;
    staff.forgotOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await staff.save();

    if (!cachedSMTP) {
      const settings = await Setting.findOne().lean();
      if (!settings?.smtpConfig) {
        throw new ApiError(500, "SMTP settings not configured");
      }
      cachedSMTP = settings.smtpConfig;
    }

   await sendEmail({
     email: staff.login_email,
     subject: "Password Reset OTP",
     message: `Your password reset OTP is: ${otp}\nThis OTP expires in 10 minutes.`,
     html: otpResetPasswordTemplate({
       otp,
       staffEmail: staff.login_email,
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
    res.status(500).json({ success: false, message: error.message });
  }
};
export const resetStaffPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing email, otp, or password",
      });
    }

    const staff = await Staff.findOne({
      login_email: email.toLowerCase(),
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    if (!staff.forgotOtp || !staff.forgotOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "OTP not generated",
      });
    }

    if (staff.forgotOtpExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    const otpHash = crypto
      .createHash("sha256")
      .update(String(otp))
      .digest("hex");

    if (otpHash !== staff.forgotOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    staff.password = hashedPassword;
    staff.forgotOtp = null;
    staff.forgotOtpExpires = null;

    await staff.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const setReportingManager = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const { is_reporting_manager } = req.body;

  
  if (typeof is_reporting_manager !== "boolean") {
    throw new ApiError(
      400,
      "is_reporting_manager must be boolean (true or false)"
    );
  }

  // 🔍 check existing state (for message / safety)
  const existingStaff = await Staff.findById(staffId).select(
    "is_reporting_manager"
  );

  if (!existingStaff) {
    throw new ApiError(404, "Staff not found");
  }

  // 🔴 same state check
  if (existingStaff.is_reporting_manager === is_reporting_manager) {
    throw new ApiError(
      400,
      is_reporting_manager
        ? "Staff is already a Reporting Manager"
        : "Staff is already not a Reporting Manager"
    );
  }

  // ✅ SAFE UPDATE (NO FULL VALIDATION)
  const staff = await Staff.findByIdAndUpdate(
    staffId,
    {
      is_reporting_manager,
      access_level: is_reporting_manager ? "Manager" : "Staff",
    },
    {
      new: true,
      runValidators: false, // 🔥 MOST IMPORTANT LINE
    }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        staff,
        is_reporting_manager
          ? "Reporting Manager assigned successfully"
          : "Reporting Manager removed successfully"
      )
    );
});

export const setAttendanceSupervisor = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const { is_attendance_supervisor } = req.body;

  if (typeof is_attendance_supervisor !== "boolean") {
    throw new ApiError(400, "is_attendance_supervisor must be boolean");
  }

  // 🔍 fetch only needed field
  const existingStaff = await Staff.findById(staffId).select(
    "is_attendance_supervisor"
  );

  if (!existingStaff) {
    throw new ApiError(404, "Staff not found");
  }

  // 🔴 same state validation
  if (existingStaff.is_attendance_supervisor === is_attendance_supervisor) {
    throw new ApiError(
      400,
      is_attendance_supervisor
        ? "Staff is already an Attendance Supervisor"
        : "Staff is already not an Attendance Supervisor"
    );
  }

  // ✅ update safely
  const staff = await Staff.findByIdAndUpdate(
    staffId,
    { is_attendance_supervisor },
    {
      new: true,
      runValidators: false,
    }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        staff,
        is_attendance_supervisor
          ? "Attendance Supervisor assigned successfully"
          : "Attendance Supervisor removed successfully"
      )
    );
});

export const getReporteesByManager = asyncHandler(async (req, res) => {
  const { managerId } = req.params;

  const staffList = await Staff.find({
    reporting_manager: managerId,
  }).select("staff_name staff_id phone work_status");

  return res
    .status(200)
    .json(new ApiResponse(200, staffList, "Reportees fetched successfully"));
});
export const getStaffByAttendanceSupervisor = asyncHandler(async (req, res) => {
  const { supervisorId } = req.params;

  const staffList = await Staff.find({
    attendance_supervisor: supervisorId,
  }).select("staff_name staff_id phone work_status");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        staffList,
        "Attendance supervised staff fetched successfully"
      )
    );
});
export const inviteStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;

  const staff = await Staff.findById(staffId);
  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  if (!staff.login_email) {
    throw new ApiError(400, "Staff login email not available");
  }

  // ✅ UPDATE ONLY (NO VALIDATION ERROR)
  await Staff.findByIdAndUpdate(staffId, {
    portal_access: "Yes",
    invited_at: new Date(),
  });

  const loginUrl = `${process.env.STAFF_PANEL_URL}/login`;

  await sendEmail({
    to: staff.login_email,
    subject: "Staff Portal Invitation",
    html: staffInviteTemplate({
      staffName: staff.staff_name,
      loginEmail: staff.login_email,
      loginUrl,
    }),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, null, "Staff invited successfully. Email sent.")
    );
});
export const toggleStaffStatus = asyncHandler(async (req, res) => {
  const { staffId } = req.params;

  const staff = await Staff.findById(staffId);
  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  const isCurrentlyActive = staff.work_status === "Active";

  const updateData = {
    work_status: isCurrentlyActive ? "Inactive" : "Active",
    portal_access: isCurrentlyActive ? "No" : "Yes",
    deactivated_at: isCurrentlyActive ? new Date() : null,
    refresh_token: isCurrentlyActive ? null : staff.refresh_token,
  };

  await Staff.findByIdAndUpdate(staffId, updateData, { new: true });

 
  if (updateData.work_status === "Inactive") {
    const attendance = await Attendance.findOne({
      staff: staff._id,
      check_in: { $exists: true, $ne: null },
      check_out: { $in: [null, undefined] },
    }).sort({ createdAt: -1 });

    if (attendance) {
      const activeWork = attendance.work_sessions
        .slice()
        .reverse()
        .find((w) => !w.end_time);

      if (activeWork) {
        activeWork.end_time = new Date();
      }

      const activeBreak = attendance.breaks
        .slice()
        .reverse()
        .find((b) => !b.end_time);

      if (activeBreak) {
        activeBreak.end_time = new Date();
        activeBreak.duration = Math.ceil(
          (activeBreak.end_time - activeBreak.start_time) / (1000 * 60)
        );
      }

      attendance.check_out = new Date();
      await attendance.save();

      emitAttendanceUpdate({ staffId: staff._id });
    }

    emitForceLogout({ staffId, reason: "staff_deactivated" });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        staffId,
        work_status: updateData.work_status,
      },
      `Staff ${
        updateData.work_status === "Active" ? "activated" : "deactivated"
      } successfully`
    )
  );
});

// export const assignInsuranceToStaff = asyncHandler(async (req, res) => {
//   const { staffId } = req.params;

//   const {
//     provider,
//     policy_type,
//     policy_number,
//     sum_insured,
//     start_date,
//     expiry_date,
//     nominee_name,
//     nominee_relation,
//     document,
//   } = req.body;

//   const staff = await Staff.findById(staffId);
//   if (!staff) {
//     return res.status(404).json(new ApiResponse(404, null, "Staff not found"));
//   }

//   staff.insurance.push({
//     provider,
//     policy_type,
//     policy_number,
//     sum_insured,
//     start_date,
//     expiry_date,
//     nominee_name,
//     nominee_relation,
//     document,
//   });

//   await staff.save();

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         staff.insurance,
//         "Insurance policy assigned successfully",
//       ),
//     );
// });

export const assignInsuranceToStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const { title, description } = req.body;

  const staff = await Staff.findById(staffId);
  if (!staff) {
    return res.status(404).json(new ApiResponse(404, null, "Staff not found"));
  }

  let document = "";

  if (req.file) {
    const uploaded = await uploadFile({
      file: req.file,
      staffId,
    });
    document = uploaded.url;
  }

  staff.insurance.push({
    title,
    description,
    document,
    claims: [],
    status: "Active",
  });

  await staff.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, staff.insurance, "Insurance uploaded successfully"),
    );
});
export const updateInsuranceOfStaff = asyncHandler(async (req, res) => {
  const { staffId, insuranceId } = req.params;
  const { title, description } = req.body;

  const staff = await Staff.findById(staffId);
  if (!staff) {
    return res.status(404).json(new ApiResponse(404, null, "Staff not found"));
  }

  const insurance = staff.insurance.id(insuranceId);
  if (!insurance) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Insurance not found"));
  }

  if (title !== undefined) insurance.title = title;
  if (description !== undefined) insurance.description = description;

  if (req.file) {
    if (insurance.document) {
      const key = insurance.document.split(".amazonaws.com/")[1];
      await deleteFile(key);
    }

    const uploaded = await uploadFile({ file: req.file, staffId });
    insurance.document = uploaded.url;
  }

  await staff.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, staff.insurance, "Insurance updated successfully"),
    );
});
export const deleteInsuranceOfStaff = asyncHandler(async (req, res) => {
  const { staffId, insuranceId } = req.params;

  const staff = await Staff.findById(staffId);
  if (!staff) {
    return res.status(404).json(new ApiResponse(404, null, "Staff not found"));
  }

  const insurance = staff.insurance.id(insuranceId);
  if (!insurance) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Insurance not found"));
  }

  if (insurance.document) {
    const key = insurance.document.split(".amazonaws.com/")[1];
    await deleteFile(key);
  }

  staff.insurance.pull({ _id: insuranceId });
  await staff.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, staff.insurance, "Insurance deleted successfully"),
    );
});
export const assignedshiftToStaff = asyncHandler(async (req, res) => {
  const { staffIds, work_shift } = req.body;

  if (!Array.isArray(staffIds) || staffIds.length === 0) {
    throw new ApiError(400, "staffIds required");
  }

  await Staff.updateMany(
    { _id: { $in: staffIds } },
    { $set: { work_shift: work_shift || null } }
  );

  const staffs = await Staff.find(
    { _id: { $in: staffIds } },
    "_id staff_id work_shift staff_name phone login_email"
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      staffs,
      work_shift ? "Shift assigned successfully" : "Shift removed successfully"
    )
  );
});
export {
  getAllStaff,
  getStaffById,
  deleteStaff,
  loginStaff,
  logoutStaff,
  changePassword,
  addStaffNew,
  updateStaff2,
  loginStaffForAdminPortal,
  updateMyProfile,
  updateProfilePhotoOnly,
};
