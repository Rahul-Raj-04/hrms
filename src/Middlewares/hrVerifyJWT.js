// import jwt from "jsonwebtoken";

// import Hr from "../Modules/HR/Hr.modules.js";


// export const hrVerifyJWT = async (req, res, next) => {
//   try {
//     const token =
//       req.cookies?.accessToken ||
//       req.header("Authorization")?.replace("Bearer ", "");

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized request: No token provided",
//         data: null,
//         errors: [],
//       });
//     }

//     const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//     if (!decodedToken?._id) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized request: Invalid token structure",
//         data: null,
//         errors: [],
//       });
//     }

//     const hr = await Hr.findById(decodedToken._id).select("-password");
//     if (!hr) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized request: HR not found",
//         data: null,
//         errors: [],
//       });
//     }

//     req.hr = hr; // ✅ HR attach
//     next();
//   } catch (error) {
//     console.error("❌ Error in hrVerifyJWT middleware:", error);
//     return res.status(401).json({
//       success: false,
//       message: "Unauthorized request: Invalid or expired token",
//       data: null,
//       errors: [],
//     });
//   }
// };

