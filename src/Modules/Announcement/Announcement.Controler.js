import mongoose from "mongoose";
import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import Announcement from "./Announcement.model.js";
import { createNotification } from "../Notification/Notification.controler.js";
import Staff from "../Staff/Staff.model.js";
import { emitNotification } from "../../Utils/sseManager.js";
import moment from "moment-timezone";

export const createAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    audienceType,
    targetDepartments = [],
    targetStaff = [],
    startDate,
    expiryDate,
  } = req.body;

  const start = moment.tz(startDate, "Asia/Kolkata").startOf("day").toDate();
  const expiry = moment.tz(expiryDate, "Asia/Kolkata").endOf("day").toDate();

  const announcement = await Announcement.create({
    title,
    description,
    postedBy: req.user.id,
    audienceType,
    targetDepartments,
    targetStaff,
    startDate: start,
    expiryDate: expiry,
    isActive: true,
  });

  let staffRecipients = [];

  if (audienceType === "department" && targetDepartments.length > 0) {
    const deptIds = targetDepartments.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const staffList = await Staff.find({
      department: { $in: deptIds },
      work_status: "Active",
    }).select("_id");

    staffRecipients = staffList.map((s) => s._id);
  }

  if (audienceType === "individual" && targetStaff.length > 0) {
    staffRecipients = targetStaff.map((id) => new mongoose.Types.ObjectId(id));
  }

  if (audienceType === "all") {
    await createNotification({
      title: `📢 ${title}`,
      message: description,
      createdByHr: req.user.id,
      audienceType: "all",
      sendAt: new Date(),
      expiresAt: expiry,
    });

    emitNotification({
      audienceType: "all",
      payload: {
        type: "announcement",
        title,
        message: description,
        createdAt: new Date(),
      },
    });
  } else if (staffRecipients.length > 0) {
    await createNotification({
      title: `📢 ${title}`,
      message: description,
      createdByHr: req.user.id,
      audienceType: "individual",
      targetStaff: staffRecipients,
      sendAt: new Date(),
      expiresAt: expiry,
    });

    emitNotification({
      audienceType: "individual",
      staffIds: staffRecipients,
      payload: {
        type: "announcement",
        title,
        message: description,
        createdAt: new Date(),
      },
    });
  }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        announcement,
        "Announcement created & notification sent",
      ),
    );
});

export const getAllAnnouncementsForHR = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find()
    .populate("postedBy", "name")
    .populate("targetDepartments", "name")
    .sort({ startDate: -1 });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        announcements,
        "All announcements fetched successfully",
      ),
    );
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  await announcement.deleteOne();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Announcement deleted successfully"));
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    audienceType,
    targetDepartments,
    targetStaff,
    startDate,
    expiryDate,
  } = req.body;

  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  announcement.title = title ?? announcement.title;
  announcement.description = description ?? announcement.description;
  announcement.audienceType = audienceType ?? announcement.audienceType;
  announcement.targetDepartments =
    targetDepartments ?? announcement.targetDepartments;
  announcement.targetStaff = targetStaff ?? announcement.targetStaff;

  if (startDate) {
    announcement.startDate = moment
      .tz(startDate, "Asia/Kolkata")
      .startOf("day")
      .toDate();
  }

  if (expiryDate) {
    announcement.expiryDate = moment
      .tz(expiryDate, "Asia/Kolkata")
      .endOf("day")
      .toDate();
  }

  await announcement.save();

  res
    .status(200)
    .json(
      new ApiResponse(200, announcement, "Announcement updated successfully"),
    );
});

export const getAnnouncementsForStaff = asyncHandler(async (req, res) => {
  const staffId = req.user.id;
  const staffObjectId = new mongoose.Types.ObjectId(staffId);

  const staff = await Staff.findById(staffId).select("department");
  if (!staff) throw new ApiError(404, "Staff not found");

  const now = moment().tz("Asia/Kolkata").toDate();

 const announcements = await Announcement.find({
   isActive: true,
   expiryDate: { $gte: now },
   $or: [
     { audienceType: "all" },
     { audienceType: "individual", targetStaff: { $in: [staffObjectId] } },
     {
       audienceType: "department",
       targetDepartments: { $in: [staff.department] },
     },
   ],
 })

   .populate("postedBy", "staff_name")
   .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: announcements,
    message: "Announcements fetched successfully",
  });
});
