import { Readable } from "node:stream";
import { getDrive } from "./google.js";
import { getServiceSupabase } from "./supabase-admin.js";

/**
 * Shared Google Drive uploader used by every module.
 * - Auto-creates nested folders under GOOGLE_DRIVE_FOLDER_ID (root).
 * - Caches folder path -> drive id in `public.drive_folders`.
 * - Persists file metadata into `public.attachments`.
 * Binary files ONLY live in Drive. Supabase stores metadata.
 */

const ROOT_FOLDER_ID = () => {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set");
  return id;
};

function sanitizeSegment(s: string) {
  return (s || "").trim().replace(/[\/\\]/g, "-").replace(/\s+/g, " ").slice(0, 120) || "untitled";
}

async function findChildFolder(drive: ReturnType<typeof getDrive>, parentId: string, name: string) {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(drive: ReturnType<typeof getDrive>, parentId: string, name: string) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id!;
}

/**
 * Ensures the nested folder path exists under the root. Returns the leaf folder Drive id.
 * Caches every path in `drive_folders` so we skip Drive lookups on the next upload.
 */
export async function ensureFolderPath(pathSegments: string[]): Promise<{ folderId: string; path: string }> {
  const drive = getDrive();
  const sb = getServiceSupabase();
  const cleaned = pathSegments.map(sanitizeSegment).filter(Boolean);
  const fullPath = cleaned.join("/");

  if (fullPath) {
    const { data: cached } = await sb
      .from("drive_folders")
      .select("drive_folder_id")
      .eq("path", fullPath)
      .maybeSingle();
    if (cached?.drive_folder_id) return { folderId: cached.drive_folder_id, path: fullPath };
  } else {
    return { folderId: ROOT_FOLDER_ID(), path: "" };
  }

  // Walk the path, creating anything missing.
  let parentId = ROOT_FOLDER_ID();
  let accum: string[] = [];
  for (const seg of cleaned) {
    accum.push(seg);
    const subPath = accum.join("/");

    const { data: subCached } = await sb
      .from("drive_folders")
      .select("drive_folder_id")
      .eq("path", subPath)
      .maybeSingle();

    if (subCached?.drive_folder_id) {
      parentId = subCached.drive_folder_id;
      continue;
    }

    let childId = await findChildFolder(drive, parentId, seg);
    if (!childId) childId = await createFolder(drive, parentId, seg);

    await sb.from("drive_folders").upsert(
      { path: subPath, drive_folder_id: childId },
      { onConflict: "path" },
    );
    parentId = childId;
  }
  return { folderId: parentId, path: fullPath };
}

export interface UploadInput {
  pathSegments: string[];
  name: string;
  mimeType: string;
  body: Readable | Buffer;
  makePublicLink?: boolean;
}

export interface UploadedFile {
  driveFileId: string;
  driveFolderId: string;
  drivePath: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink: string;
}

export async function uploadToDrive(input: UploadInput): Promise<UploadedFile> {
  const drive = getDrive();
  const { folderId, path } = await ensureFolderPath(input.pathSegments);

  const created = await drive.files.create({
    requestBody: {
      name: input.name,
      parents: [folderId],
    },
    media: { mimeType: input.mimeType, body: input.body as any },
    fields: "id, size, webViewLink, mimeType, name",
    supportsAllDrives: true,
  });

  const fileId = created.data.id!;
  if (input.makePublicLink) {
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
        supportsAllDrives: true,
      });
    } catch (e) {
      console.warn("Drive permissions.create failed:", (e as Error).message);
    }
  }

  return {
    driveFileId: fileId,
    driveFolderId: folderId,
    drivePath: path,
    name: created.data.name ?? input.name,
    mimeType: created.data.mimeType ?? input.mimeType,
    size: Number(created.data.size ?? 0),
    webViewLink: created.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}

export async function deleteDriveFile(fileId: string) {
  const drive = getDrive();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (e) {
    console.warn("Drive delete failed:", (e as Error).message);
  }
}
