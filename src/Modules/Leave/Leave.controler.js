import path from "path";
import fs from "fs";
import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import Staff from "../Staff/Staff.model.js";
import Holiday from "./Holiday.model.js";
import LeaveApplication from "./LeaveApplication.model.js";
import EarnedLeaveBalance from "./EarnedLeave.modal.js";
import LeaveType from "./LeaveType.model.js";
import WeeklyHoliday from "./WeeklyHoliday.model.js";
import HolidayTemplate from "./holidayTemplate.model.js";
import Report from "../Reports/Reports.model.js";
import { leaveApplicationTemplate } from "../../Utils/EmailTemplate.js";
import sendEmail from "../../Utils/SendEmail.js";
import { StaffLeaveBalance } from "./StaffLeaveBalance/StaffLeaveBalance.modal.js";
import { checkWeeklyOffBetweenDates } from "./checkWeeklyOff.js";
import Attendance from "../Attendence/Attendence.model.js";
import { Admin } from "../Admin/Admin.Model.js";
import { createNotification } from "../Notification/Notification.controler.js";
import { emitNotification } from "../../Utils/sseManager.js";
import { deleteFile, uploadFile } from "../../service/UploadAws.js";

export const setWeeklyHoliday = asyncHandler(async (req, res) => {
  const { days } = req.body;
  const hrId = req.user.id;

  if (!Array.isArray(days) || days.length === 0) {
    throw new ApiError(400, "Days must be a non-empty array of weekdays");
  }

  // 1️⃣ Remove duplicates from request itself
  const uniqueDays = [...new Set(days)];

  // 2️⃣ Find already existing holidays for this user
  const existingHolidays = await WeeklyHoliday.find({
    createdBy: hrId,
    day: { $in: uniqueDays },
  }).select("day");

  const existingDays = existingHolidays.map((h) => h.day);

  // 3️⃣ Filter only new days
  const daysToCreate = uniqueDays.filter((day) => !existingDays.includes(day));

  if (daysToCreate.length === 0) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          [],
          "All selected days are already set as weekly holidays"
        )
      );
  }

  // 4️⃣ Create only new ones
  const created = await WeeklyHoliday.insertMany(
    daysToCreate.map((day) => ({
      createdBy: hrId,
      day,
    }))
  );

  res.status(201).json(
    new ApiResponse(
      201,
      {
        createdDays: created.map((c) => c.day),
        skippedDays: existingDays,
      },
      "Weekly holidays updated successfully"
    )
  );
});

export const getWeeklyHoliday = asyncHandler(async (req, res) => {
  const holidays = await WeeklyHoliday.find();
  res
    .status(200)
    .json(new ApiResponse(200, holidays, "Weekly holidays fetched"));
});

export const deleteWeeklyHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let filter = { _id: id };

  // ❗ Sirf staff/manager ke liye ownership check
  if (req.user.role !== "admin") {
    filter.createdBy = req.user.id;
  }

  const deletedHoliday = await WeeklyHoliday.findOneAndDelete(filter);

  if (!deletedHoliday) {
    throw new ApiError(
      404,
      "Weekly holiday not found or you don't have permission to delete it"
    );
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Weekly holiday deleted successfully"));
});

export const addHoliday = asyncHandler(async (req, res) => {
  const { title, date, description } = req.body;
  const userId = req.user.id;

  if (!title || !date) {
    throw new ApiError(400, "Title and Date are required");
  }

  const holiday = await Holiday.create({
    title,
    date,
    description,
    createdBy: userId,
  });

  res
    .status(201)
    .json(new ApiResponse(201, holiday, "Holiday added successfully"));
});

export const addHolidayTemplate = asyncHandler(async (req, res) => {
  const { name, startMonth, endMonth, holidays } = req.body;
  const userId = req.user.id;

  if (!name || !startMonth || !endMonth) {
    throw new ApiError(400, "Name, startMonth, and endMonth are required");
  }

  if (!Array.isArray(holidays) || holidays.length === 0) {
    throw new ApiError(400, "At least one holiday must be selected");
  }

  const holidayTemplate = await HolidayTemplate.create({
    name,
    startMonth,
    endMonth,
    holidays, // ✅ USE FRONTEND SELECTION
    createdBy: userId,
  });

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        holidayTemplate,
        "Holiday Template added successfully"
      )
    );
});

