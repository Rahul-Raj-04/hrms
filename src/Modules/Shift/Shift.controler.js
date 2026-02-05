import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import Staff from "../Staff/Staff.model.js";
import Shift from "./Shift.model.js";

export const createDefaultShift = async () => {
  const count = await Shift.countDocuments();
  if (count === 0) {
    await Shift.create({
      name: "Day Shift",
      startTime: "10:00",
      endTime: "19:00",
      bufferMinutes: 0,
      allowedBreakMinutes: 70,
      description: "Day shift 10 to 7",
    });
    console.log(" Default shift created");
  }
};

export const createShift = async (req, res) => {
  try {
    const {
      name,
      startTime,
      endTime,
      description,
      bufferMinutes,
      allowedBreakMinutes,
    } = req.body;

    const existing = await Shift.findOne({ name });
    if (existing) {
      throw new ApiError(400, "Shift already exists");
    }
if (bufferMinutes !== undefined && bufferMinutes < 0)
  throw new ApiError(400, "Buffer minutes cannot be negative");

if (allowedBreakMinutes !== undefined && allowedBreakMinutes < 0)
  throw new ApiError(400, "Break minutes cannot be negative");


    const shift = new Shift({
      name,
      startTime,
      endTime,
      description,
      bufferMinutes,
      allowedBreakMinutes,
    });

    await shift.save();

    res
      .status(201)
      .json(new ApiResponse(201, shift, "Shift created successfully"));
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: err.message || "Something went wrong",
      data: null,
      errors: [],
    });
  }
};
export const getAllShifts = async (req, res) => {
  try {
    const shifts = await Shift.find().sort({ createdAt: -1 });

    const shiftsWithStaffDetails = await Promise.all(
      shifts.map(async (shift) => {
        const staffList = await Staff.find(
          { work_shift: shift._id },
          {
            staff_name: 1,
            staff_id: 1,
            phone: 1,
            email: 1,
            work_status: 1,
          },
        ).sort({ staff_name: 1 });

        return {
          ...shift.toObject(),
          staffCount: staffList.length,
          staffList: staffList.map((s) => ({
            _id: s._id,
            staff_name: s.staff_name,
            staff_id: s.staff_id,
            phone: s.phone,
            email: s.email,
            work_status: s.work_status,
          })),
        };
      }),
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          shiftsWithStaffDetails,
          "Shifts fetched successfully",
        ),
      );
  } catch (err) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: err.message || "Something went wrong",
      data: null,
      errors: [],
    });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      startTime,
      endTime,
      description,
      isActive,
      bufferMinutes,
      allowedBreakMinutes,
    } = req.body;

    const shift = await Shift.findById(id);
    if (!shift) {
      throw new ApiError(404, "Shift not found");
    }
if (bufferMinutes !== undefined && bufferMinutes < 0)
  throw new ApiError(400, "Buffer minutes cannot be negative");

if (allowedBreakMinutes !== undefined && allowedBreakMinutes < 0)
  throw new ApiError(400, "Break minutes cannot be negative");


    if (name) shift.name = name;
    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (description !== undefined) shift.description = description;
    if (isActive !== undefined) shift.isActive = isActive;
    if (bufferMinutes !== undefined) shift.bufferMinutes = bufferMinutes;
    if (allowedBreakMinutes !== undefined)
      shift.allowedBreakMinutes = allowedBreakMinutes;

    await shift.save();

    res
      .status(200)
      .json(new ApiResponse(200, shift, "Shift updated successfully"));
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: err.message || "Something went wrong",
      data: null,
      errors: [],
    });
  }
};
export const toggleShiftStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const shift = await Shift.findByIdAndUpdate(
      id,
      { isActive },
      { new: true },
    );

    if (!shift) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Shift not found"));
    }

    res
      .status(200)
      .json(new ApiResponse(200, shift, "Shift status updated successfully"));
  } catch (err) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: err.message || "Something went wrong",
      data: null,
      errors: [],
    });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await Shift.findById(id);
    if (!shift) {
      throw new ApiError(404, "Shift not found");
    }

    await shift.deleteOne();

    res
      .status(200)
      .json(new ApiResponse(200, null, "Shift deleted successfully"));
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: err.message || "Something went wrong",
      data: null,
      errors: [],
    });
  }
};
