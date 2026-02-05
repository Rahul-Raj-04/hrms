import Staff from "../Staff/Staff.model.js";


export const assignStaffPermissions = async (req, res) => {
  const { staffId, permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({
      success: false,
      message: "Permissions must be an array",
    });
  }

  const result = await Staff.updateOne(
    { _id: staffId },
    { $set: { permissions } }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Staff not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Permissions assigned successfully",
    data: permissions,
  });
};

export const assignStaffHierarchyBulk = async (req, res) => {
  const {
    staffIds,
    reportingManagerId,
    attendanceSupervisorId,
  } = req.body;

  // 1️⃣ Validation
  if (!Array.isArray(staffIds) || staffIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "staffIds must be a non-empty array",
    });
  }

  const updateData = {};

  if (reportingManagerId) {
    updateData.reporting_manager = reportingManagerId;
  }

  if (attendanceSupervisorId) {
    updateData.attendance_supervisor = attendanceSupervisorId;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Nothing to assign",
    });
  }

  // ❌ Prevent self assignment
  if (
    staffIds.includes(reportingManagerId) ||
    staffIds.includes(attendanceSupervisorId)
  ) {
    return res.status(400).json({
      success: false,
      message: "Staff cannot be assigned to themselves",
    });
  }

  // 2️⃣ Bulk update (NO full save)
  const result = await Staff.updateMany(
    { _id: { $in: staffIds } },
    { $set: updateData }
  );

  return res.status(200).json({
    success: true,
    message: "Hierarchy assigned successfully",
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
};
