/**
 * Google Drive URL helpers.
 *
 * Google Drive is the permanent document storage layer for this app.
 * All business files live in Drive; Supabase stores only metadata via
 * the `attachments` table.
 */

/** Direct-embed thumbnail URL for a public Drive image. Usable in <img src>. */
export function driveThumbUrl(fileId: string, width = 2000): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

/** Web-view URL (opens in Drive's viewer). */
export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Best-effort extraction of a Drive file id from any of the URL shapes
 * we historically stored (thumbnail, /file/d/, /open?id=).
 * Returns null if the input isn't a recognisable Drive URL.
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = p.exec(url);
    if (m?.[1]) return m[1];
  }
  return null;
}
