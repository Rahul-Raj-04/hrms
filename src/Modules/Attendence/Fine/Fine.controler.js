import { FINE_RULES } from "../../../constants/fineRules.js";
import { ApiError } from "../../../Utils/ApiError.js";
import { ApiResponse } from "../../../Utils/ApiResponse.js";
import { asyncHandler } from "../../../Utils/asyncHandler.js";
import Shift from "../../Shift/Shift.model.js";
import Fine from "./Fine.modal.js";



const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const isRuleEnabled = (ruleKey) => {
  return FINE_RULES.find((r) => r.key === ruleKey && r.enabled && r.auto);
};

const getRequiredWorkingMinutes = async (attendance, shift) => {
  if (!shift) return 9 * 60;

  let start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);

  if (end <= start) end += 24 * 60;
  const buffer = shift.bufferMinutes || 0;
  return end - start - buffer;
};

export const applyAutoFines = async (attendance, trigger) => {
  const staff = await attendance.populate("staff", "work_shift");
  const shift = await Shift.findById(staff.staff?.work_shift);

  const fines = [];
const requiredWorkingMinutes = await getRequiredWorkingMinutes(
  attendance,
  shift,
);
const ALLOWED_BREAK_MINUTES = shift?.allowedBreakMinutes || 60;


  if (
    trigger === "PUNCH_IN" &&
    attendance.is_late &&
    attendance.late_by_minutes > 0 &&
    isRuleEnabled("LATE_IN")
  ) {
    fines.push({
      rule_key: "LATE_IN",
      type: "LATE_IN",
      category: "TIME_ATTENDANCE",
      minutes: attendance.late_by_minutes,
      remarks: "Late punch-in",
    });
  }


  if (
    trigger === "PUNCH_OUT" &&
    attendance.check_in &&
    attendance.check_out &&
    attendance.working_hours &&
    isRuleEnabled("SHORT_HOURS")
  ) {
    const workedMinutes = Math.round(attendance.working_hours * 60);

    if (workedMinutes < requiredWorkingMinutes) {
      fines.push({
        rule_key: "SHORT_HOURS",
        type: "SHORT_HOURS",
        category: "TIME_ATTENDANCE",
        minutes: requiredWorkingMinutes - workedMinutes,
        remarks: "Insufficient working hours",
      });
    }
  }

 
  if (
    trigger === "BREAK_END" &&
    attendance.breaks?.length &&
    isRuleEnabled("OVER_BREAK")
  ) {
    const totalBreak = attendance.breaks.reduce(
      (sum, b) => sum + (b.duration || 0),
      0
    );

    if (totalBreak > ALLOWED_BREAK_MINUTES) {
      fines.push({
        rule_key: "OVER_BREAK",
        type: "OVER_BREAK",
        category: "BREAK",
        minutes: totalBreak - ALLOWED_BREAK_MINUTES,
        remarks: "Exceeded break time",
      });
    }
  }

  if (fines.length) {
    // Remove previous auto fines (not approved)
    await Fine.deleteMany({
      attendance: attendance._id,
      approved: false,
      is_active: true,
    });

    await Fine.insertMany(
      fines.map((f) => ({
        ...f,
        staff: attendance.staff,
        attendance: attendance._id,
        date: attendance.date,
        shift: attendance.work_shift || null,
      }))
    );

    attendance.has_fine = true;
    await attendance.save();
  } else {
    attendance.has_fine = false;
    await attendance.save();
  }
};

export const getPendingFines = asyncHandler(async (req, res) => {
  const { id: userId, role, permissions } = req.user;

  const filter = {
    approved: false,
  };

  // 👤 STAFF → sirf apni fines
  // (admin ke paas "*" permission hota hai)
  const isAdmin = role === "admin" || permissions?.includes("*");

  if (!isAdmin) {
    filter.staff = userId;
  }

  const fines = await Fine.find(filter)
    .populate("staff", "staff_name staff_code")
    .populate("attendance", "date")
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, fines, "Pending fines fetched successfully"));
});

export const getMyPendingFines = asyncHandler(async (req, res) => {
  const { id: userId } = req.user;

  const fines = await Fine.find({
    staff: userId,        // ✅ only own
    is_active: true,
  })
    .populate("attendance", "date")
    .sort({ createdAt: -1 });

  res.json(
    new ApiResponse(200, fines, "My pending fines fetched successfully")
  );
});
export const getAllFines = asyncHandler(async (req, res) => {
  const { role, permissions } = req.user;

  const isAdmin = role === "admin" || permissions?.includes("*");
  if (!isAdmin) {
    throw new ApiError(403, "Access denied");
  }

  const { status } = req.query;

  const filter = { is_active: true };
  if (status === "pending") filter.approved = false;
  if (status === "approved") filter.approved = true;

  const fines = await Fine.find(filter)
    .populate({
      path: "staff",
      select: "staff_name staff_id work_shift",
      populate: {
        path: "work_shift",
        select: "name startTime endTime",
      },
    })
    .populate("attendance", "date")
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, fines, "All fines fetched successfully"));
});


export const approveFine = asyncHandler(async (req, res) => {
  const { fineId, action, amount = 0, remarks } = req.body;

  if (!["PARDON", "DEDUCT"].includes(action)) {
    throw new ApiError(400, "Invalid fine action");
  }

  const fine = await Fine.findById(fineId);
  if (!fine) {
    throw new ApiError(404, "Fine not found");
  }

  fine.action = action;
  fine.amount = action === "DEDUCT" ? amount : 0;
  fine.approved = true;
  fine.approved_by = req.user.id;
  fine.approved_at = new Date();
  fine.remarks = remarks || fine.remarks;

  await fine.save();

  res.json(new ApiResponse(200, fine, "Fine updated successfully"));
});
