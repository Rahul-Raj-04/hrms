import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
dotenv.config({ path: "./.env" });

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION_NAME,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export default s3;
