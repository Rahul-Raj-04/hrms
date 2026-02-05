export const FINE_RULES = [

  {
    key: "LATE_IN",
    category: "TIME_ATTENDANCE",
    label: "Late Check-In",
    description: "Late punch-in beyond grace period",
    enabled: true,
    auto: true,
  },
  {
    key: "EARLY_EXIT",
    category: "TIME_ATTENDANCE",
    label: "Early Check-Out",
    description: "Left before shift end without approval",
    enabled: true,
    auto: true,
  },
  {
    key: "SHORT_HOURS",
    category: "TIME_ATTENDANCE",
    label: "Short Working Hours",
    description: "Required working hours not completed",
    enabled: true,
    auto: true,
  },
  {
    key: "MISSING_PUNCH",
    category: "TIME_ATTENDANCE",
    label: "Missing Punch",
    description: "Check-in or check-out missing",
    enabled: true,
    auto: true,
  },
  {
    key: "HALF_DAY",
    category: "TIME_ATTENDANCE",
    label: "Half Day",
    description: "Worked less than half day",
    enabled: true,
    auto: true,
  },
  {
    key: "EXCESS_LATE",
    category: "TIME_ATTENDANCE",
    label: "Excessive Late",
    description: "Late multiple times in a month",
    enabled: true,
    auto: false, // monthly job
  },
  {
    key: "OVERTIME_MISUSE",
    category: "TIME_ATTENDANCE",
    label: "Overtime Misuse",
    description: "Overtime claimed without approval",
    enabled: true,
    auto: false,
  },

 
  {
    key: "OVER_BREAK",
    category: "BREAK",
    label: "Over Break Duration",
    description: "Exceeded allowed break duration",
    enabled: true,
    auto: true,
  },
  {
    key: "EXCESS_BREAK",
    category: "BREAK",
    label: "Excessive Break Count",
    description: "Too many breaks taken",
    enabled: true,
    auto: true,
  },
  {
    key: "UNAUTHORIZED_BREAK",
    category: "BREAK",
    label: "Unauthorized Break",
    description: "Break taken without approval",
    enabled: true,
    auto: true,
  },


  {
    key: "AWOL",
    category: "LEAVE_ABSENCE",
    label: "Absent Without Approval",
    description: "Absent without approved leave",
    enabled: true,
    auto: true,
  },
  {
    key: "LATE_LEAVE",
    category: "LEAVE_ABSENCE",
    label: "Late Leave Application",
    description: "Leave applied after absence",
    enabled: true,
    auto: false,
  },
  {
    key: "LEAVE_POLICY",
    category: "LEAVE_ABSENCE",
    label: "Leave Policy Violation",
    description: "Leave policy rules violated",
    enabled: true,
    auto: false,
  },

  /* =========================
     🧑‍💼 DISCIPLINE / POLICY (3)
  ========================== */
  {
    key: "SHIFT_VIOLATION",
    category: "DISCIPLINE_POLICY",
    label: "Shift Violation",
    description: "Assigned shift not followed",
    enabled: true,
    auto: true,
  },
  {
    key: "ID_DRESS",
    category: "DISCIPLINE_POLICY",
    label: "ID / Dress Code Violation",
    description: "ID card or dress code not followed",
    enabled: true,
    auto: false,
  },
  {
    key: "POLICY",
    category: "DISCIPLINE_POLICY",
    label: "General Policy Violation",
    description: "Other company policy violations",
    enabled: true,
    auto: false,
  },
];
