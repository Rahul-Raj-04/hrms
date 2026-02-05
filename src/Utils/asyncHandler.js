import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json(err.toJSON());
    }

    // Generic error fallback
    console.error(err.stack);
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: err.message || "Something went wrong",
      data: null,
      errors: [],
    });
  }
};

export { asyncHandler };
