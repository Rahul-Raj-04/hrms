import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});
import { app } from "./app.js";
import connectDB from "./db/index.js";
import { initializeAdmin } from "./Modules/Admin/Admin.controler.js";
import { createDefaultShift } from "./Modules/Shift/Shift.controler.js";
import { initializeSettings } from "./Modules/Setting/Setting.controler.js";
import { initializeLeaveCron } from "./cron/leaveAccrualCron.js";

// demo 
connectDB()
  .then(() => {
    console.log("mongoose connected successfully ");
    initializeAdmin();
    createDefaultShift();
     initializeSettings();
     initializeLeaveCron();
    app.listen(process.env.PORT || 8000, () => {
      console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
  });