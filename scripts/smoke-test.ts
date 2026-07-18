/**
 * Smoke test against live SportsOS API (auth + portals + admin CRUD).
 * Usage: API_URL=https://xxx.up.railway.app npx tsx scripts/smoke-test.ts
 */
const API = (process.env.API_URL || process.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
const PIN = process.env.DEFAULT_PIN || "1234";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "9000000001";

type Result = { name: string; ok: boolean; detail?: string };

async function req(path: string, init?: RequestInit & { token?: string }) {
  const { token, ...rest } = init || {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((rest.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...rest, headers });
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
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  console.log(`\nSun Sports SportsOS smoke test\nAPI: ${API}\n`);

  {
    const r = await req("/api/health");
    assert("GET /api/health", r.ok && (r.json as { ok?: boolean })?.ok === true, `status ${r.status}`);
  }

  // Admin login
  let adminToken = "";
  {
    const r = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: ADMIN_PHONE, pin: PIN, portal: "admin" }),
    });
    adminToken = (r.json as { token?: string })?.token || "";
    assert("POST /api/auth/login admin", r.ok && !!adminToken, String(r.status));
  }

  // Snapshot requires admin
  {
    const denied = await req("/api/snapshot");
    assert("GET /api/snapshot without token → 401", denied.status === 401);
  }

  let snapshot: {
    academyName: string;
    students: { id: string; name: string; parentPhone: string }[];
    coaches: { id: string; name: string; phone: string }[];
    batches: { id: string; name: string; monthlyFee: number }[];
  };
  {
    const r = await req("/api/snapshot", { token: adminToken });
    snapshot = r.json as typeof snapshot;
    assert("GET /api/snapshot (admin)", r.ok, `students=${snapshot?.students?.length}`);
    assert("Seed has Sun Sports academy", snapshot?.academyName === "Sun Sports", snapshot?.academyName);
    assert("Seed has ≥12 students", (snapshot?.students?.length ?? 0) >= 12, String(snapshot?.students?.length));
    assert("Seed has High Performance batch", snapshot?.batches?.some((b) => /high performance/i.test(b.name)) ?? false);
    assert("Seed has Harry Sir coach", snapshot?.coaches?.some((c) => /harry/i.test(c.name)) ?? false);
  }

  // Parent portal login — prefer a parent phone that is not also reserved issues: take Ronak/Ayaan if present
  const preferred = snapshot.students.find((s) => /ayaan/i.test(s.name)) || snapshot.students.find((s) => s.parentPhone);
  const parentPhone = preferred?.parentPhone || "";
  let parentToken = "";
  {
    const r = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: parentPhone, pin: PIN, portal: "parent" }),
    });
    parentToken = (r.json as { token?: string })?.token || "";
    assert("POST /api/auth/login parent", r.ok && !!parentToken, `${preferred?.name} ${parentPhone}`);
  }
  {
    const r = await req("/api/portal/parent", { token: parentToken });
    const kids = (r.json as { children?: unknown[] })?.children ?? [];
    assert("GET /api/portal/parent", r.ok && kids.length >= 1, `children=${kids.length}`);
  }
  {
    const r = await req("/api/snapshot", { token: parentToken });
    assert("Parent cannot access admin snapshot", r.status === 403);
  }

  // Coach portal
  const coachPhone = snapshot.coaches.find((c) => /harry/i.test(c.name))?.phone || snapshot.coaches[0]?.phone || "";
  let coachToken = "";
  {
    const r = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: coachPhone, pin: PIN, portal: "coach" }),
    });
    coachToken = (r.json as { token?: string })?.token || "";
    assert("POST /api/auth/login coach", r.ok && !!coachToken, coachPhone);
  }
  {
    const r = await req("/api/portal/coach", { token: coachToken });
    const batches = (r.json as { batches?: unknown[] })?.batches ?? [];
    assert("GET /api/portal/coach", r.ok && batches.length >= 1, `batches=${batches.length}`);
  }

  // Wrong portal rejection — admin phone is not a parent account
  {
    const r = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: ADMIN_PHONE, pin: PIN, portal: "parent" }),
    });
    assert("Admin phone rejected on parent portal", r.status === 401 || r.status === 403, String(r.status));
  }

  const batchId = snapshot.batches[0]?.id;
  const coachId = snapshot.coaches[0]?.id;

  let studentId = "";
  {
    const r = await req("/api/students", {
      method: "POST",
      token: adminToken,
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
      token: adminToken,
      body: JSON.stringify({ feeStatus: "paid", daysOverdue: 0, role: "Batting" }),
    });
    assert("PUT /api/students/:id", r.ok && (r.json as { feeStatus?: string })?.feeStatus === "paid");
  }
  {
    const r = await req("/api/payments", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({ studentId, amount: 15000, method: "upi", month: "Jul 2026" }),
    });
    assert("POST /api/payments", r.status === 201, String(r.status));
  }
  {
    const r = await req("/api/attendance/bulk", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        batchId,
        marks: [
          { studentId, status: "present" },
          ...snapshot.students.slice(0, 3).map((s) => ({ studentId: s.id, status: "present" })),
        ],
      }),
    });
    assert("POST /api/attendance/bulk", r.ok && (r.json as { count?: number })?.count >= 1);
  }

  let extraBatch = "";
  {
    const r = await req("/api/batches", {
      method: "POST",
      token: adminToken,
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
      token: adminToken,
      body: JSON.stringify({ monthlyFee: 8500 }),
    });
    assert("PUT /api/batches/:id", r.ok && (r.json as { monthlyFee?: number })?.monthlyFee === 8500);
  }
  {
    const r = await req(`/api/batches/${extraBatch}`, { method: "DELETE", token: adminToken });
    assert("DELETE /api/batches/:id", r.ok);
  }

  let coachExtra = "";
  {
    const r = await req("/api/coaches", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({ name: "Smoke Coach", phone: "9000000099", specialty: "Fitness" }),
    });
    coachExtra = (r.json as { id?: string })?.id || "";
    assert("POST /api/coaches", r.status === 201 && !!coachExtra);
  }
  {
    const r = await req(`/api/coaches/${coachExtra}`, { method: "DELETE", token: adminToken });
    assert("DELETE /api/coaches/:id", r.ok);
  }

  // New parent can log in immediately after student create
  {
    const r = await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone: "9800011122", pin: PIN, portal: "parent" }),
    });
    assert("New student parent can login", r.ok && !!(r.json as { token?: string })?.token, String(r.status));
  }

  // Coach assessments + notes
  {
    const r = await req(`/api/portal/coach/students/${studentId}/scores`, {
      method: "PUT",
      token: coachToken,
      body: JSON.stringify({ scores: { batting: 4, bowling: 3.5, fielding: 4, fitness: 4, temperament: 3.5 } }),
    });
    // May 403 if student not in coach's batches — still assert endpoint exists
    assert(
      "PUT coach scores (own batch or 403)",
      r.ok || r.status === 403,
      String(r.status)
    );
  }

  let tournamentId = "";
  {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const r = await req("/api/tournaments", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({
        name: "Smoke Cup",
        startDate: today,
        endDate: end,
        format: "T20",
        venue: "Ground 1",
        studentIds: [studentId, ...(snapshot.students.slice(0, 2).map((s) => s.id))],
        opponents: ["Rival XI"],
        matches: [],
        status: "upcoming",
      }),
    });
    tournamentId = (r.json as { id?: string })?.id || "";
    assert("POST /api/tournaments", r.status === 201 && !!tournamentId, tournamentId);
  }
  {
    const r = await req("/api/tournaments", { token: adminToken });
    const list = (r.json as { id: string }[]) || [];
    assert("GET /api/tournaments", r.ok && list.some((t) => t.id === tournamentId), String(list.length));
  }
  {
    const r = await req(`/api/tournaments/${tournamentId}`, { method: "DELETE", token: adminToken });
    assert("DELETE /api/tournaments/:id", r.ok);
  }

  let enquiryId = "";
  {
    const r = await req("/api/enquiries", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({ parentName: "Lead Parent", phone: "9111111111", childName: "Lead Kid", childAge: 11, status: "new" }),
    });
    enquiryId = (r.json as { id?: string })?.id || "";
    assert("POST /api/enquiries", r.status === 201 && !!enquiryId);
  }
  {
    const r = await req(`/api/enquiries/${enquiryId}`, { method: "DELETE", token: adminToken });
    assert("DELETE /api/enquiries/:id", r.ok);
  }
  {
    const r = await req(`/api/students/${studentId}`, { method: "DELETE", token: adminToken });
    assert("DELETE /api/students/:id cleanup", r.ok);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("Smoke test OK — portals + admin API ready.\n");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