export const getHolidayTemplates = asyncHandler(async (req, res) => {
  const templates = await HolidayTemplate.find().populate("holidays");

  res
    .status(200)
    .json(new ApiResponse(200, templates, "Holiday Templates fetched"));
});
export const updateHolidayTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, startMonth, endMonth, holidays } = req.body;

  const template = await HolidayTemplate.findById(id);
  if (!template) {
    throw new ApiError(404, "Holiday Template not found");
  }

  if (req.user.role !== "admin" && !template.createdBy.equals(req.user.id)) {
    throw new ApiError(403, "You are not allowed to update this template");
  }

  if (name !== undefined) template.name = name;
  if (startMonth !== undefined) template.startMonth = startMonth;
  if (endMonth !== undefined) template.endMonth = endMonth;

  // 🔥 THIS LINE FIXES UNCHECK ISSUE
  if (Array.isArray(holidays)) {
    template.holidays = holidays;
  }

  await template.save();

  res
    .status(200)
    .json(
      new ApiResponse(200, template, "Holiday Template updated successfully")
    );
});

export const deleteHolidayTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query = { _id: id };

  if (req.user.role !== "admin") {
    query.createdBy = req.user.id;
  }

  const template = await HolidayTemplate.findOneAndDelete(query);

  if (!template) {
    throw new ApiError(404, "Holiday Template not found or access denied");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Holiday Template deleted successfully"));
});

export const getHolidays = asyncHandler(async (req, res) => {
  const holidays = await Holiday.find().sort({ date: 1 });
  res.status(200).json(new ApiResponse(200, holidays, "Holiday list fetched"));
});

export const updateHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, date, description } = req.body;

  const holiday = await Holiday.findById(id);
  if (!holiday) throw new ApiError(404, "Holiday not found");

  if (req.user.role !== "admin" && !holiday.createdBy.equals(req.user.id)) {
    throw new ApiError(403, "You are not allowed to update this holiday");
  }

  if (title) holiday.title = title;
  if (date) holiday.date = date;
  if (description !== undefined) holiday.description = description;

  await holiday.save();

  res
    .status(200)
    .json(new ApiResponse(200, holiday, "Holiday updated successfully"));
});
export const deleteHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query = { _id: id };

  if (req.user.role !== "admin") {
    query.createdBy = req.user.id;
  }

  const deleted = await Holiday.findOneAndDelete(query);

  if (!deleted) {
    throw new ApiError(404, "Holiday not found or access denied");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Holiday deleted successfully"));
});
export const addLeaveType = asyncHandler(async (req, res) => {
  const {
    name,
    maxDaysPerYear,
    carryForward = false,
    accrualType = null, 
    accrualRate = 0,
  } = req.body;

  const userId = req.user.id;

  if (!name) {
    throw new ApiError(400, "Leave name is required");
  }

  if (maxDaysPerYear === undefined || maxDaysPerYear < 0) {
    throw new ApiError(400, "maxDaysPerYear must be >= 0");
  }

  const isEarnedLeave = accrualType === "monthly";

  const leaveType = await LeaveType.create({
    name,
    maxDaysPerYear,
    carryForward: isEarnedLeave ? true : carryForward,
    accrualType,
    accrualRate: isEarnedLeave
      ? Number((maxDaysPerYear / 12).toFixed(2))
      : accrualRate,
    createdBy: userId,
  });

  res
    .status(201)
    .json(new ApiResponse(201, leaveType, "Leave type created successfully"));
});

export const getLeaveTypes = asyncHandler(async (req, res) => {
  const leaveTypes = await LeaveType.find();
  res.status(200).json(new ApiResponse(200, leaveTypes, "Leave types fetched"));
});
export const updateLeaveType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, carryForward, maxDaysPerYear } = req.body;

  const leaveType = await LeaveType.findById(id);
  if (!leaveType) {
    throw new ApiError(404, "Leave type not found");
  }
  if (req.user.role !== "admin" && !leaveType.createdBy.equals(req.user.id)) {
    throw new ApiError(403, "You are not allowed to update this leave type");
  }

  if (name !== undefined) leaveType.name = name;
  if (carryForward !== undefined) leaveType.carryForward = carryForward;

  if (maxDaysPerYear !== undefined) {
    if (maxDaysPerYear < 0) {
      throw new ApiError(400, "maxDaysPerYear must be >= 0");
    }

    leaveType.maxDaysPerYear = maxDaysPerYear;

    if (leaveType.accrualType === "monthly") {
      leaveType.accrualRate = Number((maxDaysPerYear / 12).toFixed(2));
    }
  }

  await leaveType.save();

  res
    .status(200)
    .json(new ApiResponse(200, leaveType, "Leave type updated successfully"));
});


