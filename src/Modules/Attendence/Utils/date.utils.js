import moment from "moment";
import { ApiError } from "../../../Utils/ApiError.js";

export const parseDateStrict = (date) => {
  const d = moment(date, ["YYYY-MM-DD", "YYYY-M-DD"], true);
  if (!d.isValid()) {
    throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD");
  }
  return d.startOf("day").toDate();
};
