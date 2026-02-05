import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    staff_name: { type: String, required: true },
    staff_id: { type: String, required: true, unique: true },
    profile_photo: { type: String }, // store file path or URL
    personalemail: { type: String, unique: true },
    phone: { type: String, required: true },
    joining_date: { type: Date, required: true },
    work_status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    dob: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    blood_group: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    marital_status: {
      type: String,
      enum: ["Single", "Married"],
      default: "Single",
    },
    nationality: { type: String, default: "Indian" },
    current_address: { type: String },
    permanent_address: { type: String },
    emergency_contact_name: { type: String },
    emergency_contact_relation: { type: String },
    emergency_contact_number: { type: String },
    designation: { type: String },
    employment_type: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Probation", "Notice"],
    },
    job_level: { type: String },
    reporting_manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    probation_period: { type: Number },
    existing_employee: { type: String },
    previous_experience: { type: Number },
    confirmation_date: { type: Date },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    team: { type: String },
    work_mode: { type: String, enum: ["Onsite", "Remote", "Hybrid"] },
    hod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    basic_salary: { type: Number },
    salary_components: [
      {
        component: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SalaryComponent",
        },
        amount: { type: Number, default: 0 },
      },
    ],
    deactivated_at: {
      type: Date,
    },
    bank_account: { type: String },
    account_holder_name: { type: String },
    upi_id: { type: String },
    bank_name: { type: String },
    branch_name: { type: String },
    ifsc: { type: String },
    pan_number: { type: String },
    uan: { type: String },
    esi_number: { type: String },
    resume: { type: String },
    id_proof: { type: String },
    address_proof: { type: String },
    education_certificates: [{ type: String }],
    experience_certificates: [{ type: String }],
    appointment_letter: { type: String },
    relieving_letter: { type: String },
    others: [{ type: String }],
    documents: [
      {
        name: { type: String },
        description: { type: String, default: "" },
        file: { type: String },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],

    login_email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    access_level: {
      type: String,
      enum: ["HR", "HOD", "Manager", "FM", "Staff"],
      default: "Staff",
    },
    is_reporting_manager: {
      type: Boolean,
      default: false,
    },

    is_attendance_supervisor: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: [String],
      default: [],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "created_by_role",
    },
    created_by_role: {
      type: String,
      enum: ["admin", "HR", "Manager", "HOD", "FM", "Staff"],
    },
    portal_access: { type: String, enum: ["Yes", "No"], default: "Yes" },
    invite_token: {
      type: String,
    },
    invite_token_expiry: {
      type: Date,
    },
    refresh_token: { type: String },
    forgotOtp: { type: String },
    forgotOtpExpires: { type: Date },

    last_login: { type: Date },
    attendance_supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    salary_cycle: { type: Number },
    attendance_template: { type: String },
    work_shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },
    weekly_off: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WeeklyHoliday",
      default: null,
    },
    holiday_template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HolidayTemplate",
      default: null,
    },
    leave_template: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "LeaveType",
      default: [],
    },
    geofence_template: { type: String },
    father_name: { type: String },
    mother_name: { type: String },
    spouse_name: { type: String },
    physically_challenged: { type: Boolean, default: false },
    aadhaar_number: { type: String },
    aadhaar_enrollment_number: { type: String },
    pf_number: { type: String },
    pf_joining_date: { type: Date },
    pf_eligible: { type: String },
    esi_eligible: { type: String },
    esi_number: { type: String },
    pt_eligible: { type: String },
    lwf_eligible: { type: String },
    eps_eligible: { type: String },
    eps_joining_date: { type: Date },
    eps_exit_date: { type: Date },
    hps_eligible: { type: String },
    current_address_line1: { type: String },
    current_address_line2: { type: String },
    current_city: { type: String },
    current_state: { type: String },
    current_postal_code: { type: String },

    permanent_address_line1: { type: String },
    permanent_address_line2: { type: String },
    permanent_city: { type: String },
    permanent_state: { type: String },
    permanent_postal_code: { type: String },

    previous_company: { type: String },
    previous_join_date: { type: Date },
    previous_end_date: { type: Date },

    first_hike: { type: Number, default: 0 },
    second_hike: { type: Number, default: 0 },
    two_factor_enabled: { type: Boolean, default: false },
    two_factor_secret: { type: String }, // base32 secret
    two_factor_verified: { type: Boolean, default: false },
    insurance: [
      {
        title: { type: String },
        description: { type: String },
        document: { type: String },

        provider: { type: String },
        policy_type: { type: String },
        policy_number: { type: String },
        sum_insured: { type: Number },
        start_date: { type: Date },
        expiry_date: { type: Date },
        nominee_name: { type: String },
        nominee_relation: { type: String },

        claims: [
          {
            claim_number: { type: String },
            claim_amount: { type: Number },
            claim_reason: { type: String },
            claim_date: { type: Date, default: Date.now },
            status: {
              type: String,
              enum: ["Pending", "Approved", "Rejected", "Settled"],
              default: "Pending",
            },
            remarks: { type: String },
            documents: [{ type: String }], // bills, hospital docs
          },
        ],

        status: {
          type: String,
          enum: ["Active", "Expired"],
          default: "Active",
        },
      },
    ],
  },
  { timestamps: true },
);
staffSchema.pre("save", async function (next) {
  try {
    if (!this.isNew) return next();

    if (this.staff_id) {
      const isValid = /^([A-Za-z]+)-(\d+)$/.test(this.staff_id);

      if (!isValid) {
        return next(
          new Error("staff_id format invalid (expected: PREFIX-Number)")
        );
      }
      return next();
    }

    const lastStaff = await this.constructor
      .findOne({ staff_id: /^WGTS-\d+$/ })
      .sort({ createdAt: -1 });

    let nextNumber = 1;

    if (lastStaff) {
      const match = lastStaff.staff_id.match(/^WGTS-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    this.staff_id = `WGTS-${nextNumber}`;
    next();
  } catch (err) {
    next(err);
  }
});


const Staff = mongoose.model("Staff", staffSchema);
export default Staff;
