import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { api } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";
import { portalRouter } from "./routes/portal.js";
import { assertProductionSecrets, requireAuth } from "./lib/auth.js";
import { smsStatusLine } from "./lib/sms.js";
import { emailStatusLine } from "./lib/email.js";
import {
  IMPORT_REPLACE_CONFIRM,
  IMPORT_UPSERT_CONFIRM,
  applyImport,
  excelReplaceAllowed,
  previewImport,
} from "./lib/excelImport.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PRODUCTION_FRONTEND_ORIGINS = ["https://sun-sports-os.vercel.app"];

function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (process.env.NODE_ENV === "production") return PRODUCTION_FRONTEND_ORIGINS;
  return ["*"];
}

const origins = allowedOrigins();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origins.includes("*") || origins.includes(origin)) cb(null, true);
      else cb(null, false);
    },
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Sun Sports SportsOS API",
    health: "/api/health",
    auth: "/api/auth/login",
    portals: { parent: "/api/portal/parent", coach: "/api/portal/coach" },
    snapshot: "/api/snapshot",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/portal", portalRouter);
app.use("/api", api);

/** Read-only preview of an Excel roster import. Admin only. */
app.post("/api/import/excel/preview", requireAuth("admin"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    res.json(await previewImport(req.file.buffer));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not read workbook" });
  }
});

/** Excel import. Admin only. Upsert requires confirm APPLY IMPORT. Replace also requires REPLACE ROSTER and, in production, ALLOW_EXCEL_REPLACE=true. */
app.post("/api/import/excel", requireAuth("admin"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const mode = req.body.mode === "replace" ? "replace" : "upsert";
    const confirm = String(req.body.confirm || "");
    if (mode === "replace") {
      if (!excelReplaceAllowed()) {
        return res.status(403).json({
          error: "Replace import is disabled. Set ALLOW_EXCEL_REPLACE=true on the server to enable it.",
        });
      }
      if (confirm !== IMPORT_REPLACE_CONFIRM) {
        return res.status(400).json({ error: `Type ${IMPORT_REPLACE_CONFIRM} to replace the roster.` });
      }
    } else if (confirm !== IMPORT_UPSERT_CONFIRM) {
      return res.status(400).json({ error: `Confirm the preview with ${IMPORT_UPSERT_CONFIRM} before importing.` });
    }
    const result = await applyImport(req.file.buffer, mode);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Import failed", detail: String(e) });
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

assertProductionSecrets();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sun Sports API listening on :${PORT}`);
  console.log(smsStatusLine());
  console.log(emailStatusLine());
  console.log("Startup did not change database rows.");
});
