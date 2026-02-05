import mongoose from "mongoose";
import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import Staff from "../Staff/Staff.model.js";
import SalaryComponent from "./Salarycomponent.model.js";
import Attendance from "../Attendence/Attendence.model.js";
import LeaveApplication from "../Leave/LeaveApplication.model.js";
import moment from "moment";
import Payroll from "./Payroll.model.js";
import WeeklyHoliday from "../Leave/WeeklyHoliday.model.js";
import EmployeeLoan from "../Loan/EmployeeLoan.model.js";
import Fine from "../Attendence/Fine/Fine.modal.js";
import MonthlyAdjustment from "./Deduction/MonthlyAdjustment.modal.js";
import { generateSalarySlipPDF } from "../../Utils/generateSalarySlipPDF.js";

export const createSalaryComponent = asyncHandler(async (req, res) => {
  const { name, type, mandatory, rule } = req.body; // 👈 rule included

  if (!name || !type) {
    throw new ApiError(400, "Name and type are required");
  }

  const component = await SalaryComponent.create({
    name,
    type,
    mandatory,
    rule,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, component, "Salary component created successfully"),
    );
});

export const getSalaryComponents = asyncHandler(async (req, res) => {
  const components = await SalaryComponent.find();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        components,
        "Salary components fetched successfully",
      ),
    );
});

export const updateSalaryComponent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, type, mandatory, rule } = req.body; // 👈 rule included

  const component = await SalaryComponent.findByIdAndUpdate(
    id,
    { name, type, mandatory, rule },
    { new: true, runValidators: true },
  );

  if (!component) {
    throw new ApiError(404, "Salary component not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, component, "Salary component updated successfully"),
    );
});

export const deleteSalaryComponent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const component = await SalaryComponent.findByIdAndDelete(id);

  if (!component) {
    throw new ApiError(404, "Salary component not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Salary component deleted successfully"));
});

