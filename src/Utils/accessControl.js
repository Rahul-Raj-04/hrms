import { ROLE_POLICY } from "../constants/rolePolicy.js";
import { ApiError } from "./ApiError.js";


export const canAccessModule = (user, module) => {
  return ROLE_POLICY[user.access_level]?.modules.includes(module);
};

export const can = (user, permission) => {
  return ROLE_POLICY[user.access_level]?.permissions.includes(permission);
};

export const guard = (permission) => {
  return (req, _res, next) => {
    if (!can(req.user, permission)) {
      throw new ApiError(403, "Access denied");
    }
    next();
  };
};

export const resolveStaffId = (req) => {
  const user = req.user;

  // 🧑‍💼 Staff → only self
  if (user.access_level === "Staff") {
    return user._id;
  }

  // 🧑‍💻 Admin / HR / Manager
  if (["Admin", "HR", "Manager"].includes(user.access_level)) {
    // ✔ staffId diya ho → dusre ke liye
    if (req.body.staffId) {
      return req.body.staffId;
    }

    // ✔ staffId nahi diya → khud ke liye
    return user._id;
  }

  throw new ApiError(403, "Invalid role");
};
