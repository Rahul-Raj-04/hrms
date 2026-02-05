import moment from "moment-timezone";


export const istDayStartUTC = (dateStr) => {
  return moment
    .tz(dateStr, "YYYY-MM-DD", "Asia/Kolkata")
    .startOf("day")
    .utc()
    .toDate();
};

export const istDayEndUTC = (dateStr) => {
  return moment
    .tz(dateStr, "YYYY-MM-DD", "Asia/Kolkata")
    .endOf("day")
    .utc()
    .toDate();
};


export const toIST = (date, format) => {
  return moment(date).tz("Asia/Kolkata").format(format);
};
