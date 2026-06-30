import { google } from "googleapis";

export function getOAuth2Client() {
  const {
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REFRESH_TOKEN,
  } = process.env;

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error(
      "Missing Google OAuth env vars (GOOGLE_OAUTH_CLIENT_ID / SECRET / REFRESH_TOKEN)",
    );
  }

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
  );
  oAuth2Client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
  return oAuth2Client;
}

export function getDrive() {
  return google.drive({ version: "v3", auth: getOAuth2Client() });
}

export function getSheets() {
  return google.sheets({ version: "v4", auth: getOAuth2Client() });
}
