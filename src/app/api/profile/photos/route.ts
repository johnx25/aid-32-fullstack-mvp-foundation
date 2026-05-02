import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_PHOTOS_PER_USER = 10;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function getExtension(mime: string): string {
  return mime === "image/png" ? "png" : "jpg";
}

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const photos = await prisma.profilePhoto.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, url: true, sortOrder: true, createdAt: true },
    });
    return ok(photos);
  } catch {
    return fail(401, "UNAUTHORIZED", "Unauthorized");
  }
}

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return fail(401, "UNAUTHORIZED", "Unauthorized");
  }

  // Rate limit: 20 uploads per user per hour
  const limit = checkRateLimit(`photo:upload:${userId}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return fail(429, "TOO_MANY_REQUESTS", "Upload limit reached. Please wait.");
  }

  // Count existing photos
  const existing = await prisma.profilePhoto.count({ where: { userId } });
  if (existing >= MAX_PHOTOS_PER_USER) {
    return fail(400, "BAD_REQUEST", `Maximum ${MAX_PHOTOS_PER_USER} photos allowed.`);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail(400, "BAD_REQUEST", "Invalid form data");
  }

  const file = formData.get("photo");
  if (!file || !(file instanceof File)) {
    return fail(400, "BAD_REQUEST", "No photo file provided. Field name must be 'photo'.");
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return fail(400, "BAD_REQUEST", "Only JPG and PNG files are allowed.");
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return fail(400, "BAD_REQUEST", `File too large. Maximum size is 8 MB.`);
  }

  // Read file bytes and do a magic-byte check (don't trust the MIME type header alone)
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

  if (!isJpeg && !isPng) {
    return fail(400, "BAD_REQUEST", "File content does not match a valid JPG or PNG image.");
  }

  const ext      = getExtension(file.type);
  const safeName = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const userDir  = path.join(UPLOAD_DIR, String(userId));
  const filePath = path.join(userDir, safeName);
  const url      = `/uploads/${userId}/${safeName}`;

  try {
    await mkdir(userDir, { recursive: true });
    await writeFile(filePath, buffer);
  } catch (err) {
    log("error", "photo.upload.write_failed", { userId, reason: String(err) });
    return fail(500, "INTERNAL_ERROR", "Failed to save photo.");
  }

  const photo = await prisma.profilePhoto.create({
    data: {
      userId,
      url,
      filename: safeName,
      mimeType: file.type,
      sizeBytes: file.size,
      sortOrder: existing,
    },
    select: { id: true, url: true, sortOrder: true, createdAt: true },
  });

  log("info", "photo.upload.success", { userId, photoId: photo.id, url });
  return ok(photo, 201);
}
