import { asyncHandler } from "../../Utils/asyncHandler.js";
import Attendance from "../Attendence/Attendence.model.js";
import Fine from "../Attendence/Fine/Fine.modal.js";
import LeaveApplication from "../Leave/LeaveApplication.model.js";
import EmployeeLoan from "../Loan/EmployeeLoan.model.js";
import Staff from "../Staff/Staff.model.js";
import moment from "moment-timezone";
export const getDashboardData = async (req, res) => {
  try {
    /* ================= DATE (IST FIXED) ================= */
    const dateStr = req.query.date;

    const baseDate = dateStr
      ? moment.tz(dateStr, ["YYYY-MM-DD", "YYYY-M-DD"], "Asia/Kolkata")
      : moment.tz("Asia/Kolkata");

    if (!baseDate.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format (YYYY-MM-DD)",
      });
    }

    const start = baseDate.clone().startOf("day").toDate();
    const end = baseDate.clone().endOf("day").toDate();

    /* ================= STAFF ================= */
   const totalStaff = await Staff.countDocuments({
     work_status: "Active",
   });


    /* ================= ATTENDANCE AGG ================= */
   const attendanceStats = await Attendance.aggregate([
     {
       $match: {
         date: { $gte: start, $lte: end },
       },
     },
     {
       $lookup: {
         from: "staffs", // 🔴 collection name
         localField: "staff",
         foreignField: "_id",
         as: "staff",
       },
     },
     { $unwind: "$staff" },
     {
       $match: {
         "staff.work_status": "Active", // ✅ IMPORTANT
       },
     },
     {
       $group: {
         _id: "$status",
         count: { $sum: 1 },

         punchedIn: {
           $sum: {
             $cond: [{ $ifNull: ["$check_in", false] }, 1, 0],
           },
         },
         punchedOut: {
           $sum: {
             $cond: [{ $ifNull: ["$check_out", false] }, 1, 0],
           },
         },

         overtimeHours: {
           $sum: { $ifNull: ["$overtime_hours", 0] },
         },

         fineAmount: {
           $sum: { $ifNull: ["$fine", 0] },
         },
       },
     },
   ]);


    /* ================= DEFAULT STATS ================= */
    const stats = {
      Present: 0,
      Absent: 0,
      "Half-Day": 0,
      "Not Marked": totalStaff,

      PunchedIn: 0,
      PunchedOut: 0,

      OvertimeHours: 0,
      FineAmount: 0,
    };

    attendanceStats.forEach((item) => {
      if (stats[item._id] !== undefined) {
        stats[item._id] = item.count;
      }

      stats.PunchedIn += item.punchedIn;
      stats.PunchedOut += item.punchedOut;

      stats.OvertimeHours += item.overtimeHours;
      stats.FineAmount += item.fineAmount;

      stats["Not Marked"] -= item.count;
    });

    stats["Not Marked"] = Math.max(0, stats["Not Marked"]);

    /* ================= LEAVES ================= */
    const leavesToday = await LeaveApplication.countDocuments({
      startDate: { $lte: end },
      endDate: { $gte: start },
      status: "Approved",
    });

    const upcomingLeaves = await LeaveApplication.countDocuments({
      startDate: { $gt: end },
      status: "Approved",
    });

    /* ================= OTHER ================= */
    const deactivatedStaff = await Staff.countDocuments({
      work_status: "Inactive",
    });


    const dailyWorkEntries = await Attendance.countDocuments({
      date: { $gte: start, $lte: end },
    });

    /* ================= RESPONSE ================= */
    return res.json({
      success: true,
      data: {
        date: baseDate.format("ddd MMM DD YYYY"),

        attendance: {
          present: stats.Present,
          absent: stats.Absent,
          halfDay: stats["Half-Day"],
          notMarked: stats["Not Marked"],
          punchedIn: stats.PunchedIn,
          punchedOut: stats.PunchedOut,
        },

        leaveDetails: {
          onLeave: leavesToday,
          upcoming: upcomingLeaves,
        },

        overtimesFines: {
          overtimeHours: `${Math.floor(stats.OvertimeHours)}h ${Math.round(
            (stats.OvertimeHours % 1) * 60
          )}m`,
          fineAmount: `₹${stats.FineAmount}`, // 💰 CLEAN
        },

        other: {
          deactivated: deactivatedStaff,
          dailyWorkEntries,
        },
      },
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard data",
    });
  }
};
export const getDashboardtodo = asyncHandler(async (req, res) => {
  const tz = "Asia/Kolkata";

  /* ================= MONTH HANDLING ================= */
  const now = moment().tz(tz);

  const month = req.query.month ? Number(req.query.month) : now.month() + 1; // default current month

  const year = req.query.year ? Number(req.query.year) : now.year(); // default current year

  const monthStart = moment
    .tz({ year, month: month - 1, day: 1 }, tz)
    .startOf("day");

  const monthEnd = monthStart.clone().endOf("month");

  /* ================= PENDING FINES ================= */
 const pendingFines = await Fine.aggregate([
   {
     $match: {
       approved: false,
       is_active: true,
       date: {
         $gte: monthStart.toDate(),
         $lte: monthEnd.toDate(),
       },
     },
   },
   {
     $lookup: {
       from: "staffs",
       localField: "staff",
       foreignField: "_id",
       as: "staffDetails",
     },
   },
   { $unwind: "$staffDetails" },
   {
     $project: {
       staffName: "$staffDetails.staff_name",
       staffId: "$staffDetails.staff_id",
       date: 1,
       rule_key: 1,
       type: 1,
       minutes: 1,
       amount: 1,
       category: 1,
       approved: 1,
     },
   },
   { $sort: { date: -1 } },
 ]);

  /* ================= PENDING LEAVES ================= */
  const pendingLeaves = await LeaveApplication.find({
    $or: [
      { "hrApproval.status": "Pending" },
      { "managerApproval.status": "Pending" },
      { "hodApproval.status": "Pending" },
      { status: "Pending" },
    ],
  })
    .populate("staff", "staff_name")
    .populate("leaveType", "name")
    .lean();

  /* ================= CELEBRATIONS ================= */
  const staffs = await Staff.find({
    $or: [
      { dob: { $exists: true, $ne: null } },
      { joining_date: { $exists: true, $ne: null } },
    ],
  })
    .populate("department", "name")
    .select(
      "staff_name staff_id dob joining_date designation department profile_photo"
    )
    .lean();

  const celebrations = [];

  staffs.forEach((s) => {
    /* ---------- BIRTHDAY ---------- */
    if (s.dob) {
      const birthday = moment(s.dob).tz(tz).year(year);

      if (birthday.isBetween(monthStart, monthEnd, "day", "[]")) {
        celebrations.push({
          type: "birthday",
          staffName: s.staff_name,
          staffId: s.staff_id,
          designation: s.designation,
          department: s.department?.name || "N/A",
          dob: s.dob,
          date: birthday.toDate(),
          profile_photo: s.profile_photo,
        });
      }
    }

    /* ---------- WORK ANNIVERSARY ---------- */
    if (s.joining_date) {
      const anniversary = moment(s.joining_date).tz(tz).year(year);

      if (anniversary.isBetween(monthStart, monthEnd, "day", "[]")) {
        const years = year - moment(s.joining_date).year();

        if (years > 0) {
          celebrations.push({
            type: "anniversary",
            staffName: s.staff_name,
            staffId: s.staff_id,
            designation: s.designation,
            department: s.department?.name || "N/A",
            years,
            date: anniversary.toDate(),
            profile_photo: s.profile_photo,
          });
        }
      }
    }
  });

  /* ================= RESPONSE ================= */
  res.json({
    success: true,
    meta: {
      month,
      year,
      range: {
        from: monthStart.format("YYYY-MM-DD"),
        to: monthEnd.format("YYYY-MM-DD"),
      },
    },
    thingsToDo: {
      approveFine: pendingFines,
      approveLeaveApplication: pendingLeaves,
    },
    celebrations: celebrations.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    ),
  });
});


export const getLoanSummaryOnly = async (req, res) => {
  try {
    const loans = await EmployeeLoan.find({
      status: "Approved", // "Closed" hata do jab tak field exist na kare
    });

    let totalLoan = 0;
    let received = 0;
    let pending = 0;

    loans.forEach((loan) => {
      const loanAmount = loan.loanAmount || 0;

      const paidAmount = loan.emiSchedule.reduce((sum, emi) => {
        return emi.status === "Paid" ? sum + (emi.amount || 0) : sum;
      }, 0);

      totalLoan += loanAmount;
      received += paidAmount;
      pending += Math.max(0, loanAmount - paidAmount);
    });

    res.status(200).json({
      success: true,
      data: {
        loanSummary: {
          totalLoan,
          received,
          pending,
        },
      },
    });
  } catch (error) {
    console.error("Loan Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

