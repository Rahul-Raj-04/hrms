import { ApiError } from "../../Utils/ApiError.js";
import { ApiResponse } from "../../Utils/ApiResponse.js";
import { asyncHandler } from "../../Utils/asyncHandler.js";
import Department from "./Department.model.js";

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // 🔐 NEW AUTH INFO
  const { id: createdBy, role } = req.user;

  const existing = await Department.findOne({ name });
  if (existing) {
    throw new ApiError(400, "Department already exists");
  }

  const department = new Department({
    name,
    description,
    created_by: createdBy,
    created_by_role: role,
  });

  await department.save();

  return res.status(201).json(
    new ApiResponse(201, department, "Department created successfully")
  );
});

export const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({ isDeleted: { $ne: true } })
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, departments, "Departments fetched successfully")
  );
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const { departmentCode, name, description, isActive } = req.body;

  // 🔐 NEW AUTH INFO
  const { id: updatedBy, role } = req.user;

  if (departmentCode) {
    const existing = await Department.findOne({
      departmentCode,
      _id: { $ne: req.params.id },
    });
    if (existing) {
      throw new ApiError(400, "Department code already exists");
    }
  }

  const updatedDepartment = await Department.findByIdAndUpdate(
    req.params.id,
    {
      departmentCode,
      name,
      description,
      isActive,
      updated_by: updatedBy,
      updated_by_role: role,
    },
    { new: true }
  );

  if (!updatedDepartment) {
    throw new ApiError(404, "Department not found");
  }

  return res.status(200).json(
    new ApiResponse(200, updatedDepartment, "Department updated successfully")
  );
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findByIdAndDelete(req.params.id);

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  return res.status(200).json(
    new ApiResponse(200, null, "Department deleted successfully")
  );
});


