import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
import 'dotenv/config'
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});



const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) {
      throw new Error("Local file path is missing");
    }



    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto"
    });

    return response;
  } catch (error) {
    // Log the error
    console.error("Error uploading file to Cloudinary:", error);

    // Handle errors during local file deletion
    try {
      fs.unlinkSync(localFilePath);
    } catch (unlinkError) {
      console.error("Error deleting local file:", unlinkError);
    }

    // Return an object containing error details
    return { error: error.message };
  }
};

export { uploadOnCloudinary };