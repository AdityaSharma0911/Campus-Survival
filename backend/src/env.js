// Tiny .env loader (no dependencies). Real environment variables win over the file.
import fs from "node:fs";

export function loadEnv(fileUrl) {
  let text;
  try { text = fs.readFileSync(fileUrl, "utf8"); } catch { return false; }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  return true;
}
