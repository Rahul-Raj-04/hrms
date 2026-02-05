import moment from "moment";

export const calculateLate = ({
  date, // YYYY-MM-DD (IST attendance date)
  checkInTime, // Date (UTC)
  shiftStartTime, // HH:mm
  shiftEndTime, // HH:mm
  graceMinutes = 10,
}) => {
  if (!checkInTime || !shiftStartTime) {
    return { isLate: false, lateByMinutes: 0 };
  }

  const checkInIST = moment(checkInTime).tz("Asia/Kolkata");

  let shiftStartIST;

  const isNightShift = shiftStartTime > shiftEndTime;

  if (isNightShift) {
    // 👇 night shift always starts on attendance date
    shiftStartIST = moment.tz(
      `${date} ${shiftStartTime}`,
      "YYYY-MM-DD HH:mm",
      "Asia/Kolkata"
    );
  } else {
    // day shift
    shiftStartIST = moment.tz(
      `${date} ${shiftStartTime}`,
      "YYYY-MM-DD HH:mm",
      "Asia/Kolkata"
    );
  }

  const diffMinutes = checkInIST.diff(shiftStartIST, "minutes");

  if (diffMinutes > graceMinutes) {
    return {
      isLate: true,
      lateByMinutes: diffMinutes,
    };
  }

  return { isLate: false, lateByMinutes: 0 };
};