export const deleteLeaveType = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query = { _id: id };

  if (req.user.role !== "admin") {
    query.createdBy = req.user.id;
  }

  const leaveType = await LeaveType.findOneAndDelete(query);

  if (!leaveType) {
    throw new ApiError(404, "Leave type not found or access denied");
  }

  res.status(200).json(new ApiResponse(200, null, "Leave type deleted"));
});

export const getMyLeaveTypes = asyncHandler(async (req, res) => {
  const staffId = req.user.id;
  const currentYear = new Date().getFullYear();

  // 🔹 Get staff assigned leave template
  const staff = await Staff.findById(staffId).select("leave_template");
  if (!staff) throw new ApiError(404, "Staff not found");

  // 🔹 No leave assigned
  if (!staff.leave_template || staff.leave_template.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No leave assigned to staff"));
  }

  // 🔹 Fetch ONLY assigned leave types
  const leaveTypes = await LeaveType.find({
    _id: { $in: staff.leave_template },
  });

  const leaveApplications = await LeaveApplication.find({
    staff: staffId,
    status: "Approved",
  });

  const earnedBalances = await EarnedLeaveBalance.find({
    staff: staffId,
    year: currentYear,
  });

  const leaveTypesWithUsage = leaveTypes.map((type) => {
    const leavesOfType = leaveApplications.filter(
      (leave) => leave.leaveType.toString() === type._id.toString()
    );

    const usedDays = leavesOfType.reduce((sum, leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0);

    // 🔽 Earned Leave (monthly)
    if (type.accrualType === "monthly") {
      const balance = earnedBalances.find(
        (b) => b.leaveType.toString() === type._id.toString()
      );

      const earnedDays = balance?.earnedDays ?? 0;

      return {
        _id: type._id,
        name: type.name,
        maxDays: type.maxDays,
        earnedDays,
        usedDays,
        remainingDays: earnedDays - usedDays,
      };
    }

    // 🔽 Casual / Sick
    return {
      _id: type._id,
      name: type.name,
      maxDays: type.maxDays,
      carryForward: type.carryForward,
      usedDays,
      remainingDays: type.maxDays - usedDays,
    };
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        leaveTypesWithUsage,
        "Leave types with usage fetched"
      )
    );
});
export const getStaffLeaves = asyncHandler(async (req, res) => {
  const { staffId, page = 1, limit = 50 } = req.query;

  if (!staffId) {
    throw new ApiError(400, "staffId is required");
  }

  const leaves = await LeaveApplication.find({ staff: staffId })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate("leaveType");

  res
    .status(200)
    .json(new ApiResponse(200, leaves, `Leaves for staff ${staffId} fetched`));
});
export const getMyLeaves = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  const leaves = await LeaveApplication.find({ staff: staffId })
    .populate("leaveType", "name isPaid")
    .populate("actionBy", "staff_name staff_id login_email email role")
    .sort({ createdAt: -1 });

  const formatted = leaves.map((l) => ({
    _id: l._id,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    startSession: l.startSession,
    endSession: l.endSession,
    days: l.days,
    reason: l.reason,
    status: l.status,

    appliedAt: l.createdAt,
    actionTakenAt: l.reviewedAt,
    attachment: l.attachment || { url: null, key: null },
    actionBy: l.actionBy
      ? {
          id: l.actionBy._id,
          name: l.actionBy.staff_name || "Admin",
          email: l.actionBy.login_email || l.actionBy.email || "",
          role: l.actionByModel || "",
        }
      : null,
  }));

  res.status(200).json(new ApiResponse(200, formatted, "My leaves fetched"));
});


