import moment from "moment-timezone";

export const getTodayISTDate = () => {
  return moment
    .tz("Asia/Kolkata") 
    .startOf("day")
    .utc() 
    .toDate();
};
export const getNowUTCFromIST = () => {
  return moment.tz("Asia/Kolkata").utc().toDate();
};
export const getYesterdayISTDate = () => {
  return moment
    .tz("Asia/Kolkata")
    .subtract(1, "day")
    .startOf("day")
    .utc()
    .toDate();
};



export const getISTStartDateUTC = (dateStr) => {
  return moment
    .tz(dateStr, "YYYY-MM-DD", "Asia/Kolkata")
    .startOf("day")
    .utc()
    .toDate();
};

export const getUTCFromISTDateTime = (dateStr, timeStr) => {
 
  const istDateTimeStr = `${dateStr} ${timeStr}`;
  return moment
    .tz(istDateTimeStr, "YYYY-MM-DD HH:mm", "Asia/Kolkata")
    .utc()
    .toDate();
};

export const getTodayISTEndDate = () => {
  return moment.tz("Asia/Kolkata").endOf("day").utc().toDate();
};
