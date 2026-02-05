// import jwt from "jsonwebtoken";
// import { asyncHandler } from "../Utils/asyncHandler.js";
// import { ApiError } from "../Utils/ApiError.js";
// import { Admin } from "../Modules/Admin/Admin.Model.js";

// export const adminVerifyJWT = async (req, res, next) => {
//   try {
//     const token =
//       req.cookies?.accessToken ||
//       req.header("Authorization")?.replace("Bearer ", "");

//     if (!token) {
//       return res
//         .status(401)
//         .json(new ApiError(401, "Unauthorized: No token provided"));
//     }

//     const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//     if (!decodedToken?._id) {
//       return res
//         .status(401)
//         .json(new ApiError(401, "Unauthorized: Invalid token structure"));
//     }

//     console.log("Fetching admin with ID:", decodedToken._id);
//     const admin = await Admin.findById(decodedToken._id).select(
//       "-password -refreshToken"
//     );
//     if (!admin) {
//       return res
//         .status(401)
//         .json(new ApiError(401, "Unauthorized: Admin not found"));
//     }

//     req.user = {
//       id: admin._id,
//       role: "admin",
//       permissions: ["*"], // admin = full access
//     };
//     next();
//   } catch (error) {
//     console.error("❌ Error in adminVerifyJWT:", error);

//     if (error.name === "TokenExpiredError") {
//       return res
//         .status(401)
//         .json(new ApiError(401, "Unauthorized: Token expired"));
//     } else if (error.name === "JsonWebTokenError") {
//       return res
//         .status(401)
//         .json(new ApiError(401, "Unauthorized: Invalid token"));
//     } else {
//       return res.status(401).json(new ApiError(401, "Unauthorized request"));
//     }
//   }
// };
