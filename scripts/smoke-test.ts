/**
 * Smoke test against a live SportsOS API with real Sun Sports HP data.
 * Usage: API_URL=https://xxx.up.railway.app npx tsx scripts/smoke-test.ts
 */
const API = (process.env.API_URL || process.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

type Result = { name: string; ok: boolean; detail?: string };

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, json };
}

async function run() {
  const results: Result[] = [];
  const assert = (name: string, ok: boolean, detail?: string) => {
    results.push({ name, ok, detail });
    const mark = ok ? "PASS" : "FAIL";
    console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  console.log(`\nSun Sports SportsOS smoke test\nAPI: ${API}\n`);

  // Health
  {
    const r = await req("/api/health");
    assert("GET /api/health", r.ok && (r.json as { ok?: boolean })?.ok === true, `status ${r.status}`);
  }

  // Snapshot with real data
  let snapshot: {
    academyName: string;
    students: { id: string; name: string }[];
    coaches: { id: string; name: string }[];
    batches: { id: string; name: string; monthlyFee: number }[];
    aggregates: { totalStudents: number };
  };
  {
    const r = await req("/api/snapshot");
    snapshot = r.json as typeof snapshot;
    assert("GET /api/snapshot", r.ok, `students=${snapshot?.students?.length}`);
    assert("Seed has Sun Sports academy", snapshot?.academyName === "Sun Sports", snapshot?.academyName);
    assert("Seed has ≥12 students (HP roster)", (snapshot?.students?.length ?? 0) >= 12, String(snapshot?.students?.length));
    assert("Seed has High Performance batch", snapshot?.batches?.some((b) => /high performance/i.test(b.name)) ?? false);
    assert("Seed has Harry Sir coach", snapshot?.coaches?.some((c) => /harry/i.test(c.name)) ?? false);
    assert("Ayaan Patel present", snapshot?.students?.some((s) => /ayaan/i.test(s.name)) ?? false);
  }

  const batchId = snapshot.batches[0]?.id;
  const coachId = snapshot.coaches[0]?.id;

  // CRUD Student
  let studentId = "";
  {
    const r = await req("/api/students", {
      method: "POST",
      body: JSON.stringify({
        name: "Smoke Test Athlete",
        parentName: "Smoke Parent",
        parentPhone: "9800011122",
        batchId,
        role: "All Rounder",
        feeStatus: "overdue1",
        feeAmount: 15000,
        daysOverdue: 2,
      }),
    });
    studentId = (r.json as { id?: string })?.id || "";
    assert("POST /api/students create", r.status === 201 && !!studentId, studentId);
  }
  {
    const r = await req(`/api/students/${studentId}`, {
      method: "PUT",
      body: JSON.stringify({ feeStatus: "paid", daysOverdue: 0, role: "Batting" }),
    });
    assert("PUT /api/students/:id update", r.ok && (r.json as { feeStatus?: string })?.feeStatus === "paid");
  }

  // Payment
  {
    const r = await req("/api/payments", {
      method: "POST",
      body: JSON.stringify({ studentId, amount: 15000, method: "upi", month: "Jul 2026" }),
    });
    assert("POST /api/payments", r.status === 201, String(r.status));
  }

  // Attendance bulk
  {
    const r = await req("/api/attendance/bulk", {
      method: "POST",
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        batchId,
        marks: [
          { studentId, status: "present" },
          ...(snapshot.students.slice(0, 3).map((s) => ({ studentId: s.id, status: "present" }))),
        ],
      }),
    });
    assert("POST /api/attendance/bulk", r.ok && (r.json as { count?: number })?.count >= 1);
  }

  // Batch CRUD
  let extraBatch = "";
  {
    const r = await req("/api/batches", {
      method: "POST",
      body: JSON.stringify({
        name: "Smoke U-14",
        ageGroup: "Under 14",
        schedule: "Sat/Sun",
        time: "7:00 – 8:00 AM",
        venue: "Ground 2",
        capacity: 16,
        monthlyFee: 8000,
        coachId,
      }),
    });
    extraBatch = (r.json as { id?: string })?.id || "";
    assert("POST /api/batches", r.status === 201 && !!extraBatch);
  }
  {
    const r = await req(`/api/batches/${extraBatch}`, {
      method: "PUT",
      body: JSON.stringify({ monthlyFee: 8500 }),
    });
    assert("PUT /api/batches/:id", r.ok && (r.json as { monthlyFee?: number })?.monthlyFee === 8500);
  }
  {
    const r = await req(`/api/batches/${extraBatch}`, { method: "DELETE" });
    assert("DELETE /api/batches/:id", r.ok);
  }

  // Coach CRUD
  let coachExtra = "";
  {
    const r = await req("/api/coaches", {
      method: "POST",
      body: JSON.stringify({ name: "Smoke Coach", phone: "9000000000", specialty: "Fitness" }),
    });
    coachExtra = (r.json as { id?: string })?.id || "";
    assert("POST /api/coaches", r.status === 201 && !!coachExtra);
  }
  {
    const r = await req(`/api/coaches/${coachExtra}`, { method: "DELETE" });
    assert("DELETE /api/coaches/:id", r.ok);
  }

  // Enquiry
  let enquiryId = "";
  {
    const r = await req("/api/enquiries", {
      method: "POST",
      body: JSON.stringify({ parentName: "Lead Parent", phone: "9111111111", childName: "Lead Kid", childAge: 11, status: "new" }),
    });
    enquiryId = (r.json as { id?: string })?.id || "";
    assert("POST /api/enquiries", r.status === 201 && !!enquiryId);
  }
  {
    const r = await req(`/api/enquiries/${enquiryId}`, { method: "DELETE" });
    assert("DELETE /api/enquiries/:id", r.ok);
  }

  // Cleanup student
  {
    const r = await req(`/api/students/${studentId}`, { method: "DELETE" });
    assert("DELETE /api/students/:id cleanup", r.ok);
  }

  // Final snapshot still healthy
  {
    const r = await req("/api/snapshot");
    const n = (r.json as { students: unknown[] })?.students?.length ?? 0;
    assert("Roster intact after CRUD (≥12)", r.ok && n >= 12, `students=${n}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("Smoke test OK — backend ready for Meta Business follow-up.\n");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
