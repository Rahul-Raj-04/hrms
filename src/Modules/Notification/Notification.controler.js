import mongoose from "mongoose";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import Notification from "./Notification.model.js";
import Staff from "../Staff/Staff.model.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";

export const createNotification = async ({
  title,
  message,
  createdByHr = null,
  createdByStaff = null,
  createdByAdmin = null,
  audienceType = "all",
  targetDepartments = [],
  targetStaff = [],
  targetHRs = [],
  targetAdmins = [],
  sendAt = new Date(),
  expiresAt = null,
}) => {
  const notificationData = {
    title,
    message,
    createdByHr,
    createdByStaff,
    createdByAdmin,
    channels: {
      inApp: true,
      email: false,
      push: false,
      sms: false,
    },
    sendAt,
    expiresAt,
  };

  if (audienceType === "all") {
    notificationData.allStaff = true;
  }

  if (audienceType === "department") {
    notificationData.departmentRecipients = targetDepartments;
  }

  if (audienceType === "individual") {
    notificationData.staffRecipients = targetStaff;
  }

  if (audienceType === "hr") {
    notificationData.hrRecipients = targetHRs;
  }
if (audienceType === "admin") {
  notificationData.adminRecipients = targetAdmins;
}

  const notification = await Notification.create(notificationData);
  return notification;
};

export const getStaffNotifications = asyncHandler(async (req, res) => {
  const staffId = req.user.id;

  const staff = await Staff.findById(staffId).select("_id department");
  if (!staff) {
    return res.status(404).json({ success: false, message: "Staff not found" });
  }

  const notifications = await Notification.find({
    $and: [
      {
        $or: [
          { allStaff: true },
          { staffRecipients: staff._id },
          { departmentRecipients: staff.department },
        ],
      },
      { clearedByStaff: { $ne: staff._id } },
    ],
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: notifications.length,
    data: notifications,
  });
});
export const getHrNotifications = asyncHandler(async (req, res) => {
  const hrId = req.user.id;

  const notifications = await Notification.find({
    $and: [
      { $or: [{ allStaff: true }, { hrRecipients: hrId }] },
      { clearedByHr: { $ne: hrId } },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    count: notifications.length,
    data: notifications,
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  // Ensure readBy array exists
  if (!Array.isArray(notification.readBy)) {
    notification.readBy = [];
  }

  const alreadyRead = notification.readBy
    .map((id) => id.toString())
    .includes(userId.toString());

  if (!alreadyRead) {
    notification.readBy.push(new mongoose.Types.ObjectId(userId));

    // ✅ IMPORTANT FIX
    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();
  }

  res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: {
      _id: notification._id,
      isRead: notification.isRead,
      readAt: notification.readAt,
    },
  });
});

export const markHrNotificationRead = asyncHandler(async (req, res) => {
  const hrId = req.user.id;
  const { notificationId } = req.params;

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  if (!Array.isArray(notification.readBy)) {
    notification.readBy = [];
  }

  if (!notification.readBy.map(id => id.toString()).includes(hrId.toString())) {
    notification.readBy.push(new mongoose.Types.ObjectId(hrId));
    await notification.save();
  }

  res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: {
      _id: notification._id,
      isRead: true,
    },
  });
});
export const getAdminNotifications = asyncHandler(async (req, res) => {
  const adminId = req.user.id;

  const notifications = await Notification.find({
    $and: [
      {
        adminRecipients: adminId,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
      { clearedByAdmins: { $ne: adminId } },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  res
    .status(200)
    .json(new ApiResponse(200, notifications, "Admin notifications fetched"));
});


export const markAdminNotificationRead = asyncHandler(async (req, res) => {
  const adminId = req.user.id;
  const { notificationId } = req.params;

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found",
    });
  }

  // init if missing
  if (!Array.isArray(notification.readByAdmins)) {
    notification.readByAdmins = [];
  }

  const alreadyRead = notification.readByAdmins
    .map((id) => id.toString())
    .includes(adminId.toString());

  if (!alreadyRead) {
    notification.readByAdmins.push(new mongoose.Types.ObjectId(adminId));
    await notification.save();
  }

  res.status(200).json({
    success: true,
    message: "Admin notification marked as read",
    data: {
      _id: notification._id,
      isRead: true,
    },
  });
});
export const clearMyNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const permissions = req.user.permissions || [];

  const isAdmin = Array.isArray(permissions) && permissions.includes("*");

  let update = {};

  if (isAdmin) {
    update = {
      $addToSet: {
        clearedByAdmins: new mongoose.Types.ObjectId(userId),
        readByAdmins: new mongoose.Types.ObjectId(userId),
      },
    };
  } else {
    update = {
      $addToSet: {
        clearedByStaff: new mongoose.Types.ObjectId(userId),
        readBy: new mongoose.Types.ObjectId(userId),
      },
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    };
  }

  await Notification.updateMany({}, update);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Notifications cleared & marked as read"));
});

export const clearAdminNotifications = asyncHandler(async (req, res) => {
  const adminId = req.user.id;

  await Notification.updateMany(
    {
      $or: [
        { allAdmins: true },
        { adminRecipients: new mongoose.Types.ObjectId(adminId) },
      ],
    },
    {
      $addToSet: {
        clearedByAdmins: new mongoose.Types.ObjectId(adminId),
        readByAdmins: new mongoose.Types.ObjectId(adminId),
      },
    },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Admin notifications cleared successfully"));
});
