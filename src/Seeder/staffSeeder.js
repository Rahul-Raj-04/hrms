import mongoose from "mongoose";
import csv from "csvtojson";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 🔹 CONFIG / CONSTANTS
import Staff from "../Modules/Staff/Staff.model.js";
import Department from "../Modules/Department/Department.model.js";
import { DB_NAME } from "../Utils/constants.js";

// 🔹 MODELS

/* ================= PATH SETUP ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= ENV LOAD ================= */
dotenv.config({
  path: path.join(__dirname, "../../.env"), // project root .env
});

/* ================= DEBUG ================= */
console.log("MONGODB_URL =>", process.env.MONGODB_URL);
console.log("DB_NAME =>", DB_NAME);

/* ================= DB CONNECT ================= */
if (!process.env.MONGODB_URL) {
  console.error("❌ MONGODB_URL not found in .env");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URL, {
  dbName: DB_NAME, // 🔥 THIS WAS THE MISSING PIECE
});

console.log("✅ MongoDB connected");
console.log("📦 Connected DB:", mongoose.connection.name);

/* ================= ENUMS (STRICT – AS MODEL) ================= */
const ENUMS = {
  gender: ["Male", "Female", "Other"],
  employment_type: ["Full-time", "Part-time", "Contract"],
  access_level: ["HR", "HOD", "Manager", "FM", "Staff"],
};

/* ================= SEEDER ================= */
const seedStaff = async () => {
  try {
    /* ✅ CSV FROM SAME FOLDER */
    const csvPath = path.join(__dirname, "staff.csv");
    const rows = await csv().fromFile(csvPath);

    let success = 0;
    let skipped = 0;

    for (const row of rows) {
      /* ---------- REQUIRED FIELDS ---------- */
      const requiredFields = [
        "staff_name",
        "staff_id",
        "personalemail",
        "phone",
        "joining_date",
        "gender",
        "department",
        "login_email",
        "username",
        "password",
      ];

      const missing = requiredFields.filter((f) => !row[f]);
      if (missing.length) {
        console.log("❌ Missing fields:", missing, row);
        skipped++;
        continue;
      }

      /* ---------- ENUM VALIDATION ---------- */
      if (!ENUMS.gender.includes(row.gender)) {
        console.log("❌ Invalid gender:", row.gender);
        skipped++;
        continue;
      }

      if (
        row.employment_type &&
        !ENUMS.employment_type.includes(row.employment_type)
      ) {
        console.log("❌ Invalid employment_type:", row.employment_type);
        skipped++;
        continue;
      }

      if (row.access_level && !ENUMS.access_level.includes(row.access_level)) {
        console.log("❌ Invalid access_level:", row.access_level);
        skipped++;
        continue;
      }

      /* ---------- DUPLICATE CHECK ---------- */
      const exists = await Staff.findOne({
        $or: [
          { personalemail: row.personalemail },
          { login_email: row.login_email },
          { username: row.username },
        ],
      });

      if (exists) {
        console.log("⚠️ Duplicate staff skipped:", row.personalemail);
        skipped++;
        continue;
      }

      /* ---------- DEPARTMENT RESOLVE ---------- */
      const department = await Department.findOne({
        $or: [{ departmentCode: row.department }, { name: row.department }],
        isActive: true,
      });

      if (!department) {
        console.log("❌ Department not found:", row.department);
        skipped++;
        continue;
      }

      /* ---------- PASSWORD ---------- */
      const hashedPassword = await bcrypt.hash(row.password, 10);

      /* ---------- CREATE STAFF (pre-save hook runs) ---------- */
      await Staff.create({
        staff_name: row.staff_name,
        staff_id: row.staff_id,
        personalemail: row.personalemail,
        phone: row.phone,
        joining_date: new Date(row.joining_date),
        gender: row.gender,

        department: department._id,
        designation: row.designation,
        employment_type: row.employment_type,
        access_level: row.access_level,
        basic_salary: Number(row.basic_salary) || 0,

        login_email: row.login_email,
        username: row.username,
        password: hashedPassword,

        created_by_role: "admin",
      });

      console.log("✅ Created:", row.staff_name);
      success++;
    }

    console.log("────────────────────────");
    console.log("🎉 STAFF SEEDING DONE");
    console.log("✅ Success:", success);
    console.log("⏭ Skipped:", skipped);
    console.log("────────────────────────");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeder failed:", err.message);
    process.exit(1);
  }
};

/* ================= RUN ================= */
seedStaff();