export const getAllLeaves = asyncHandler(async (req, res) => {
  const leaves = await LeaveApplication.find()
    .populate("leaveType", "name")
    .populate("staff", "staff_name login_email")
    .populate("actionBy", "staff_name staff_id login_email role name email")
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, leaves, "All staff leaves fetched"));
});
export const updateLeaveStatus = asyncHandler(async (req, res) => {
 
  const { leaveId } = req.query;
  const { status } = req.body;

  const actionUserId = req.user?.id || req.user?._id;


  if (!actionUserId) {
    throw new ApiError(401, "Unauthorized user");
  }

  const leave = await LeaveApplication.findById(leaveId);
  if (!leave) {
    throw new ApiError(404, "Leave not found");
  }


  const validStatus = ["Approved", "Rejected"];
  if (!validStatus.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  if (leave.status === status) {
    console.log("⚠️ SAME STATUS, SKIPPING UPDATE");
    return res.json(new ApiResponse(200, leave, `Leave already ${status}`));
  }

  if (leave.status !== "Pending") {
    console.log("⚠️ Leave already reviewed");
    throw new ApiError(400, "Leave already reviewed");
  }

  if (status === "Rejected") {
    console.log("🔁 REFUNDING LEAVE BALANCE:", {
      staff: leave.staff,
      leaveType: leave.leaveType,
      days: leave.days,
    });

    await StaffLeaveBalance.findOneAndUpdate(
      { staff: leave.staff, leaveType: leave.leaveType },
      { $inc: { used: -leave.days } }
    );
  }

  leave.status = status;
  leave.actionBy = actionUserId;
  leave.actionByModel = req.user.role === "admin" ? "Admin" : "Staff";
  leave.reviewedAt = new Date();

  await leave.save();

  const populatedLeave = await LeaveApplication.findById(leave._id)
    .populate("staff", "staff_name empId")
    .populate("leaveType", "name");
  res.json(
    new ApiResponse(200, populatedLeave, `Leave ${status} successfully`),
  );
});



const getISTToday = () => {
  return new Date(
    new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    })
  );
};

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(
    new Date(y, m - 1, d).toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    })
  );
};

