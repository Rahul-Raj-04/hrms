import express from "express";
import { downloadReport } from "./Report.Controler.js";


const router = express.Router();
router.get("/download/:id", downloadReport); 

export default router;
