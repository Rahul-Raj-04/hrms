import cron from "node-cron";
import CronLog from "./CronLog.model.js";
import LeaveType from "../Modules/Leave/LeaveType.model.js";
import Staff from "../Modules/Staff/Staff.model.js";
import { StaffLeaveBalance } from "../Modules/Leave/StaffLeaveBalance/StaffLeaveBalance.modal.js";
import Attendance from "../Modules/Attendence/Attendence.model.js";
const runLeaveAccrual = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const staffList = await Staff.find({
    work_status: "Active",
    employment_type: { $ne: "Probation" },
  }).select("_id");

  if (!staffList.length) return;

  const leaveTypes = await LeaveType.find({});

  for (const staff of staffList) {
    for (const leave of leaveTypes) {
      if (leave.accrualType !== "monthly") {
        await StaffLeaveBalance.findOneAndUpdate(
          { staff: staff._id, leaveType: leave._id },
          {
            $setOnInsert: {
              totalAssigned: leave.maxDaysPerYear,
              used: 0,
            },
          },
          { upsert: true },
        );

        await Staff.updateOne(
          { _id: staff._id },
          { $addToSet: { leave_template: leave._id } },
        );
      }
    }
  }

  for (const staff of staffList) {
    const monthlyExists = await CronLog.findOne({
      type: "MONTHLY_LEAVE",
      key: `${monthKey}_${staff._id}`,
    });

    if (monthlyExists) continue;

    for (const leave of leaveTypes) {
      if (leave.accrualType !== "monthly") continue;

      const balance =
        (await StaffLeaveBalance.findOne({
          staff: staff._id,
          leaveType: leave._id,
        })) ||
        (await StaffLeaveBalance.create({
          staff: staff._id,
          leaveType: leave._id,
          totalAssigned: 0,
          used: 0,
        }));

      if (balance.totalAssigned < leave.maxDaysPerYear) {
        balance.totalAssigned = Math.min(
          balance.totalAssigned + leave.accrualRate,
          leave.maxDaysPerYear,
        );
        await balance.save();
      }

      await Staff.updateOne(
        { _id: staff._id },
        { $addToSet: { leave_template: leave._id } },
      );
    }

    await CronLog.create({
      type: "MONTHLY_LEAVE",
      key: `${monthKey}_${staff._id}`,
    });
  }
};

const autoPunchOutIfWorkingHoursExceed = async () => {
  const now = new Date();
  const MAX_HOURS = 11 + 50 / 60; // 

  const attendances = await Attendance.find({
    $or: [{ check_out: null }, { check_out: { $exists: false } }],
  });

  for (const attendance of attendances) {
    if (!attendance.check_in) continue;

    const workedMs = now - new Date(attendance.check_in);
    const workedHours = workedMs / (1000 * 60 * 60);

    if (workedHours < MAX_HOURS) continue;

    if (Array.isArray(attendance.work_sessions)) {
      attendance.work_sessions.forEach((s) => {
        if (!s.end_time) s.end_time = now;
      });
    }

    attendance.check_out = now;
    attendance.working_hours = Number(workedHours.toFixed(2));

    await attendance.save();
  }
};
export const initializeLeaveCron = () => {
  cron.schedule("0 */4 * * *", async () => {
    try {
      await runLeaveAccrual();
    } catch (error) {
      console.error("Leave accrual cron error:", error);
    }
  });
 cron.schedule("0 */4 * * *", async () => {
   await autoPunchOutIfWorkingHoursExceed();
 });
  runLeaveAccrual();
};
