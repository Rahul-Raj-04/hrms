import jwt from "jsonwebtoken";
import { Admin } from "../Modules/Admin/Admin.Model.js";
import Staff from "../Modules/Staff/Staff.model.js";

export const authVerifyJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.cookies?.access_token ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (!decoded?._id || !decoded?.userType) {
      return res.status(401).json({ message: "Invalid token" });
    }

    let user;

    if (decoded.userType === "admin") {
      user = await Admin.findById(decoded._id).select(
        "-password -refreshToken"
      );

      if (!user) {
        return res.status(401).json({ message: "Admin not found" });
      }

      req.user = {
        id: user._id,
        role: "admin",
        permissions: ["*"],
      };
    }

    if (decoded.userType === "staff") {
      user = await Staff.findById(decoded._id).select("-password");

      if (!user) {
        return res.status(401).json({ message: "Staff not found" });
      }

      req.user = {
        id: user._id,
        role: user.access_level,
        permissions: user.permissions || [],
      };
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
