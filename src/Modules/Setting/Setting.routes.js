import express from "express";
import { getAllPolicyVersions, getLatestCompanyPolicy, getSettings, updateCompanyPolicy, updateSettings } from "./Setting.controler.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import upload from "../../Middlewares/multer.js";

const router = express.Router();

router.patch("/update", updateSettings);
router.get("/", getSettings);
router.get("/policy", authVerifyJWT, getLatestCompanyPolicy);
router.get("/policy/versions", authVerifyJWT, getAllPolicyVersions);
router.patch(
  "/policy",
  authVerifyJWT,
  upload.single("policyPdf"),
  updateCompanyPolicy
);
export default router;
