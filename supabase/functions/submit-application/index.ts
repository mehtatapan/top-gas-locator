// VT Gas & Market — Careers application submission.
// Uploads resume to Google Drive, appends a row to Google Sheets,
// and sends confirmation + hiring-team notification emails via Resend.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const HIRING_EMAIL = Deno.env.get("HIRING_EMAIL") ?? "vtgmhr@gmail.com";
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
const SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function pemToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getAccessToken(scopes: string[]): Promise<string> {
  if (!SERVICE_ACCOUNT_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const sa: ServiceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
  const keyData = pemToBinary(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      scope: scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    cryptoKey,
  );

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Google token error ${resp.status}: ${text}`);
  return JSON.parse(text).access_token;
}

async function uploadResumeToStorage(
  fileName: string,
  contentType: string,
  bytes: Uint8Array,
): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const path = `${new Date().getFullYear()}/${fileName}`;
  const { error: upErr } = await supabase.storage
    .from("resumes")
    .upload(path, bytes, { contentType, upsert: false });
  if (upErr) throw new Error(`Storage upload: ${upErr.message}`);
  // Signed URL valid for ~10 years
  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 3650);
  if (error || !data?.signedUrl) throw new Error(`Signed URL: ${error?.message}`);
  return data.signedUrl;
}

async function appendToSheet(token: string, values: (string | number)[]) {
  const range = "Sheet1!A1";
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    },
  );
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Sheets append ${resp.status}: ${text}`);
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    console.warn("Resend keys missing; skipping email to", to);
    return;
  }
  const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "VT Gas & Market Careers <careers@vtgasandmarket.com>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error("Resend error:", resp.status, t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const data = await req.json();
    const {
      applicationId,
      submittedAt,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      zip,
      position,
      storeLocation,
      employmentType,
      startDate,
      desiredWage,
      experience,
      workAuthorized,
      over18,
      fit,
      availabilitySummary,
      resumeFileName,
      resumeContentType,
      resumeBase64,
    } = data;

    if (!firstName || !lastName || !email || !position || !resumeBase64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken([
      "https://www.googleapis.com/auth/spreadsheets",
    ]);

    // Decode resume
    const binary = atob(resumeBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const safeName = `${applicationId}_${firstName}_${lastName}_${resumeFileName}`.replace(
      /[^\w.\-]+/g,
      "_",
    );
    const resumeLink = await uploadResumeToStorage(
      safeName,
      resumeContentType || "application/octet-stream",
      bytes,
    );

    await appendToSheet(token, [
      applicationId,
      submittedAt,
      `${firstName} ${lastName}`,
      email,
      phone,
      `${address}, ${city}, ${state} ${zip}`,
      position,
      storeLocation,
      employmentType,
      startDate,
      String(desiredWage ?? ""),
      workAuthorized,
      over18,
      availabilitySummary ?? "",
      experience ?? "",
      fit ?? "",
      resumeLink,
    ]);

    // Applicant confirmation
    await sendEmail(
      email,
      "We received your application — VT Gas & Market",
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
        <h2 style="color:#b91c1c">Thanks for applying, ${firstName}!</h2>
        <p>We've received your application for the <strong>${position}</strong> position at our <strong>${storeLocation}</strong> location.</p>
        <p>Our hiring team will review your application and reach out if it's a good fit.</p>
        <p>Reference ID: <strong>${applicationId}</strong></p>
        <p style="margin-top:24px">— VT Gas & Market</p>
      </div>`,
    );

    // Hiring team notification
    await sendEmail(
      HIRING_EMAIL,
      `New Application: ${firstName} ${lastName} — ${position} (${storeLocation})`,
      `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111">
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
          <tr><td valign="top"><b>Availability</b></td><td><pre style="font-family:inherit;white-space:pre-wrap;margin:0">${availabilitySummary ?? ""}</pre></td></tr>
          <tr><td valign="top"><b>Experience</b></td><td>${(experience ?? "").replace(/</g, "&lt;")}</td></tr>
          <tr><td valign="top"><b>Why a fit</b></td><td>${(fit ?? "").replace(/</g, "&lt;")}</td></tr>
        </table>
        <p style="margin-top:16px"><a href="${drive.webViewLink}">View Resume in Drive</a></p>
      </div>`,
    );

    return new Response(
      JSON.stringify({ ok: true, applicationId, resumeLink: drive.webViewLink }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("submit-application error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
