import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  PARENT_IMPORT_CONFIRM,
  applyParentImport,
  parseParentImportBuffer,
  parseParentImportText,
  previewParentImport,
  type ParentImportInput,
} from "../lib/parentImport.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function optionalImportFile(req: Request, res: Response, next: NextFunction) {
  const type = String(req.headers["content-type"] || "");
  if (!type.includes("multipart/form-data")) return next();
  return upload.single("file")(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ error: "Could not read the upload." });
    next();
  });
}

function parseInclude(raw: unknown): { include: number[] } | { error: string } {
  let value = raw;
  if (typeof value === "string" && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      return { error: "Tick at least one row to apply." };
    }
  }
  if (!Array.isArray(value) || value.length === 0) return { error: "Tick at least one row to apply." };
  const include: number[] = [];
  for (const item of value) {
    const n = Number(item);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: "Tick at least one row to apply." };
    include.push(n);
  }
  return { include };
}

function readRows(req: Request): { rows: ParentImportInput[] } | { error: string } {
  if (req.file?.buffer?.length) return parseParentImportBuffer(req.file.buffer);
  const text = req.body?.text;
  if (typeof text === "string" && text.trim()) return parseParentImportText(text);
  return { error: "Upload a CSV or Excel file, or paste rows." };
}

export async function previewParentImportHttp(req: Request, res: Response) {
  try {
    const parsed = readRows(req);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    const preview = await previewParentImport(parsed.rows);
    res.json(preview);
  } catch {
    console.error("parent import preview failed");
    res.status(500).json({ error: "Could not build the preview." });
  }
}

export async function applyParentImportHttp(req: Request, res: Response) {
  try {
    const confirm = String(req.body?.confirm || "");
    if (confirm !== PARENT_IMPORT_CONFIRM) {
      return res.status(400).json({ error: `Confirm the preview with ${PARENT_IMPORT_CONFIRM} before applying.` });
    }
    const include = parseInclude(req.body?.include);
    if ("error" in include) return res.status(400).json({ error: include.error });
    const parsed = readRows(req);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    const actor = req.user;
    const result = await applyParentImport(parsed.rows, include.include, {
      id: actor?.id || null,
      name: actor?.name || "Staff",
      role: actor?.role || "admin",
    });
    res.json(result);
  } catch {
    console.error("parent import apply failed");
    res.status(500).json({ error: "Could not apply the parent import." });
  }
}
