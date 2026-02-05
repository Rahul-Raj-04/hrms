import express from "express";
import {
  addEntry,
  deleteEntry,
  getEntriesByMonth,
  markExpensePaid,
  rejectExpense,
  updateEntry,
} from "./Cashbook.controler.js";
import { authVerifyJWT } from "../../Middlewares/authVerifyJWT.js";
import upload from "../../Middlewares/multer.js";

const router = express.Router();

// Add entry
router.post("/add",authVerifyJWT, upload.array("proofs", 1), addEntry);
router.patch("/:id", authVerifyJWT, upload.array("proofs", 1), updateEntry);

// Get entries by month
router.get("/entries", authVerifyJWT,getEntriesByMonth);

// Delete entry
router.delete("/:id",authVerifyJWT, deleteEntry);

router.patch("/:id/mark-paid", authVerifyJWT, markExpensePaid);

router.patch("/:id/reject", authVerifyJWT, rejectExpense);


export default router;
