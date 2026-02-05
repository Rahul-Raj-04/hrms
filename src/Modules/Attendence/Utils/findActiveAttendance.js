import moment from "moment-timezone";
import Attendance from "../Attendence.model.js";

export const findActiveAttendance = async ({
  staffId,
  requireActiveWork = false,
  requireActiveBreak = false,
}) => {
  const tz = "Asia/Kolkata";

  const makeQuery = (dayMoment) => {
    const start = dayMoment.clone().startOf("day").toDate();
    const end = dayMoment.clone().endOf("day").toDate();

    const q = {
      staff: staffId,
      check_out: null,
      date: { $gte: start, $lte: end },
    };

    if (requireActiveWork) {
      q.work_sessions = { $elemMatch: { end_time: null } };
    }

    if (requireActiveBreak) {
      q.breaks = { $elemMatch: { end_time: null } };
    }

    return q;
  };

  // 1️⃣ Try today (IST)
  let attendance = await Attendance.findOne(makeQuery(moment.tz(tz)));
  if (attendance) return attendance;

  // 2️⃣ Fallback to yesterday (night shift)
  attendance = await Attendance.findOne(
    makeQuery(moment.tz(tz).subtract(1, "day"))
  );

  return attendance;
};