export const calculatePayroll = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { month } = req.body;

    if (!month) {
      return res.status(400).json({ message: "month is required (YYYY-MM)" });
    }

    const monthStart = moment(month, "YYYY-MM").startOf("month");
    if (!monthStart.isValid()) {
      return res.status(400).json({ message: "Invalid month format" });
    }

    const today = moment();
    const monthEndActual = moment(monthStart).endOf("month");
    let payrollEnd = monthStart.isSame(today, "month")
      ? today.endOf("day")
      : monthEndActual;

    // ✅ Fetch ALL ACTIVE STAFF
    const staffList = await Staff.find({ work_status: "Active" })
      .populate("salary_components.component")
      .session(session);

    if (!staffList.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "No active staff found",
      });
    }

    const weeklyHolidays = await WeeklyHoliday.find({}).session(session);
    const payrollResults = [];

    for (const staff of staffList) {
      const staffJoinDate = moment(staff.joining_date);
      const payrollStart = moment.max(monthStart, staffJoinDate);

      if (payrollStart.isAfter(payrollEnd)) continue;

      const totalDaysInMonth = monthEndActual.diff(monthStart, "days") + 1;
      const payrollPeriodDays = payrollEnd.diff(payrollStart, "days") + 1;

      const basicSalary = staff.basic_salary || 0;

      const attendances = await Attendance.find({
        staff: staff._id,
        date: { $gte: payrollStart.toDate(), $lte: payrollEnd.toDate() },
      }).session(session);

      const leaves = await LeaveApplication.find({
        staff: staff._id,
        status: "Approved",
        $or: [
          {
            startDate: {
              $gte: payrollStart.toDate(),
              $lte: payrollEnd.toDate(),
            },
          },
          {
            endDate: {
              $gte: payrollStart.toDate(),
              $lte: payrollEnd.toDate(),
            },
          },
          {
            startDate: { $lte: payrollStart.toDate() },
            endDate: { $gte: payrollEnd.toDate() },
          },
        ],
      }).session(session);

      let approvedLeaveDays = 0;
      leaves.forEach((leave) => {
        const leaveStart = moment.max(moment(leave.startDate), payrollStart);
        const leaveEnd = moment.min(moment(leave.endDate), payrollEnd);
        approvedLeaveDays += leaveEnd.diff(leaveStart, "days") + 1;
      });

      let presentDays = 0;
      let halfDays = 0;

      attendances.forEach((att) => {
        if (att.status === "Present") presentDays += 1;
        else if (att.status === "Half-Day") halfDays += 0.5;
      });
      const fineAgg = await Fine.aggregate([
        {
          $match: {
            staff: staff._id,
            approved: true,
            is_active: true,
            action: "DEDUCT",
            date: {
              $gte: payrollStart.toDate(),
              $lte: payrollEnd.toDate(),
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]).session(session);

      const fines = fineAgg[0]?.total || 0;
      let weeklyHolidayDays = 0;
      for (
        let d = moment(payrollStart);
        d.isSameOrBefore(payrollEnd, "day");
        d.add(1, "day")
      ) {
        if (weeklyHolidays.some((wh) => wh.day === d.format("dddd"))) {
          weeklyHolidayDays += 1;
        }
      }

      const payableDays =
        presentDays + halfDays + approvedLeaveDays + weeklyHolidayDays;

      const proratedBasicSalary =
        (basicSalary / totalDaysInMonth) * payableDays;

      let earnings = [{ title: "Basic + DA", amount: proratedBasicSalary }];
      let totalEarnings = proratedBasicSalary;

      staff.salary_components.forEach((sc) => {
        if (!sc.component) return;
        if (sc.component.type === "earning") {
          const amount = (sc.amount / totalDaysInMonth) * payableDays;
          earnings.push({ title: sc.component.name, amount });
          totalEarnings += amount;
        }
      });

      let deductions = [];
      const adjustments = await MonthlyAdjustment.find({
        staffId: staff._id,
        month,
      }).session(session);

      for (const adj of adjustments) {
        if (adj.type === "earning") {
          earnings.push({
            title: adj.title,
            amount: adj.amount,
          });
          totalEarnings += adj.amount;
        }

        if (adj.type === "deduction") {
          deductions.push({
            title: adj.title,
            amount: adj.amount,
          });
        }

        adj.applied = true;
        await adj.save({ session });
      }
      if (fines > 0) {
        deductions.push({ title: "Fines", amount: fines });
      }

      staff.salary_components.forEach((sc) => {
        if (!sc.component) return;
        if (sc.component.type === "deduction") {
          const amount = (sc.amount / totalDaysInMonth) * payableDays;
          deductions.push({ title: sc.component.name, amount });
        }
      });

     
      const loans = await EmployeeLoan.find({
        staff: staff._id,
        status: "Approved",
      }).session(session);

      loans.forEach((loan) => {
        loan.emiSchedule.forEach((emi) => {
          if (moment(emi.dueDate).format("YYYY-MM") === month) {
            deductions.push({
              title: `Loan EMI`,
              amount: emi.amount,
            });
          }
        });
      });

      const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
      const netSalary = totalEarnings - totalDeductions;

      const payrollData = {
        staffId: staff._id,
        staff_name: staff.staff_name,

        month,
        staff_code: staff.staff_id,
        gross_salary: totalEarnings,
        earnings,
        deductions,
        total_earnings: totalEarnings,
        net_salary: netSalary,
        attendance: {
          present: presentDays,
          absent: payrollPeriodDays - payableDays,
          weeklyOff: weeklyHolidayDays,
          halfDays,
          overtime: "0:00",
          fine: fines,
          payableDays,
        },
        leave: {
          total: approvedLeaveDays,
          weeklyOff: weeklyHolidayDays,
        },
        status: "Pending",
      };

      let payroll = await Payroll.findOne({
        staffId: staff._id,
        month,
      }).session(session);

      if (payroll) {
        Object.assign(payroll, payrollData);
        await payroll.save({ session });
      } else {
        payroll = (await Payroll.create([payrollData], { session }))[0];
      }

      payrollResults.push(payroll);
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      count: payrollResults.length,
      data: payrollResults,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Payroll calculation error:", error);
    res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
};
export const calculateStaffPayroll = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const staffId = req.user.id;

    const month = moment().format("YYYY-MM");
    const monthStart = moment(month, "YYYY-MM").startOf("month");
    const payrollEnd = moment().endOf("day");
    const monthEndActual = moment(monthStart).endOf("month");

    const staff = await Staff.findOne({
      _id: staffId,
      work_status: "Active",
    })
      .populate("salary_components.component")
      .session(session);

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const payrollStart = moment.max(monthStart, moment(staff.joining_date));

    const totalDaysInMonth = monthEndActual.diff(monthStart, "days") + 1;

    const attendances = await Attendance.find({
      staff: staff._id,
      date: {
        $gte: payrollStart.toDate(),
        $lte: payrollEnd.toDate(),
      },
    }).session(session);

    let presentDays = 0;
    let halfDays = 0;

    attendances.forEach((att) => {
      if (att.status === "Present") presentDays += 1;
      else if (att.status === "Half-Day") halfDays += 0.5;
    });

    const weeklyHolidays = await WeeklyHoliday.find({}).session(session);

    let weeklyHolidayDays = 0;
    for (
      let d = moment(payrollStart);
      d.isSameOrBefore(payrollEnd, "day");
      d.add(1, "day")
    ) {
      if (weeklyHolidays.some((wh) => wh.day === d.format("dddd"))) {
        weeklyHolidayDays += 1;
      }
    }

    const payableDays = presentDays + halfDays + weeklyHolidayDays;

    const basicSalary = staff.basic_salary || 0;
    const basicAmount = (basicSalary / totalDaysInMonth) * payableDays;

    let earnings = [{ title: "Basic + DA", amount: basicAmount }];
    let totalEarnings = basicAmount;

    staff.salary_components.forEach((sc) => {
      if (sc.component?.type === "earning") {
        const amt = (sc.amount / totalDaysInMonth) * payableDays;
        earnings.push({ title: sc.component.name, amount: amt });
        totalEarnings += amt;
      }
    });

    let deductions = [];

    staff.salary_components.forEach((sc) => {
      if (sc.component?.type === "deduction") {
        const amt = (sc.amount / totalDaysInMonth) * payableDays;
        deductions.push({ title: sc.component.name, amount: amt });
      }
    });
const adjustments = await MonthlyAdjustment.find({
  staffId: staff._id,
  month,
}).session(session);

for (const adj of adjustments) {
  if (adj.type === "earning") {
    earnings.push({
      title: adj.title,
      amount: adj.amount,
    });
    totalEarnings += adj.amount;
  }

  if (adj.type === "deduction") {
    deductions.push({
      title: adj.title,
      amount: adj.amount,
    });
  }
}

    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

    const netSalary = totalEarnings - totalDeductions;
    const payrollData = {
      staffId: staff._id,
      staff_name: staff.staff_name,
      staff_code: staff.staff_id,

      month,
      gross_salary: totalEarnings,
      earnings,
      deductions,
      total_earnings: totalEarnings,
      net_salary: netSalary,

      attendance: {
        present: presentDays,
        halfDays,
        weeklyOff: weeklyHolidayDays,
        payableDays,
      },

      status: "Processed",
      is_partial: true,
      calculated_upto: payrollEnd.toDate(),
    };

    let payroll = await Payroll.findOne({
      staffId: staff._id,
      month,
    }).session(session);

    if (payroll) {
      Object.assign(payroll, payrollData);
      await payroll.save({ session });
    } else {
      payroll = (await Payroll.create([payrollData], { session }))[0];
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      payroll,
      message: "Daily payroll calculated & saved",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};


export const getPayrollOverview = async (req, res) => {
  try {
    // agar query me month hai to usko lo, warna current month (YYYY-MM format)
    const month = req.query.month || moment().format("YYYY-MM");

    const payrolls = await Payroll.find({ month });

    let allowanceTotal = 0;
    let bonusTotal = 0;
    let deductionTotal = 0;

    payrolls.forEach((p) => {
      // Earnings check
      p.earnings.forEach((e) => {
        if (/bonus/i.test(e.title)) {
          bonusTotal += e.amount;
        } else if (!/basic/i.test(e.title)) {
          allowanceTotal += e.amount;
        }
      });

      // Deductions check
      p.deductions.forEach((d) => {
        deductionTotal += d.amount;
      });
    });

    res.json({
      success: true,
      data: {
        month,
        allowance: allowanceTotal,
        bonus: bonusTotal,
        deductions: deductionTotal,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching overview",
      error: error.message,
    });
  }
};
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split("T")[0];
};
export const getStaffPayroll = async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { staffId: queryStaffId, month } = req.query;

    let targetStaffId;

    /* =============================
       🧍 STAFF → SELF PAYROLL
       ============================= */
    if (!queryStaffId) {
      targetStaffId = loggedInUser.id;
    } else {
      const isAdmin = loggedInUser.role === "admin";
      const hasPermission =
        loggedInUser.permissions?.includes("payroll:view") ||
        loggedInUser.permissions?.includes("*");

      if (!isAdmin && !hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view other staff payroll",
        });
      }

      targetStaffId = queryStaffId;
    }

    /* =============================
       🔎 FILTER
       ============================= */
    const filter = { staffId: targetStaffId };
    if (month) filter.month = month;

    const payrolls = await Payroll.find(filter)
      .populate({
        path: "staffId",
        select:
          "staff_name designation department joining_date phone staff_id pan_number",
        populate: {
          path: "department",
          select: "name",
        },
      })
      .sort({ month: -1 });

    /* =============================
       📦 RESPONSE (BACKWARD SAFE)
       ============================= */
    const data = await Promise.all(
      payrolls.map(async (p) => {
        const oldStartDate = `${p.month}-01`;
        const oldEndDate = `${p.month}-31`;

        const startDate = moment
          .tz(`${p.month}-01`, "Asia/Kolkata")
          .startOf("day");

        const monthEnd = startDate.clone().endOf("month").endOf("day");
        const todayEnd = moment.tz("Asia/Kolkata").endOf("day");

        const endDate = startDate.isSame(todayEnd, "month")
          ? todayEnd
          : monthEnd;

        const monthDataStartDate = oldStartDate;

        const monthDataEndDate = startDate.isSame(todayEnd, "month")
          ? todayEnd.format("YYYY-MM-DD")
          : oldEndDate;

        const attendanceRecords = await Attendance.find({
          staff: p.staffId._id,
          date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
        }).sort({ date: 1 });

        const attendanceMap = new Map();

        attendanceRecords.forEach((a) => {
          const key = moment(a.date).tz("Asia/Kolkata").format("YYYY-MM-DD");
          attendanceMap.set(key, a);
        });

        const attendanceDetails = [];

        let cursor = startDate.clone().startOf("day");
        const endCursor = endDate.clone().startOf("day");

        while (cursor.isSameOrBefore(endCursor)) {
          const dateKey = cursor.format("YYYY-MM-DD");
          const record = attendanceMap.get(dateKey);

          if (record) {
            const totalMinutes = Number(record.working_hours) || 0;
            const hrs = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;

            attendanceDetails.push({
              date: dateKey,
              day: cursor.format("ddd"),
              status: record.status,
              workingHours:
                record.status === "Present" || record.status === "Half-Day"
                  ? totalMinutes > 0
                    ? `${hrs}:${mins.toString().padStart(2, "0")}`
                    : "-"
                  : "-",
              shift: "Day Shift",
              checkIn: record.check_in
                ? moment(record.check_in).tz("Asia/Kolkata").format("HH:mm")
                : "-",
              checkOut: record.check_out
                ? moment(record.check_out).tz("Asia/Kolkata").format("HH:mm")
                : "-",
              overtime: `${record.overtime_hours || 0}:00`,
              fine: record.fine || 0,
              remarks: record.remarks || "",
            });
          } else {
            attendanceDetails.push({
              date: dateKey,
              day: cursor.format("ddd"),
              status: "Not Marked",
              workingHours: "-",
              shift: "-",
              checkIn: "-",
              checkOut: "-",
              overtime: "-",
              fine: 0,
              remarks: "",
            });
          }

          cursor.add(1, "day");
        }

        return {
          id: p._id,
          employee: {
            name: p.staffId?.staff_name || "-",
            designation: p.staffId?.designation || "-",
            department: p.staffId?.department?.name || "-",
            joiningDate: formatDate(p.staffId?.joining_date),
            phone: p.staffId?.phone || "-",
            grossSalary: p.gross_salary,
            empId: p.staffId?.staff_id || "-",
            pan: p.staffId?.pan_number || "-",
          },

          monthData: {
            month: p.month,

            startDate: monthDataStartDate,
            endDate: monthDataEndDate,

            attendance: p.attendance,
            earnings: p.earnings,
            deductions: p.deductions,
            totalEarnings: p.total_earnings,
            netPayable: p.net_salary,
            leave: p.leave,
            status: p.status,

            attendanceSummary: p.attendance,
            attendanceDetails,
            startDateISO: startDate.format("YYYY-MM-DD"),
            endDateISO: endDate.format("YYYY-MM-DD"),
          },
        };
      }),
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error fetching payroll:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};
export const getPayrollSummaryForHR = async (req, res) => {
  try {
    const { month } = req.query;

    const now = moment.tz("Asia/Kolkata");
    const targetMonth = month || `${now.format("YYYY")}-${now.format("MM")}`;

    const payrolls = await Payroll.find({ month: targetMonth })
      .populate({
        path: "staffId",
        select: "staff_name staff_id bank_account",
      })
      .sort({ "staffId.staff_name": 1 });

    const isCurrentMonth = moment
      .tz(targetMonth, "YYYY-MM", "Asia/Kolkata")
      .isSame(now, "month");

    const endDate = isCurrentMonth
      ? now.format("YYYY-MM-DD")
      : moment
          .tz(targetMonth, "YYYY-MM", "Asia/Kolkata")
          .endOf("month")
          .format("YYYY-MM-DD");

    const data = payrolls.map((p) => ({
      name: p.staffId?.staff_name || "Unknown Staff",
      staffId: p.staffId?.staff_id || "N/A",
      id: p._id || "N/A",
      netSalary: `₹${Number(p.net_salary || 0).toLocaleString()}`,
      status: p.status || "Pending",
    }));

    res.json({
      success: true,
      data,
      month: targetMonth,
      endDate,
    });
  } catch (error) {
    console.error("❌ Error fetching payroll summary:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching payroll summary",
      error: error.message,
    });
  }
};