export const applyLeave = asyncHandler(async (req, res) => {
  const {
    leaveTypeId,
    startDate,
    endDate,
    reason,
    startSession = null,
    endSession = null,
  } = req.body;

  const staffId = req.user.id;

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const today = getISTToday();

 

  if (start < today) {
    throw new ApiError(400, "Backdate leave is not allowed");
  }

  if (end < start) {
    throw new ApiError(400, "End date cannot be before start date");
  }

  const validSessions = ["Morning", "Evening"];

  if (startSession && !validSessions.includes(startSession)) {
    throw new ApiError(400, "Invalid start session");
  }

  if (endSession && !validSessions.includes(endSession)) {
    throw new ApiError(400, "Invalid end session");
  }

  if (start.getTime() === end.getTime()) {
    if (startSession && endSession && startSession !== endSession) {
      throw new ApiError(400, "Same-day leave can have only one session");
    }
  }

  if (start.getTime() === today.getTime()) {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() - 1);
    dayStart.setUTCHours(18, 30, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setUTCHours(18, 29, 59, 999);

   

    const todayAttendance = await Attendance.findOne({
      staff: staffId,
      date: { $gte: dayStart, $lte: dayEnd },
    });

  

    if (
      todayAttendance &&
      (todayAttendance.check_in || todayAttendance.status === "Present")
    ) {
      throw new ApiError(
        400,
        "Attendance already marked today, leave cannot be applied"
      );
    }
  }

 const isSameDay = start.getTime() === end.getTime();

 let totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

 if (isSameDay) {
   totalDays = startSession || endSession ? 0.5 : 1;
 } else {
   if (startSession === "Evening") totalDays -= 0.5;
   if (endSession === "Morning") totalDays -= 0.5;
 }


  if (totalDays <= 0) {
    throw new ApiError(400, "Invalid leave duration");
  }

  const balance = await StaffLeaveBalance.findOne({
    staff: staffId,
    leaveType: leaveTypeId,
  });

 

  if (!balance) {
    throw new ApiError(400, "This leave is not assigned to you");
  }

  const remaining = balance.totalAssigned - balance.used;
  

  if (totalDays > remaining) {
    throw new ApiError(400, `You only have ${remaining} leave(s) remaining`);
  }

  const weeklyHolidays = await WeeklyHoliday.find().select("day");
  const weeklyHolidaySet = new Set(weeklyHolidays.map((h) => h.day));

  const getDayName = (date) =>
    date.toLocaleDateString("en-IN", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    });

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = getDayName(d);
    if (weeklyHolidaySet.has(dayName)) {
      throw new ApiError(
        400,
        `Leave cannot be applied on weekly holiday (${dayName})`
      );
    }
  }
 let attachment = null;

 if (req.file) {
   const uploaded = await uploadFile({
     file: req.file,
     staffId,
   });

   attachment = {
     url: uploaded.url,
     key: uploaded.key,
   };
 }

  const newLeave = await LeaveApplication.create({
    staff: staffId,
    leaveType: leaveTypeId,
    startDate: start,
    endDate: end,
    startSession,
    endSession,
    reason,
    days: totalDays,
    status: "Pending",
    attachment,
  });

 

  balance.used += totalDays;
  await balance.save();

  const staff = await Staff.findById(staffId)
    .populate("department", "name")
    .populate("reporting_manager", "staff_name login_email")
    .populate("attendance_supervisor", "staff_name login_email")
    .select("staff_name staff_id login_email");

  const leaveType = await LeaveType.findById(leaveTypeId).select("name");

  const staffName = staff.staff_name;
  const leaveName = leaveType?.name || "Leave";

  const title = `📝 Leave Request · ${staffName}`;
  const message = `${staffName} applied for ${leaveName} from ${startDate} to ${endDate} (${totalDays} day(s)).`;

 

  const admins = await Admin.find({ isAdmin: true }).select("_id");

  if (admins.length > 0) {
    await createNotification({
      title,
      message,
      createdByStaff: staffId,
      audienceType: "admin",
      targetAdmins: admins.map((a) => a._id),
      sendAt: new Date(),
      meta: {
        type: "leave",
        leaveId: newLeave._id,
        staffId,
        staffName,
        leaveType: leaveName,
        days: totalDays,
        startDate,
        endDate,
        startSession,
        endSession,
        reason,
      },
    });

    emitNotification({ audienceType: "admin" });
  }
  const recipients = [];

  if (staff?.reporting_manager?.login_email) {
    recipients.push(staff.reporting_manager.login_email);
  }

  if (staff?.attendance_supervisor?.login_email) {
    recipients.push(staff.attendance_supervisor.login_email);
  }

  if (recipients.length > 0) {
    const emailHtml = leaveApplicationTemplate({
      staffName,
      leaveType: leaveName,
      startDate,
      endDate,
      days: totalDays,
      reason,
      startSession,
      endSession,
    });
const fromEmail = staff?.login_email;

    await sendEmail({
      from: fromEmail,
      to: recipients,
      subject: `Leave Request - ${staffName}`,
      html: emailHtml,
    });
  }

  res
    .status(201)
    .json(new ApiResponse(201, newLeave, "Leave applied successfully"));
});
export const updateLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const {
    startDate,
    endDate,
    reason,
    startSession = null,
    endSession = null,
  } = req.body;

  const staffId = req.user.id;

  const leave = await LeaveApplication.findOne({ _id: id, staff: staffId });

  if (!leave) {
    throw new ApiError(404, "Leave not found");
  }

  if (leave.status !== "Pending") {
    throw new ApiError(400, "You can edit only pending leave");
  }

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const today = getISTToday();

  if (start < today) {
    throw new ApiError(400, "Backdate leave is not allowed");
  }

  if (end < start) {
    throw new ApiError(400, "End date cannot be before start date");
  }

  const validSessions = ["Morning", "Evening"];

  if (startSession && !validSessions.includes(startSession)) {
    throw new ApiError(400, "Invalid start session");
  }

  if (endSession && !validSessions.includes(endSession)) {
    throw new ApiError(400, "Invalid end session");
  }

  if (start.getTime() === end.getTime()) {
    if (startSession && endSession && startSession !== endSession) {
      throw new ApiError(400, "Same-day leave can have only one session");
    }
  }

  const isSameDay = start.getTime() === end.getTime();

  let totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  if (isSameDay) {
    totalDays = startSession || endSession ? 0.5 : 1;
  } else {
    if (startSession === "Evening") totalDays -= 0.5;
    if (endSession === "Morning") totalDays -= 0.5;
  }


  if (totalDays <= 0) {
    throw new ApiError(400, "Invalid leave duration");
  }

  const balance = await StaffLeaveBalance.findOne({
    staff: staffId,
    leaveType: leave.leaveType,
  });

  if (!balance) {
    throw new ApiError(400, "This leave is not assigned to you");
  }

  const oldDays = leave.days;
  const remaining = balance.totalAssigned - balance.used + oldDays;

  if (totalDays > remaining) {
    throw new ApiError(400, `You only have ${remaining} leave(s) remaining`);
  }

  const weeklyHolidays = await WeeklyHoliday.find().select("day");
  const weeklyHolidaySet = new Set(weeklyHolidays.map((h) => h.day));

  const getDayName = (date) =>
    date.toLocaleDateString("en-IN", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    });

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = getDayName(d);
    if (weeklyHolidaySet.has(dayName)) {
      throw new ApiError(
        400,
        `Leave cannot be applied on weekly holiday (${dayName})`,
      );
    }
  }
