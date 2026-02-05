// import { Router } from "express";
// import {
//   addHr,
//   changeHrPassword,
//   deleteHr,
//   forgotPassword,
//   getAllHrs,
//   getHrProfile,
//   loginHr,
//   logoutHr,
//   updateHr,
//   updateHrStatus,
// } from "./Hr.controler.js";

// import { adminVerifyJWT } from "../../Middlewares/adminVerifyJWT.js";
// import { hrVerifyJWT } from "../../Middlewares/hrVerifyJWT.js";

// const router = Router();

// // ---------------------- PUBLIC / ADMIN ROUTES ----------------------
// router.post("/add", adminVerifyJWT, addHr);   // Admin adds new HR
// router.get("/all", getAllHrs);                // Get all HRs
// router.post("/login", loginHr);               // HR login
// router.post("/logout", logoutHr);             // HR logout
// router.post("/forgot_password", forgotPassword);             // HR logout

// // ---------------------- HR SELF ROUTES ----------------------
// // ✅ Specific static routes BEFORE dynamic :id routes
// router.patch("/change-password", hrVerifyJWT, changeHrPassword);  // HR changes own password

// // ---------------------- DYNAMIC ROUTES ----------------------
// router.patch("/:id/status", updateHrStatus);  // Update HR status by ID
// router.patch("/:id", updateHr);               // Update HR by ID
// router.delete("/:id", deleteHr);              // Delete HR by ID
// router.get("/:id", getHrProfile);             // Get HR profile by ID

// export default router;
