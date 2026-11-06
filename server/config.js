import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.SUGARPEEK_DATA || path.join(ROOT, 'data');
export const PORT = Number(process.env.PORT || 8787);
export const PUBLIC_BASE = process.env.PUBLIC_BASE || `http://localhost:${PORT}`;
export const POLL_EVERY_MS = 5 * 60_000;
export const RETENTION_DAYS = 30;

fs.mkdirSync(DATA_DIR, { recursive: true });
