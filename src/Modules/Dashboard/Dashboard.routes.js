import express from "express";
import {  getDashboardData, getDashboardtodo, getLoanSummaryOnly } from "./DashBoard.controler.js";

const router = express.Router();

router.get("/", getDashboardData);
router.get("/todo", getDashboardtodo);
router.get("/loan", getLoanSummaryOnly);

export default router;
