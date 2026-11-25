/**
 * Parents still on the shared starting PIN have mustChangePin false in the database.
 * Login asks them to choose a PIN. Saving that PIN must succeed without the old PIN.
 *
 *   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/sunsports_parent_import_test \
 *   API_URL=http://127.0.0.1:4000 \
 *     npx tsx scripts/check-first-pin-change.ts
 */
import { prisma } from "../src/lib/prisma.js";
import { getDefaultPin, hashPin, parentNeedsPinChange } from "../src/lib/auth.js";

const PHONE = "9001110098";
const API = (process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const NEXT_PIN = "654321";
const LATER_PIN = "654322";

function assert(name: string, ok: boolean, detail?: string) {
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`PASS  ${name}`);
}

async function req(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: json as { token?: string; error?: string; user?: { mustChangePin?: boolean } } };
}

async function main() {
  const dbName = new URL(process.env.DATABASE_URL || "http://invalid").pathname.replace(/^\//, "");
  if (!/test/i.test(dbName) || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run outside a local test database.");
  }

  const pinHash = await hashPin(getDefaultPin());
  const student = await prisma.student.create({
    data: { name: "Pin Check Child", parentName: "Pin Check Parent", parentPhone: PHONE },
  });
  const parent = await prisma.user.create({
    data: {
      phone: PHONE,
      role: "parent",
      name: "Pin Check Parent",
      parentPhone: PHONE,
      pinHash,
      mustChangePin: false,
      pinChangedAt: null,
    },
  });

  try {
    assert("stored flag is still false", parent.mustChangePin === false && parent.pinChangedAt == null);
    assert("login will still force a new PIN", (await parentNeedsPinChange(parent)) === true);

    const login = await req("/api/auth/login", { phone: PHONE, pin: getDefaultPin(), portal: "parent" });
    assert("parent can sign in with the starting PIN", login.status === 200 && !!login.json.token, String(login.status));
    assert("sign-in tells the app to choose a PIN", login.json.user?.mustChangePin === true);

    const saved = await req("/api/auth/change-pin", { newPin: NEXT_PIN }, login.json.token);
    assert("new PIN saves without the current PIN", saved.status === 200, `${saved.status} ${saved.json.error || ""}`);
    assert("saved user is no longer forced", saved.json.user?.mustChangePin === false);

    const again = await req("/api/auth/change-pin", { newPin: LATER_PIN }, login.json.token);
    assert("later change still requires the current PIN", again.status === 400 && again.json.error === "Current PIN required");

    const withCurrent = await req(
      "/api/auth/change-pin",
      { currentPin: NEXT_PIN, newPin: LATER_PIN },
      login.json.token
    );
    assert("change works when the current PIN is sent", withCurrent.status === 200, String(withCurrent.status));
  } finally {
    await prisma.user.deleteMany({ where: { phone: PHONE, role: "parent" } });
    await prisma.student.deleteMany({ where: { id: student.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
