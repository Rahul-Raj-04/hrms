// import jwt from "jsonwebtoken";
// import Staff from "../Modules/Staff/Staff.model.js";
// export const staffVerifyJWT = async (req, res, next) => {
//   try {
//     const token =
//       req.cookies?.access_token || // match frontend cookie
//       req.header("Authorization")?.replace("Bearer ", "");

//     if (!token) {
//       return res
//         .status(401)
//         .json({ success: false, message: "No token provided" });
//     }

//     const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//     if (!decodedToken?._id) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized request: Invalid token structure",
//       });
//     }

//     const staff = await Staff.findById(decodedToken._id).select("-password");

//     if (!staff) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Staff not found" });
//     }

//     req.user = {
//       id: staff._id,
//       role: staff.access_level, // HR / Manager / Staff
//       permissions: staff.permissions || [],
//     };
//     next();
//   } catch (error) {
//     console.error("❌ Error in staffVerifyJWT middleware:", error);
//     return res
//       .status(401)
//       .json({ success: false, message: "Invalid or expired token" });
//   }
// };