let attachment = leave.attachment || { url: null, key: null };

if (req.file) {
  const uploaded = await uploadFile({
    file: req.file,
    staffId,
  });

  attachment = {
    url: uploaded.url,
    key: uploaded.key,
  };
}

leave.attachment = attachment;

  leave.startDate = start;
  leave.endDate = end;
 leave.startSession = startSession;
 leave.endSession = endSession;

  leave.reason = reason;
  leave.days = totalDays;

  await leave.save();

  balance.used = balance.used - oldDays + totalDays;
  await balance.save();

  res
    .status(200)
    .json(new ApiResponse(200, leave, "Leave updated successfully"));
});

export const deleteLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const staffId = req.user.id;

  const leave = await LeaveApplication.findOne({ _id: id, staff: staffId });

  if (!leave) {
    throw new ApiError(404, "Leave not found");
  }

  if (leave.status !== "Pending") {
    throw new ApiError(400, "You can delete only pending leave");
  }

  const balance = await StaffLeaveBalance.findOne({
    staff: staffId,
    leaveType: leave.leaveType,
  });

  if (balance) {
    balance.used = Math.max(0, balance.used - (leave.days || 0));
    await balance.save();
  }

  await LeaveApplication.findByIdAndDelete(id);

  res
    .status(200)
    .json(new ApiResponse(200, null, "Leave deleted successfully"));
});
export const deleteLeaveByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const loggedInUser = req.user;
  const isAdmin = loggedInUser.role === "admin";
  const hasPermission =
    loggedInUser.permissions?.includes("leave:delete") ||
    loggedInUser.permissions?.includes("*");

  if (!isAdmin && !hasPermission) {
    throw new ApiError(403, "You don't have permission to delete leave");
  }

  const leave = await LeaveApplication.findById(id);

  if (!leave) {
    throw new ApiError(404, "Leave not found");
  }

  if (leave.status !== "Pending") {
    throw new ApiError(400, "You can delete only pending leave");
  }

  const balance = await StaffLeaveBalance.findOne({
    staff: leave.staff,
    leaveType: leave.leaveType,
  });

  if (balance) {
    balance.used = Math.max(0, balance.used - (leave.days || 0));
    await balance.save();
  }

  if (leave.attachment?.key) {
    await deleteFile(leave.attachment.key);
  }

  await LeaveApplication.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Leave deleted successfully"));
});
export const applyLeaveByHR = asyncHandler(async (req, res) => {
  const {
    staffId,
    leaveTypeId,
    startDate,
    endDate,
    reason,
    startSession = null,
    endSession = null,
  } = req.body;

  

  if (!staffId || !leaveTypeId || !startDate || !endDate) {
    throw new ApiError(400, "All required fields must be provided");
  }

  const toISTDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  };

  const normalizeUTC = (d) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
  };

  const start = normalizeUTC(toISTDate(startDate));
  const end = normalizeUTC(toISTDate(endDate));

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  

  if (end < start) {
    throw new ApiError(400, "End date cannot be before start date");
  }

  if (start.getTime() < today.getTime()) {
    throw new ApiError(400, "Backdate leave is not allowed");
  }

  const validSessions = ["Morning", "Evening"];

  if (startSession && !validSessions.includes(startSession)) {
    throw new ApiError(400, "Invalid start session");
  }

  if (endSession && !validSessions.includes(endSession)) {
    throw new ApiError(400, "Invalid end session");
  }

  if (start.getTime() === end.getTime()) {
    if (startSession && endSession && startSession !== endSession) {
      throw new ApiError(400, "Same-day leave can have only one session");
    }
  }
