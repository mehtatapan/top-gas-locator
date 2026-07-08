import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import fs from "node:fs";
import { requireUser, requirePermission } from "./_lib/auth.js";
import { uploadToDrive, deleteDriveFile } from "./_lib/drive-uploader.js";
import { getServiceSupabase } from "./_lib/supabase-admin.js";

export const config = { api: { bodyParser: false, sizeLimit: "26mb" } };

const MAX = 25 * 1024 * 1024;

async function parse(req: VercelRequest) {
  const form = formidable({ maxFileSize: MAX, multiples: false, keepExtensions: true });
  return await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse(req as any, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

function val(f: formidable.Fields, k: string) {
  const v = (f as Record<string, unknown>)[k];
  if (Array.isArray(v)) return String(v[0] ?? "");
  return v == null ? "" : String(v);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "POST") return await handlePost(req, res);
    if (req.method === "DELETE") return await handleDelete(req, res);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    const status = e?.status ?? 500;
    console.error("uploads error:", e);
    return res.status(status).json({ error: e?.message ?? "Internal error" });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  requirePermission(user, "uploads.create");

  const { fields, files } = await parse(req);
  const module = val(fields, "module").trim();
  const entityId = val(fields, "entityId").trim() || null;
  const entityType = val(fields, "entityType").trim() || null;
  const storeId = val(fields, "storeId").trim() || null;
  const subPathRaw = val(fields, "subPath").trim(); // slash-separated
  const makePublic = val(fields, "public") === "true";

  if (!module) return res.status(400).json({ error: "module is required" });

  const raw = files.file;
  const file = Array.isArray(raw) ? raw[0] : raw;
  if (!file) return res.status(400).json({ error: "file is required" });
  if ((file.size ?? 0) > MAX) return res.status(400).json({ error: "File exceeds 25MB" });

  const pathSegments = ["VT Gas & Market", module, ...subPathRaw.split("/").filter(Boolean)];

  const uploaded = await uploadToDrive({
    pathSegments,
    name: file.originalFilename ?? "upload",
    mimeType: file.mimetype ?? "application/octet-stream",
    body: fs.createReadStream(file.filepath),
    makePublicLink: makePublic,
  });
  fs.promises.unlink(file.filepath).catch(() => {});

  const sb = getServiceSupabase();
  const { data: row, error } = await sb
    .from("attachments")
    .insert({
      module,
      entity_type: entityType,
      entity_id: entityId,
      store_id: storeId,
      drive_file_id: uploaded.driveFileId,
      drive_folder_id: uploaded.driveFolderId,
      drive_folder_path: uploaded.drivePath,
      name: uploaded.name,
      mime_type: uploaded.mimeType,
      size_bytes: uploaded.size,
      web_view_link: uploaded.webViewLink,
      uploaded_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb.from("audit_logs").insert({
    actor_id: user.id,
    module,
    action: "upload",
    entity_type: "attachments",
    entity_id: row.id,
    after: row,
  });

  return res.status(200).json({ attachment: row });
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const id = (req.query.id as string) || "";
  if (!id) return res.status(400).json({ error: "id required" });

  const sb = getServiceSupabase();
  const { data: att, error: e1 } = await sb.from("attachments").select("*").eq("id", id).maybeSingle();
  if (e1) throw e1;
  if (!att) return res.status(404).json({ error: "not found" });

  const isOwner = att.uploaded_by === user.id;
  const canDelete = user.permissions.includes("uploads.delete") || user.permissions.includes("admin.stores");
  if (!isOwner && !canDelete) return res.status(403).json({ error: "Forbidden" });

  await deleteDriveFile(att.drive_file_id);
  await sb.from("attachments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await sb.from("audit_logs").insert({
    actor_id: user.id,
    module: att.module,
    action: "delete",
    entity_type: "attachments",
    entity_id: id,
    before: att,
  });
  return res.status(200).json({ ok: true });
}
