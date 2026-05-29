import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { supabaseAdmin } from "../lib/supabaseClient.js";

const BUCKET_NAME = "pin-images";

function parseDataUrl(dataUrl = "") {
  const match = String(dataUrl).match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return {
    buffer: Buffer.from(match[2], "base64"),
    extension,
    mimeType,
  };
}

function extensionFromMimeType(mimeType = "") {
  return mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
}

async function ensurePublicBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw new Error(`Supabase storage bucket lookup failed: ${listError.message}`);

  const existing = buckets.find((bucket) => bucket.name === BUCKET_NAME);
  if (existing) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: "8MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Supabase storage bucket creation failed: ${createError.message}`);
  }
}

export function isInlineImageDataUrl(value = "") {
  return /^data:image\/[a-z0-9+.-]+;base64,/i.test(String(value));
}

export async function uploadImageIfNeeded({ imageUrl, userId, fileName }) {
  if (!isInlineImageDataUrl(imageUrl)) return imageUrl;

  const parsed = parseDataUrl(imageUrl);
  if (!parsed) throw new Error("Uploaded image must be a valid image data URL.");

  await ensurePublicBucket();

  const safeName = String(fileName || "pin-image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const storagePath = `${userId}/${Date.now()}-${randomUUID()}-${safeName || "image"}.${parsed.extension}`;

  const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(storagePath, parsed.buffer, {
    contentType: parsed.mimeType,
    upsert: false,
  });

  if (error) throw new Error(`Supabase image upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function uploadImageBuffer({ buffer, userId, fileName, mimeType }) {
  if (!buffer?.length) throw new Error("Image file is required.");
  if (!String(mimeType || "").startsWith("image/")) throw new Error("Only image uploads are supported.");

  await ensurePublicBucket();

  const safeName = String(fileName || "pin-image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const storagePath = `${userId}/${Date.now()}-${randomUUID()}-${safeName || "image"}.${extensionFromMimeType(mimeType)}`;

  const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(`Supabase image upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  return {
    imageUrl: data.publicUrl,
    storagePath,
    mimeType,
  };
}