if (start.getTime() === today.getTime()) {
  const dayStart = new Date(start);
  dayStart.setUTCDate(dayStart.getUTCDate() - 1);
  dayStart.setUTCHours(18, 30, 0, 0);

  const dayEnd = new Date(start);
  dayEnd.setUTCHours(18, 29, 59, 999);

  

  const todayAttendance = await Attendance.findOne({
    staff: staffId,
    date: { $gte: dayStart, $lte: dayEnd },
  });

  

  if (
    todayAttendance &&
    (todayAttendance.check_in || todayAttendance.status === "Present")
  ) {
    throw new ApiError(
      400,
      "Attendance already marked today, leave cannot be applied"
    );
  }
}


  const weeklyOffDay = await checkWeeklyOffBetweenDates(start, end);
 

  if (weeklyOffDay) {
    throw new ApiError(400, `Already on weekly off (${weeklyOffDay})`);
  }

  let totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  if (startSession) totalDays -= 0.5;
  if (endSession) totalDays -= 0.5;

 

  if (totalDays <= 0) {
    throw new ApiError(400, "Invalid leave duration");
  }

  const balance = await StaffLeaveBalance.findOne({
    staff: staffId,
    leaveType: leaveTypeId,
  });

  

  if (!balance) {
    throw new ApiError(400, "Leave not assigned to this staff");
  }

  const remaining = Math.max(balance.totalAssigned - balance.used, 0);
 

  if (totalDays > remaining) {
    throw new ApiError(400, `Staff has only ${remaining} leave(s) remaining`);
  }

  const newLeave = await LeaveApplication.create({
    staff: staffId,
    leaveType: leaveTypeId,
    startDate: start,
    endDate: end,
    startSession,
    endSession,
    reason,
    days: totalDays,
    appliedBy: req.user.id,
    status: "Pending",
  });

 

  balance.used += totalDays;
  await balance.save();

  const leaveType = await LeaveType.findById(leaveTypeId).select("name");

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });

  const title = `Leave Applied · ${leaveType?.name || "Leave"}`;
  const message = `Leave applied for ${formatDate(start)} to ${formatDate(
    end
  )} (${totalDays} day(s))`;

  console.log("NOTIFICATION", { title, message });

  await createNotification({
    title,
    message,
    createdByAdmin: req.user.id,
    audienceType: "individual",
    targetStaff: [staffId],
    sendAt: new Date(),
    meta: {
      type: "leave",
      leaveId: newLeave._id,
      leaveType: leaveType?.name,
      startSession,
      endSession,
      days: totalDays,
    },
  });

  emitNotification({
    audienceType: "individual",
    staffIds: [staffId],
    payload: {
      type: "leave",
      leaveId: newLeave._id,
      title,
      message,
    },
  });

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        newLeave,
        "Leave application submitted successfully by HR"
      )
    );
});

