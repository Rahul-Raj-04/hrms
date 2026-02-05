import { Router } from "express";
import { authVerifyJWT } from "../../../Middlewares/authVerifyJWT.js";
import { approveFine, getAllFines, getMyPendingFines,  } from "./Fine.controler.js";
const router = Router();
router.get("/pending", authVerifyJWT, getMyPendingFines);
router.get("/", authVerifyJWT, getAllFines);
router.post("/approve", authVerifyJWT, approveFine);

export default router;
