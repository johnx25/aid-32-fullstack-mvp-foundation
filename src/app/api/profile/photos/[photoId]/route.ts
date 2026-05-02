import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { log } from "@/lib/logger";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  let userId: number;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return fail(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { photoId: rawId } = await params;
  const photoId = parseInt(rawId, 10);
  if (isNaN(photoId)) {
    return fail(400, "BAD_REQUEST", "Invalid photo ID");
  }

  const photo = await prisma.profilePhoto.findUnique({ where: { id: photoId } });
  if (!photo) return fail(404, "NOT_FOUND", "Photo not found");
  if (photo.userId !== userId) return fail(403, "FORBIDDEN", "Not your photo");

  // Delete file from disk (best effort)
  try {
    const filePath = path.join(UPLOAD_DIR, String(userId), photo.filename);
    await unlink(filePath);
  } catch {
    log("warn", "photo.delete.file_missing", { photoId, userId });
  }

  await prisma.profilePhoto.delete({ where: { id: photoId } });

  // Re-normalize sortOrder for remaining photos
  const remaining = await prisma.profilePhoto.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await Promise.all(
    remaining.map((p, idx) =>
      prisma.profilePhoto.update({ where: { id: p.id }, data: { sortOrder: idx } }),
    ),
  );

  log("info", "photo.delete.success", { photoId, userId });
  return ok({ deleted: true });
}