export const getLeavesOfMyTeam = asyncHandler(async (req, res) => {
  const userId = req.user._id; // logged-in user's id
  const userRole = req.user.access_level; // Admin, HR, Staff

  if (userRole === "Staff") {
    return res
      .status(403)
      .json(new ApiResponse(403, null, "Only managers or HOD can access this"));
  }

  // Find all staff who report to this manager or HOD
  const teamStaffIds = await Staff.find({
    $or: [
      { reporting_manager: userId }, // direct reports
      { hod: userId }, // HOD sees all in their department
    ],
  }).distinct("_id"); // get only the IDs

  // Fetch leave applications of the team
  const leaves = await LeaveApplication.find({ staff: { $in: teamStaffIds } })
    .populate("leaveType")
    .populate("staff", "staff_name login_email reporting_manager hod");

  res
    .status(200)
    .json(new ApiResponse(200, leaves, "Team leaves fetched successfully"));
});
export const generateLeaveReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.body;

    // 🔹 Build query
    const query = {
      startDate: { $gte: new Date(startDate) },
      endDate: { $lte: new Date(endDate) },
    };
    if (status) query.status = status;

    // 🔹 Fetch leave data
    const leaves = await LeaveApplication.find(query)
      .populate("staff", "name email")
      .populate("leaveType", "name");

    // 🔹 CSV Header
    const headers = [
      "Staff Name",
      "Email",
      "Leave Type",
      "Start Date",
      "End Date",
      "Days",
      "Status",
    ];

    // 🔹 CSV Escape Helper
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      return str.includes(",") || str.includes('"')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    // 🔹 CSV Rows
    const rows = leaves.map((leave) =>
      [
        escapeCSV(leave.staff?.name),
        escapeCSV(leave.staff?.email),
        escapeCSV(leave.leaveType?.name),
        leave.startDate.toISOString().split("T")[0],
        leave.endDate.toISOString().split("T")[0],
        leave.days,
        leave.status,
      ].join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");

    // 🔹 Ensure folder exists
    const dir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 🔹 Save CSV file
    const filename = `Applied_Leaves_Report_${Date.now()}.csv`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, csvContent, "utf8");

    // 🔹 Save report record
    const report = await Report.create({
      filename,
      filepath,
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: req.user.id,
      createdByModel: req.user.role === "admin" ? "Admin" : "Staff",
    });

    // 🔹 Download URL
    const downloadUrl = `/temp/${filename}`;

    res.status(200).json({ report, downloadUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating CSV report" });
  }
};

export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    let query = { _id: id };

    // staff sirf apna delete kare
    if (req.user.role !== "admin") {
      query.createdBy = req.user.id;
      query.createdByModel = "Staff";
    }

    const report = await Report.findOne(query);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (fs.existsSync(report.filepath)) {
      fs.unlinkSync(report.filepath);
    }

    await report.deleteOne();
    res.status(200).json({ message: "Report deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting report" });
  }
};

export const getReports = async (req, res) => {
  try {
    // Fetch all reports, sorted by latest first
    const reports = await Report.find().sort({ createdAt: -1 });

    // Map download URL for frontend
    const mappedReports = reports.map((r) => ({
      _id: r._id,
      filename: r.filename,
      createdAt: r.createdAt,
      expirationDate: r.expirationDate,
      downloadUrl: `/temp/${r.filename}`, // assuming express.static serves public/temp
    }));

    res.status(200).json(mappedReports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching reports" });
  }
};
export const getMyLeaveBalance = asyncHandler(async (req, res) => {
  const staffId = req.params.staffId || req.query.staffId || req.user.id;

  if (!staffId) {
    throw new ApiError(400, "Staff ID is required");
  }

  const balances = await StaffLeaveBalance.find({ staff: staffId }).populate(
    "leaveType",
    "name isPaid"
  );

  const result = balances.map((b) => {
    const remaining = Math.max(b.totalAssigned - b.used, 0);

    return {
      leaveType: b.leaveType?.name,
      leaveTypeId: b.leaveType?._id,
      totalAssigned: b?.totalAssigned,
      used: b?.used,
      remaining,
      isPaid: b.leaveType?.isPaid,
    };
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const updateLeaveToStaffBucket = asyncHandler(async (req, res) => {
  const { staffId, leaveTypeId, totalAssigned } = req.body;

  if (!staffId || !leaveTypeId) {
    throw new ApiError(400, "staffId and leaveTypeId are required");
  }

  if (totalAssigned == null || totalAssigned < 0) {
    throw new ApiError(400, "Valid totalAssigned is required");
  }

  const balance = await StaffLeaveBalance.findOne({
    staff: staffId,
    leaveType: leaveTypeId,
  });

  if (!balance) {
    throw new ApiError(
      404,
      "Leave balance not found. Please assign leave first."
    );
  }

  // ❌ used se kam nahi hone dena
  if (totalAssigned < balance.used) {
    throw new ApiError(400, "totalAssigned cannot be less than used leaves");
  }

  balance.totalAssigned = totalAssigned;
  await balance.save();

  res
    .status(200)
    .json(new ApiResponse(200, balance, "Leave balance updated successfully"));
});
