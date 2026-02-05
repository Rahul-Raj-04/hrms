import fs from "fs";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { Upload } from "@aws-sdk/lib-storage";
import s3 from "./s3.js";

const bucketName = process.env.AWS_STORAGE_BUCKET_NAME;
const ASSETS_BASE = "assets";

export const uploadFile = async ({ file, staffId = null }) => {
  if (!file) throw new Error("No file found");

  const original = file.originalname;
  const ext = original.split(".").pop();
  const base = original
    .replace(`.${ext}`, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();

  const folder = staffId ? `${ASSETS_BASE}/Staff/${staffId}` : ASSETS_BASE;

  const inputBuffer = file.buffer ? file.buffer : fs.readFileSync(file.path);

  let finalBuffer = inputBuffer;
  let fileKey = `${folder}/${Date.now()}-${base}.${ext}`;
  let contentType = file.mimetype;

  if (
    [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/avif",
      "image/tiff",
      "image/webp",
    ].includes(file.mimetype)
  ) {
    finalBuffer = await sharp(inputBuffer).webp({ quality: 80 }).toBuffer();

    fileKey = `${folder}/${Date.now()}-${base}.webp`;
    contentType = "image/webp";
  }

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucketName,
      Key: fileKey,
      Body: finalBuffer,
      ContentType: contentType,
    },
  });

  await upload.done();

  if (file.path) {
    fs.unlinkSync(file.path);
  }

  return {
    url: `https://${bucketName}.s3.${process.env.AWS_S3_REGION_NAME}.amazonaws.com/${fileKey}`,
    key: fileKey,
  };
};

export const deleteFile = async (key) => {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3.send(command);
};
