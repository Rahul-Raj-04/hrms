import moment from "moment";
import fs from "fs"; 

import Cashbook from "./Cashbook.model.js";
import { deleteFile, uploadFile } from "../../service/UploadAws.js";
export const addEntry = async (req, res) => {
  try {
    const { amount, description, date, category, name, type } = req.body;

    if (!amount || !date || !category || !name) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const isAdmin = req.user.role === "admin";
    if (!isAdmin && type === "Received") {
      return res.status(403).json({
        message: "Staff cannot create Received entries",
      });
    }

    let proofs = [];

    if (req.files?.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadFile({ file });

        if (uploaded?.url) {
          proofs.push({
            url: uploaded.url,
            key: uploaded.key,
          });
        }
      }
    }

    const entry = await Cashbook.create({
      type: isAdmin ? type : "Paid",
      name,
      amount,
      description,
      date,
      category,
      createdBy: req.user.id,
      isStaffExpense: !isAdmin,
      status: isAdmin ? "Approved" : "Pending",
      proofs,
    });

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error("Add expense error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, description, date, category, removeProofKeys } =
      req.body;

    const entry = await Cashbook.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (entry.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (entry.status !== "Pending") {
      return res.status(403).json({
        message: "Approved or rejected claims cannot be edited",
      });
    }

    entry.name = name ?? entry.name;
    entry.amount = amount ?? entry.amount;
    entry.description = description ?? entry.description;
    entry.date = date ?? entry.date;
    entry.category = category ?? entry.category;

    // ✅ DELETE proofs (if keys provided)
    let keysToRemove = [];

    if (removeProofKeys) {
      if (typeof removeProofKeys === "string") {
        try {
          keysToRemove = JSON.parse(removeProofKeys);
        } catch {
          keysToRemove = [removeProofKeys];
        }
      } else if (Array.isArray(removeProofKeys)) {
        keysToRemove = removeProofKeys;
      }
    }

    if (keysToRemove.length > 0) {
      // delete from S3
      for (const key of keysToRemove) {
        await deleteFile(key);
      }

      // remove from DB
      entry.proofs = (entry.proofs || []).filter(
        (p) => !keysToRemove.includes(p.key)
      );
    }

   if (req.files?.length > 0) {
     // old proofs delete from S3
     if (entry.proofs?.length) {
       for (const p of entry.proofs) {
         if (p.key) await deleteFile(p.key);
       }
     }

     const uploaded = await uploadFile({ file: req.files[0] });

     if (uploaded?.url) {
       entry.proofs = [
         {
           url: uploaded.url,
           key: uploaded.key,
         },
       ];
     }
   }


    await entry.save();

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ message: error.message });
  }
};


export const getEntriesByMonth = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ message: "Month is required" });
    }

    const monthStart = moment(month, "YYYY-MM").startOf("month").toDate();
    const monthEnd = moment(month, "YYYY-MM").endOf("month").toDate();

    const query = {
      date: { $gte: monthStart, $lte: monthEnd },
    };

    // 👇 staff → only own expenses
    if (req.user.role !== "admin") {
      query.createdBy = req.user.id;
      query.isStaffExpense = true;
    }

    const entries = await Cashbook.find(query)
      .populate("createdBy", "staff_name email") // ✅ STAFF NAME
      .sort({ date: -1 });

    res.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error("Get expenses error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const entry = await Cashbook.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    // ❌ Approved / Rejected cannot be deleted by anyone
    if (entry.status !== "Pending") {
      return res.status(403).json({
        message: "Approved or rejected claims cannot be deleted",
      });
    }

    // ✅ STAFF: only own entry
    if (role !== "admin" && entry.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // ✅ ADMIN: allowed always (pending)
    await entry.deleteOne();

    res.json({
      success: true,
      message: "Entry deleted successfully",
    });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ message: error.message });
  }
};
export const markExpensePaid = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 only admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not allowed" });
    }

    const entry = await Cashbook.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // ❌ rejected case
    if (entry.status === "Rejected") {
      return res
        .status(400)
        .json({ message: "Rejected expense cannot be processed" });
    }

    // ❌ already paid
    if (entry.status === "Paid") {
      return res.status(400).json({ message: "Expense already paid" });
    }

    // ✅ STEP 1: Pending → Approved
    if (entry.status === "Pending") {
      entry.status = "Approved";
      entry.approvedBy = req.user.id;
      entry.approvedAt = new Date();
    }

    // ✅ STEP 2: Approved → Paid
    else if (entry.status === "Approved") {
      entry.status = "Paid";
      entry.paidBy = req.user.id;
      entry.paidAt = new Date();
    }

    await entry.save();

    const populatedEntry = await Cashbook.findById(entry._id).populate(
      "createdBy",
      "staff_name email",
    );

    res.json({
      success: true,
      data: populatedEntry,
      message:
        entry.status === "Approved"
          ? "Expense approved"
          : "Expense marked as paid",
    });
  } catch (error) {
    console.error("Mark expense error:", error);
    res.status(500).json({ message: error.message });
  }
};


export const rejectExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not allowed" });
    }

    const entry = await Cashbook.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (entry.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Only pending expenses can be rejected" });
    }

    entry.status = "Rejected";
    entry.rejectionReason = reason || "";
    entry.approvedBy = req.user.id;
    entry.approvedAt = new Date();

    await entry.save();

    res.json({
      success: true,
      message: "Expense rejected",
      data: entry,
    });
  } catch (error) {
    console.error("Reject expense error:", error);
    res.status(500).json({ message: error.message });
  }
};
