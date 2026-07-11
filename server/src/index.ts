import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import * as XLSX from "xlsx";
import { api } from "./routes/api.js";
import { prisma } from "./lib/prisma.js";
import { ageFromDob } from "./lib/mappers.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const allowedOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) cb(null, true);
      else cb(null, false);
    },
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Sun Sports SportsOS API",
    health: "/api/health",
    snapshot: "/api/snapshot",
  });
});

app.use("/api", api);

/** Excel import — replaces/merges roster from Sun Sports template */
app.post("/api/import/excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const pickSheet = (hints: string[]) => {
      const name = wb.SheetNames.find((n) => hints.some((h) => n.toLowerCase().includes(h.toLowerCase())));
      return name ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null }) : [];
    };
    const val = (row: Record<string, unknown>, keys: string[]) => {
      for (const k of keys) {
        const hit = Object.keys(row).find((rk) => rk.toLowerCase().includes(k.toLowerCase()));
        if (hit != null && row[hit] != null && String(row[hit]).trim() !== "") return row[hit];
      }
      return undefined;
    };
    const asDate = (v: unknown): Date | null => {
      if (v == null || v === "") return null;
      if (v instanceof Date) return v;
      if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400 * 1000));
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const coachRows = pickSheet(["Coach"]);
    const batchRows = pickSheet(["Batch", "Bathch"]);
    const studentRows = pickSheet(["Student", "Data Entry"]);

    const mode = req.body.mode === "replace" ? "replace" : "upsert";

    if (mode === "replace") {
      await prisma.attendanceRecord.deleteMany();
      await prisma.feePayment.deleteMany();
      await prisma.coachNote.deleteMany();
      await prisma.student.deleteMany();
      await prisma.batch.deleteMany();
      await prisma.coach.deleteMany();
    }

    const coachMap = new Map<string, string>();
    for (const row of coachRows) {
      const name = String(val(row, ["Coach Name", "name"]) || "").trim();
      if (!name) continue;
      const phone = String(val(row, ["Phone"]) || "");
      const specialty = String(val(row, ["Specialization", "specialty"]) || "Coach");
      const existing = await prisma.coach.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      const coach = existing
        ? await prisma.coach.update({
            where: { id: existing.id },
            data: { phone: phone || existing.phone, specialty },
          })
        : await prisma.coach.create({
            data: {
              name,
              phone: phone || null,
              specialty,
              initials: name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
            },
          });
      coachMap.set(name.toLowerCase(), coach.id);
    }

    let defaultBatchId: string | null = null;
    for (const row of batchRows) {
      const name = String(val(row, ["Batch Name", "name"]) || "").trim();
      if (!name) continue;
      const coachName = String(val(row, ["Assigned Coach", "coach"]) || "");
      const coachId =
        [...coachMap.entries()].find(([n]) => coachName.toLowerCase().includes(n.split(" ")[0]))?.[1] ||
        [...coachMap.values()][0] ||
        null;
      const fee = Number(val(row, ["Monthly Fee", "fee", "₹"]) || 15000) || 15000;
      const existing = await prisma.batch.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      const batch = existing
        ? await prisma.batch.update({
            where: { id: existing.id },
            data: {
              schedule: String(val(row, ["Days"]) || existing.schedule || ""),
              time: String(val(row, ["Timings", "time"]) || existing.time || ""),
              monthlyFee: fee,
              coachId,
              capacity: parseInt(String(val(row, ["Capacity", "Max"]) || "20"), 10) || 20,
            },
          })
        : await prisma.batch.create({
            data: {
              name,
              ageGroup: "Open",
              schedule: String(val(row, ["Days"]) || "Mon–Fri"),
              time: String(val(row, ["Timings", "time"]) || "5:00 – 7:30 PM"),
              venue: "Sun Sports Ground",
              monthlyFee: fee,
              coachId,
              capacity: parseInt(String(val(row, ["Capacity", "Max"]) || "20"), 10) || 20,
            },
          });
      if (!defaultBatchId) defaultBatchId = batch.id;
    }

    if (!defaultBatchId) {
      const any = await prisma.batch.findFirst();
      defaultBatchId = any?.id ?? null;
      if (!defaultBatchId) {
        const firstCoach = await prisma.coach.findFirst();
        const created = await prisma.batch.create({
          data: {
            name: "High Performance",
            ageGroup: "Open (HP)",
            schedule: "Mon–Fri",
            time: "5:00 – 7:30 PM",
            venue: "Sun Sports Ground",
            monthlyFee: 15000,
            capacity: 20,
            coachId: firstCoach?.id,
          },
        });
        defaultBatchId = created.id;
      }
    }

    let imported = 0;
    for (const row of studentRows) {
      const name = String(val(row, ["Student Full Name", "Student Name", "name"]) || "").trim();
      if (!name) continue;
      const dob = asDate(val(row, ["Date of Birth", "DOB"]));
      const parentName = String(val(row, ["Parent", "Guardian"]) || "").trim();
      const parentPhone = String(val(row, ["WhatsApp", "Phone"]) || "");
      const role = String(val(row, ["Assigned Batch", "Batch", "role"]) || "").trim();
      const joinDate = asDate(val(row, ["Joining Date", "join"]));
      const medicalNotes = String(val(row, ["Medical", "Allergies"]) || "None");

      const existing = await prisma.student.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (existing) {
        await prisma.student.update({
          where: { id: existing.id },
          data: {
            dob,
            age: ageFromDob(dob) ?? existing.age,
            parentName: parentName || existing.parentName,
            parentPhone: parentPhone || existing.parentPhone,
            role: role || existing.role,
            joinDate: joinDate || existing.joinDate,
            medicalNotes,
            batchId: defaultBatchId,
          },
        });
      } else {
        await prisma.student.create({
          data: {
            name,
            dob,
            age: ageFromDob(dob) ?? 12,
            parentName,
            parentPhone,
            role,
            joinDate: joinDate || new Date(),
            medicalNotes,
            batchId: defaultBatchId,
            feeAmount: 15000,
            feeStatus: "paid",
          },
        });
      }
      imported++;
    }

    const academy = await prisma.academy.findFirst();
    if (!academy) {
      await prisma.academy.create({ data: { name: "Sun Sports", program: "High Performance Cricket", address: "Ahmedabad, Gujarat" } });
    }

    res.json({
      ok: true,
      imported,
      coaches: await prisma.coach.count(),
      batches: await prisma.batch.count(),
      students: await prisma.student.count(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Import failed", detail: String(e) });
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sun Sports API listening on :${PORT}`);
});
