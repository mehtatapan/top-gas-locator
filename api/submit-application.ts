import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import fs from "node:fs";
import { Readable } from "node:stream";
import { Resend } from "resend";
import { getSheets } from "./_lib/google.js";
import { uploadToDrive } from "./_lib/drive-uploader.js";

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "12mb",
  },
};

const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function sanitize(part: string) {
  return (part || "").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "x";
}

function ext(filename: string, mime: string) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || "");
  if (m) return m[1].toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/msword") return "doc";
  if (mime.includes("wordprocessingml")) return "docx";
  return "bin";
}

async function parseForm(req: VercelRequest) {
  const form = formidable({
    maxFileSize: MAX_RESUME_BYTES,
    multiples: false,
    keepExtensions: true,
  });
  return await new Promise<{ fields: formidable.Fields; files: formidable.Files }>(
    (resolve, reject) => {
      form.parse(req as any, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    },
  );
}

function val(f: formidable.Fields, key: string): string {
  const v = (f as Record<string, unknown>)[key];
  if (Array.isArray(v)) return String(v[0] ?? "");
  return v == null ? "" : String(v);
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fields, files } = await parseForm(req);

    const firstName = val(fields, "firstName").trim();
    const lastName = val(fields, "lastName").trim();
    const email = val(fields, "email").trim();
    const phone = val(fields, "phone").trim();
    const address = val(fields, "address").trim();
    const city = val(fields, "city").trim();
    const state = val(fields, "state").trim();
    const zip = val(fields, "zip").trim();
    const position = val(fields, "position").trim();
    const storeLocation = val(fields, "storeLocation").trim();
    const employmentType = val(fields, "employmentType").trim();
    const startDate = val(fields, "startDate").trim();
    const desiredWage = val(fields, "desiredWage").trim();
    const experience = val(fields, "experience").trim();
    const workAuthorized = val(fields, "workAuthorized").trim();
    const over18 = val(fields, "over18").trim();
    const fit = val(fields, "fit").trim();
    const availabilitySummary = val(fields, "availabilitySummary").trim();
    const applicationId = val(fields, "applicationId").trim() || `VTGM-${Date.now().toString(36).toUpperCase()}`;

    if (!firstName || !lastName || !email || !position || !storeLocation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const resumeRaw = files.resume;
    const resume = Array.isArray(resumeRaw) ? resumeRaw[0] : resumeRaw;
    if (!resume) return res.status(400).json({ error: "Resume file required" });

    const mime = resume.mimetype || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return res.status(400).json({ error: "Resume must be PDF, DOC, or DOCX" });
    }
    if ((resume.size ?? 0) > MAX_RESUME_BYTES) {
      return res.status(400).json({ error: "Resume exceeds 10MB limit" });
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const hiringEmail = process.env.HIRING_EMAIL || "vtgmhr@gmail.com";
    const resendKey = process.env.RESEND_API_KEY;

    if (!folderId || !sheetId) {
      return res.status(500).json({ error: "Server missing GOOGLE_DRIVE_FOLDER_ID / GOOGLE_SHEET_ID" });
    }

    // --- Upload to Drive via shared uploader (Careers/{position}/{storeLocation}/) ---
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `${today}_${sanitize(firstName)}_${sanitize(lastName)}_${sanitize(position)}_${sanitize(storeLocation)}.${ext(resume.originalFilename ?? "", mime)}`;

    const uploaded = await uploadToDrive({
      pathSegments: ["VT Gas & Market", "Careers", position, storeLocation],
      name: fileName,
      mimeType: mime,
      body: fs.createReadStream(resume.filepath),
      makePublicLink: true,
    });
    const fileId = uploaded.driveFileId;
    const resumeLink = uploaded.webViewLink;

    // --- Append row to Sheet ---
    const sheets = getSheets();
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          timestamp,
          `${firstName} ${lastName}`,
          email,
          phone,
          position,
          storeLocation,
          employmentType,
          availabilitySummary,
          experience,
          resumeLink,
          "New",
          applicationId,
          `${address}, ${city}, ${state} ${zip}`,
          startDate,
          desiredWage,
          workAuthorized,
          over18,
          fit,
        ]],
      },
    });

    // --- Cleanup temp file ---
    fs.promises.unlink(resume.filepath).catch(() => {});

    // --- Emails ---
    if (resendKey) {
      const resend = new Resend(resendKey);
      const from = "VT Gas & Market Careers <careers@vtgasandmarket.com>";

      // applicant confirmation
      await resend.emails.send({
        from,
        to: [email],
        subject: "We received your application — VT Gas & Market",
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
          <h2 style="color:#b91c1c">Thanks for applying, ${firstName}!</h2>
          <p>We've received your application for the <strong>${position}</strong> position at our <strong>${storeLocation}</strong> location.</p>
          <p>Our hiring team will review your application and reach out if it's a good fit.</p>
          <p>Reference ID: <strong>${applicationId}</strong></p>
          <p style="margin-top:24px">— VT Gas & Market</p>
        </div>`,
      });

      // HR notification
      await resend.emails.send({
        from,
        to: [hiringEmail],
        subject: `New Application: ${firstName} ${lastName} — ${position} (${storeLocation})`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111">
          <h2>New job application</h2>
          <p><strong>Reference:</strong> ${applicationId}</p>
          <table cellpadding="6" style="border-collapse:collapse">
            <tr><td><b>Name</b></td><td>${firstName} ${lastName}</td></tr>
            <tr><td><b>Email</b></td><td>${email}</td></tr>
            <tr><td><b>Phone</b></td><td>${phone}</td></tr>
            <tr><td><b>Address</b></td><td>${address}, ${city}, ${state} ${zip}</td></tr>
            <tr><td><b>Position</b></td><td>${position}</td></tr>
            <tr><td><b>Location</b></td><td>${storeLocation}</td></tr>
            <tr><td><b>Type</b></td><td>${employmentType}</td></tr>
            <tr><td><b>Start</b></td><td>${startDate}</td></tr>
            <tr><td><b>Desired Wage</b></td><td>$${desiredWage}/hr</td></tr>
            <tr><td><b>Work Auth</b></td><td>${workAuthorized}</td></tr>
            <tr><td><b>18+</b></td><td>${over18}</td></tr>
            <tr><td valign="top"><b>Availability</b></td><td><pre style="font-family:inherit;white-space:pre-wrap;margin:0">${availabilitySummary}</pre></td></tr>
            <tr><td valign="top"><b>Experience</b></td><td>${experience.replace(/</g, "&lt;")}</td></tr>
            <tr><td valign="top"><b>Why a fit</b></td><td>${fit.replace(/</g, "&lt;")}</td></tr>
          </table>
          <p style="margin-top:16px"><a href="${resumeLink}">View Resume in Drive</a></p>
        </div>`,
      });
    } else {
      console.warn("RESEND_API_KEY not set; skipping emails");
    }

    return res.status(200).json({ ok: true, applicationId, resumeLink });
  } catch (e: any) {
    console.error("submit-application error:", e);
    return res.status(500).json({ error: e?.message ?? "Internal error" });
  }
}
