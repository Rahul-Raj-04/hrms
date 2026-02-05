// import { MODULES } from "./modules.js";
// import { PERMISSIONS } from "./permissions.js";

// export const ROLE_POLICY = {
//   Admin: {
//     modules: Object.values(MODULES),
//     permissions: Object.values(PERMISSIONS),
//   },

//   HR: {
//     modules: [
//       MODULES.DASHBOARD,
//       MODULES.STAFF,
//       MODULES.ATTENDANCE,
//       MODULES.PAYROLL,
//       MODULES.LEAVES,
//       MODULES.REPORTS,
//     ],
//     permissions: [
//       PERMISSIONS.DASHBOARD_VIEW,

//       PERMISSIONS.STAFF_VIEW,
//       PERMISSIONS.STAFF_CREATE,
//       PERMISSIONS.STAFF_EDIT,

//       PERMISSIONS.ATTENDANCE_VIEW_ALL,
//       PERMISSIONS.ATTENDANCE_EDIT,

//       PERMISSIONS.PAYROLL_VIEW,
//       PERMISSIONS.PAYROLL_PROCESS,

//       PERMISSIONS.REPORT_VIEW,
//       PERMISSIONS.REPORT_DOWNLOAD,
//     ],
//   },

//   Manager: {
//     modules: [
//       MODULES.DASHBOARD,
//       MODULES.ATTENDANCE,
//       MODULES.LEAVES,
//     ],
//     permissions: [
//       PERMISSIONS.DASHBOARD_VIEW,
//       PERMISSIONS.ATTENDANCE_VIEW_TEAM,
//       PERMISSIONS.LEAVE_APPROVE,
//     ],
//   },

//   Staff: {
//     modules: [
//       MODULES.DASHBOARD,
//       MODULES.ATTENDANCE,
//       MODULES.LEAVES,
//     ],
//     permissions: [
//       PERMISSIONS.DASHBOARD_VIEW,
//       PERMISSIONS.ATTENDANCE_VIEW_SELF,
//       PERMISSIONS.ATTENDANCE_START_WORK,
//       PERMISSIONS.ATTENDANCE_START_BREAK,
//       PERMISSIONS.ATTENDANCE_END_BREAK,
//       PERMISSIONS.LEAVE_APPLY,
//     ],
//   },
// };