export const markPayrollAsPaid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { payrollId } = req.body;

    if (!payrollId) {
      throw new ApiError(400, "payrollId is required");
    }

    const payroll = await Payroll.findById(payrollId).session(session);
    if (!payroll) {
      throw new ApiError(404, "Payroll not found");
    }

     if (payroll.status === "Processed") {
       throw new ApiError(400, "Payroll is already processed");
     }

    payroll.status = "Processed";
    payroll.paidAt = new Date(); 
    payroll.paidBy = req.user.id; 

    await payroll.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json(new ApiResponse(200, payroll, "Payroll marked as Paid"));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Error marking payroll as Paid:", error);
    res
      .status(error.statusCode || 500)
      .json(
        error instanceof ApiError
          ? error.toJSON()
          : new ApiResponse(500, null, error.message),
      );
  }
};
export const addMonthlyAdjustment = asyncHandler(async (req, res) => {
  const { staffId, month, type, title, amount } = req.body;

  if (!staffId || !month || !type || !title || amount === undefined) {
    throw new ApiError(400, "staffId, month, type, title, amount are required");
  }

  if (!["earning", "deduction"].includes(type)) {
    throw new ApiError(400, "Invalid type");
  }

  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    throw new ApiError(400, "Invalid staffId format");
  }

  const staff = await Staff.findById(staffId);

  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  const exists = await MonthlyAdjustment.findOne({
    staffId,
    month,
    type,
    title,
  });

  if (exists) {
    throw new ApiError(
      400,
      "Adjustment already exists for this staff and month",
    );
  }

  const adjustment = await MonthlyAdjustment.create({
    staffId,
    month,
    type,
    title,
    amount: Number(amount),
  });

  res.status(201).json({
    success: true,
    message: "Monthly adjustment added successfully",
    adjustment,
  });
});
export const downloadSalarySlip = async (req, res) => {
  const { staffId, month, debug } = req.body;

  const logs = [];
  const addLog = (msg) => logs.push(`[${new Date().toISOString()}] ${msg}`);

  const sendDebugHeaders = () => {
    try {
      res.setHeader(
        "X-PDF-Debug",
        Buffer.from(logs.join(" | ")).toString("base64"),
      );
    } catch (e) {}
  };

  try {
    addLog("✅ API called");
    addLog(`staffId=${staffId}, month=${month}`);

    if (!staffId || !month) {
      addLog("❌ Missing staffId/month");
      sendDebugHeaders();
      return res
        .status(400)
        .json({ message: "staffId and month required", logs });
    }

    const payroll = await Payroll.findOne({ staffId, month }).populate({
      path: "staffId",
      populate: { path: "department", select: "name" },
    });

    addLog("✅ Payroll fetched");

    if (!payroll) {
      addLog("❌ Payroll not found");
      sendDebugHeaders();

      if (debug) return res.status(404).json({ success: false, logs });
     return res
       .status(404)
       .json({ message: "Payroll is not available for this month" });

    }

    const record = {
      companyLogo:
        "https://www.wishgeekstechserve.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fwish.e1c31412.webp&w=640&q=75",
      employee: {
        name: payroll.staffId.staff_name,
        designation: payroll.staffId.designation,
        department: payroll.staffId.department?.name || "-",
        joiningDate: payroll.staffId.joining_date,
        phone: payroll.staffId.phone,
        empId: payroll.staffId.staff_id,
        pan: payroll.staffId.pan_number,
        grossSalary: Number(payroll.gross_salary || 0),
      },
      monthData: {
        startDate: `${month}-01`,
        endDate: `${month}-31`,
        attendance: payroll.attendance,
        earnings: (payroll.earnings || []).map((e) => ({
          title: e.title,
          amount: Number(e.amount || 0),
        })),
        deductions: (payroll.deductions || []).map((d) => ({
          title: d.title,
          amount: Number(d.amount || 0),
        })),
        totalEarnings: Number(payroll.total_earnings || 0),
        netPayable: Number(payroll.net_salary || 0),
      },
    };

    addLog("✅ Record prepared");

    const pdf = await generateSalarySlipPDF(record);

    addLog("✅ PDF generated");
    addLog(`PDF size = ${pdf?.length || 0} bytes`);

    sendDebugHeaders();

    if (debug) {
      return res.json({ success: true, logs });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=SalarySlip-${month}.pdf`,
    );
    res.setHeader("Content-Length", pdf.length);

    return res.send(pdf);
  } catch (err) {
    addLog("❌ ERROR: " + err.message);
    sendDebugHeaders();

    if (debug) {
      return res.status(500).json({
        success: false,
        logs,
        error: err.message,
      });
    }

    return res.status(500).json({
      message: "Salary slip generation failed",
      error: err.message,
    });
  }
};

export const getStaffMonthlyAdjustments = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const { month } = req.query;

  if (!staffId || !month) {
    throw new ApiError(400, "staffId and month required");
  }

  const adjustments = await MonthlyAdjustment.find({
    staffId,
    month,
  }).sort({ createdAt: -1 });

  res.json(new ApiResponse(200, adjustments, "Monthly adjustments fetched"));
});
