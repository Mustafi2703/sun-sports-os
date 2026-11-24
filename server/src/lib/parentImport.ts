import * as XLSX from "xlsx";
import { prisma } from "./prisma.js";
import { getDefaultPin, hashPin, normalizePhone } from "./auth.js";

export const PARENT_IMPORT_CONFIRM = "APPLY PARENT IMPORT";
export const PARENT_IMPORT_COLUMNS = ["student name", "parent name", "parent phone", "pin"] as const;

const MAX_ROWS = 2000;

export type ParentImportInput = {
  studentName: string;
  parentName: string;
  parentPhone: string;
  pin: string;
};

export type CatalogStudent = {
  id: string;
  name: string;
  parentName: string | null;
  parentPhone: string | null;
};

export type CatalogParent = {
  id: string;
  phone: string;
  name: string;
};

export type ParentImportStatus = "create" | "update" | "unchanged" | "problem";

export type ParentImportCandidate = {
  studentId: string;
  studentName: string;
  confidence: number;
  label: string;
};

export type ParentImportPreviewRow = {
  index: number;
  status: ParentImportStatus;
  selectable: boolean;
  suggested: boolean;
  studentName: string;
  parentName: string;
  phone: string;
  problems: string[];
  match: ParentImportCandidate | null;
  candidates: ParentImportCandidate[];
  diff: {
    parentName: { before: string; after: string };
    parentPhone: { before: string; after: string };
    pin: "set" | "unchanged";
    parentRecord: "create" | "update" | "unchanged";
    note: string;
  } | null;
};

export type ParentImportPreview = {
  confirm: string;
  columns: string[];
  counts: { create: number; update: number; unchanged: number; problem: number };
  rows: ParentImportPreviewRow[];
};

export type ParentImportActor = {
  id?: string | null;
  name: string;
  role: string;
};

export type ParentImportApplyResult = {
  ok: true;
  created: number;
  updated: number;
  linked: number;
  unchanged: number;
  skipped: { index: number; studentName: string; problems: string[] }[];
  logId: string | null;
};

type Draft = {
  index: number;
  studentName: string;
  parentName: string;
  phoneRaw: string;
  phone: string | null;
  pin: string | null;
  problems: string[];
  match: ParentImportCandidate | null;
  candidates: ParentImportCandidate[];
};

type Classified = {
  preview: ParentImportPreview;
  pinByIndex: Map<number, string>;
};

/** 10-digit Indian mobile. Accepts 10 digits, a leading 0, or a leading 91. */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return null;
}

function normName(raw: string | null | undefined): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(raw: string): string[] {
  return normName(raw).split(" ").filter(Boolean);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function oneTypo(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const used = new Array(b.length).fill(false);
  const pending: string[] = [];
  for (const token of a) {
    const exact = b.findIndex((item, i) => !used[i] && item === token);
    if (exact >= 0) used[exact] = true;
    else pending.push(token);
  }
  if (pending.length !== 1) return false;
  const leftover = b.filter((_, i) => !used[i]);
  if (leftover.length !== 1) return false;
  const left = leftover[0];
  const right = pending[0];
  if (/^\d+$/.test(left) || /^\d+$/.test(right)) return false;
  if (left.length < 4 || right.length < 4) return false;
  return editDistance(left, right) === 1;
}

function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const right = new Set(b);
  let hit = 0;
  for (const token of a) if (right.has(token)) hit++;
  return hit / Math.max(a.length, b.length);
}

function scoreName(input: string, name: string): { confidence: number; label: string; auto: "exact" | "reorder" | "close" | "none" } {
  const a = normName(input);
  const b = normName(name);
  if (!a || !b) return { confidence: 0, label: "", auto: "none" };
  if (a === b) return { confidence: 100, label: "Exact match", auto: "exact" };
  const ta = tokensOf(input);
  const tb = tokensOf(name);
  if (ta.length && [...ta].sort().join(" ") === [...tb].sort().join(" ")) {
    return { confidence: 98, label: "Same name, different word order", auto: "reorder" };
  }
  if (oneTypo(ta, tb)) return { confidence: 92, label: "Close match", auto: "close" };
  const confidence = Math.round(tokenOverlap(ta, tb) * 70);
  return { confidence, label: confidence >= 40 ? "Similar name" : "", auto: "none" };
}

export function matchStudentName(
  input: string,
  students: { id: string; name: string }[]
):
  | { kind: "empty" }
  | { kind: "none"; candidates: ParentImportCandidate[] }
  | { kind: "ambiguous"; candidates: ParentImportCandidate[] }
  | { kind: "match"; match: ParentImportCandidate; candidates: ParentImportCandidate[] } {
  if (!normName(input)) return { kind: "empty" };
  const scored = students.map((student) => {
    const score = scoreName(input, student.name);
    return {
      studentId: student.id,
      studentName: student.name,
      confidence: score.confidence,
      label: score.label,
      auto: score.auto,
    };
  });
  const candidates = scored
    .filter((row) => row.confidence >= 40)
    .sort((a, b) => b.confidence - a.confidence || a.studentName.localeCompare(b.studentName))
    .slice(0, 3)
    .map(({ studentId, studentName, confidence, label }) => ({ studentId, studentName, confidence, label }));

  const pick = (auto: "exact" | "reorder" | "close") => scored.filter((row) => row.auto === auto);
  for (const auto of ["exact", "reorder", "close"] as const) {
    const hits = pick(auto);
    if (hits.length === 1) {
      const hit = hits[0];
      return {
        kind: "match" as const,
        match: {
          studentId: hit.studentId,
          studentName: hit.studentName,
          confidence: hit.confidence,
          label: hit.label,
        },
        candidates,
      };
    }
    if (hits.length > 1) {
      return {
        kind: "ambiguous" as const,
        candidates: hits.map(({ studentId, studentName, confidence, label }) => ({
          studentId,
          studentName,
          confidence,
          label,
        })),
      };
    }
  }
  return { kind: "none", candidates };
}

function cell(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  const text = String(value ?? "").trim();
  if (/e\+/i.test(text)) {
    const asNumber = Number(text);
    if (Number.isFinite(asNumber)) return String(Math.round(asNumber));
  }
  return text;
}

function headerKey(value: unknown): string {
  return cell(value)
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function studentHeaderScore(key: string): number {
  if (key === "student name" || key === "player name" || key === "child name") return 3;
  if (key === "student" || key === "player" || key === "child") return 2;
  if (key === "name") return 1;
  return 0;
}

function parentHeaderScore(key: string): number {
  if (key === "parent name" || key === "guardian name" || key === "father name" || key === "mother name") return 3;
  if (key === "parent" || key === "guardian") return 2;
  return 0;
}

function phoneHeaderScore(key: string): number {
  if (
    key === "parent phone" ||
    key === "parent whatsapp" ||
    key === "parent mobile" ||
    key === "mobile number" ||
    key === "phone number"
  ) {
    return 3;
  }
  if (key === "whatsapp" || key === "mobile" || key === "phone") return 2;
  return 0;
}

function pinHeaderScore(key: string): number {
  if (key === "parent pin" || key === "starting pin") return 3;
  if (key === "pin") return 2;
  return 0;
}

function pickColumn(headers: string[], score: (key: string) => number): number {
  let best = -1;
  let bestScore = 0;
  headers.forEach((key, index) => {
    const value = score(key);
    if (value > bestScore) {
      bestScore = value;
      best = index;
    }
  });
  return best;
}

function rowsFromMatrix(matrix: unknown[][]): { rows: ParentImportInput[] } | { error: string } {
  const limit = Math.min(matrix.length, 8);
  let headerAt = -1;
  for (let i = 0; i < limit; i++) {
    const keys = (matrix[i] || []).map(headerKey);
    if (pickColumn(keys, studentHeaderScore) >= 0 && pickColumn(keys, phoneHeaderScore) >= 0) {
      headerAt = i;
      break;
    }
  }
  if (headerAt < 0) {
    return {
      error: "Add a header row with student name, parent name, parent phone, and optional pin.",
    };
  }
  const headers = (matrix[headerAt] || []).map(headerKey);
  const studentCol = pickColumn(headers, studentHeaderScore);
  const phoneCol = pickColumn(headers, phoneHeaderScore);
  const parentCol = pickColumn(headers, parentHeaderScore);
  const pinCol = pickColumn(headers, pinHeaderScore);
  const rows: ParentImportInput[] = [];
  for (let i = headerAt + 1; i < matrix.length; i++) {
    const line = matrix[i] || [];
    const studentName = cell(line[studentCol]);
    const parentName = parentCol >= 0 ? cell(line[parentCol]) : "";
    const parentPhone = cell(line[phoneCol]);
    const pin = pinCol >= 0 ? cell(line[pinCol]).replace(/\s/g, "") : "";
    if (!studentName && !parentName && !parentPhone && !pin) continue;
    rows.push({ studentName, parentName, parentPhone, pin });
    if (rows.length > MAX_ROWS) return { error: `This file has more than ${MAX_ROWS} data rows.` };
  }
  return { rows };
}

function parseBook(book: XLSX.WorkBook): { rows: ParentImportInput[] } | { error: string } {
  const name = book.SheetNames[0];
  if (!name) return { error: "The file has no sheet." };
  const sheet = book.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
  return rowsFromMatrix(matrix);
}

export function parseParentImportText(text: string): { rows: ParentImportInput[] } | { error: string } {
  const cleaned = text.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) return { error: "Paste a header row and at least one parent row." };
  return parseBook(XLSX.read(cleaned, { type: "string" }));
}

export function parseParentImportBuffer(buffer: Buffer): { rows: ParentImportInput[] } | { error: string } {
  if (!buffer.length) return { error: "The file is empty." };
  return parseBook(XLSX.read(buffer, { type: "buffer" }));
}

function tidyName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function classifyParentImport(args: {
  rows: ParentImportInput[];
  students: CatalogStudent[];
  parents: CatalogParent[];
  indexes?: number[];
}): Classified {
  const roster = args.students.map((student) => ({ id: student.id, name: student.name }));
  const drafts: Draft[] = args.rows.map((row, position) => {
    const index = args.indexes ? args.indexes[position] : position;
    const problems: string[] = [];
    const studentName = tidyName(row.studentName);
    if (!normName(studentName)) problems.push("Student name is required.");
    const phone = normalizeIndianMobile(row.parentPhone);
    if (!phone) problems.push("Phone must be a 10-digit Indian mobile.");
    const pinText = String(row.pin || "").trim();
    let pin: string | null = null;
    if (pinText) {
      if (!/^\d{4,6}$/.test(pinText)) problems.push("PIN must be 4 to 6 digits.");
      else pin = pinText;
    }
    const found = normName(studentName) ? matchStudentName(studentName, roster) : { kind: "empty" as const };
    let match: ParentImportCandidate | null = null;
    let candidates: ParentImportCandidate[] = [];
    if (found.kind === "match") {
      match = found.match;
      candidates = found.candidates;
    } else if (found.kind === "ambiguous") {
      candidates = found.candidates;
      const listed = found.candidates.map((item) => `${item.studentName} (${item.confidence}%)`).join(", ");
      problems.push(`More than one student matches: ${listed}.`);
    } else if (found.kind === "none") {
      candidates = found.candidates;
      problems.push("No matching student. Students are not created from this import.");
    }
    return {
      index,
      studentName,
      parentName: tidyName(row.parentName),
      phoneRaw: tidyName(row.parentPhone),
      phone,
      pin,
      problems,
      match,
      candidates,
    };
  });

  const byPhone = new Map<string, Draft[]>();
  for (const draft of drafts) {
    if (!draft.phone) continue;
    const list = byPhone.get(draft.phone) || [];
    list.push(draft);
    byPhone.set(draft.phone, list);
  }
  for (const group of byPhone.values()) {
    const names = new Set(group.map((row) => normName(row.parentName)).filter(Boolean));
    if (names.size > 1) {
      for (const row of group) row.problems.push("This phone is used with a different parent name in the file.");
    }
    const pins = new Set(group.map((row) => row.pin).filter((pin): pin is string => Boolean(pin)));
    if (pins.size > 1) {
      for (const row of group) row.problems.push("This phone has more than one PIN in the file.");
    }
  }

  const firstStudentRow = new Map<string, number>();
  for (const draft of drafts) {
    if (!draft.match) continue;
    const first = firstStudentRow.get(draft.match.studentId);
    if (first == null) {
      firstStudentRow.set(draft.match.studentId, draft.index);
      continue;
    }
    const message = (other: number) => `This student is already matched on row ${other + 1}.`;
    if (!draft.problems.includes(message(first))) draft.problems.push(message(first));
    const earlier = drafts.find((row) => row.index === first);
    if (earlier && !earlier.problems.includes(message(draft.index))) earlier.problems.push(message(draft.index));
  }

  const studentsById = new Map(args.students.map((student) => [student.id, student]));
  const parentsByPhone = new Map(args.parents.map((parent) => [normalizePhone(parent.phone), parent]));
  const pinByIndex = new Map<number, string>();
  const rows: ParentImportPreviewRow[] = drafts.map((draft) => {
    if (draft.problems.length || !draft.match || !draft.phone) {
      return {
        index: draft.index,
        status: "problem",
        selectable: false,
        suggested: false,
        studentName: draft.studentName,
        parentName: draft.parentName,
        phone: draft.phone || draft.phoneRaw,
        problems: draft.problems,
        match: draft.match,
        candidates: draft.candidates,
        diff: null,
      };
    }

    const group = (byPhone.get(draft.phone) || []).filter((row) => row.problems.length === 0 && row.phone);
    const ordered = [...group].sort((a, b) => a.index - b.index);
    const first = ordered[0];
    const consensus = ordered.map((row) => row.parentName).find((name) => normName(name)) || "";
    const student = studentsById.get(draft.match.studentId);
    const existing = parentsByPhone.get(draft.phone);
    const afterName = draft.parentName || consensus || existing?.name || student?.parentName || "Parent";
    const groupPin = ordered.map((row) => row.pin).find((pin): pin is string => Boolean(pin)) || null;
    const nameChanges = normName(student?.parentName || "") !== normName(afterName);
    const phoneChanges = normalizePhone(student?.parentPhone) !== draft.phone;
    const userNameChanges = !existing || normName(existing.name) !== normName(afterName);
    let parentRecord: "create" | "update" | "unchanged" = "unchanged";
    if (!existing) parentRecord = "create";
    else if (userNameChanges || groupPin) parentRecord = "update";

    let status: ParentImportStatus = "unchanged";
    if (!existing && first && draft.index === first.index) status = "create";
    else if (!existing || phoneChanges || nameChanges || parentRecord === "update") status = "update";

    let note = "No changes.";
    if (status === "create") note = "New parent to create. This student will be linked to that login.";
    else if (!existing && first) note = `Links this student to the new parent on row ${first.index + 1}.`;
    else if (parentRecord === "update") note = "Existing parent to update.";
    else if (status === "update") note = "Links this student to the existing parent.";
    if (groupPin && status !== "unchanged") note = `${note} A new starting PIN will be set.`;

    if (groupPin) pinByIndex.set(draft.index, groupPin);

    return {
      index: draft.index,
      status,
      selectable: true,
      suggested: status === "create" || status === "update",
      studentName: draft.studentName,
      parentName: draft.parentName,
      phone: draft.phone,
      problems: [],
      match: draft.match,
      candidates: draft.candidates,
      diff: {
        parentName: { before: student?.parentName || "", after: afterName },
        parentPhone: { before: student?.parentPhone || "", after: draft.phone },
        pin: groupPin ? "set" : "unchanged",
        parentRecord,
        note,
      },
    };
  });

  return {
    preview: {
      confirm: PARENT_IMPORT_CONFIRM,
      columns: [...PARENT_IMPORT_COLUMNS],
      counts: {
        create: rows.filter((row) => row.status === "create").length,
        update: rows.filter((row) => row.status === "update").length,
        unchanged: rows.filter((row) => row.status === "unchanged").length,
        problem: rows.filter((row) => row.status === "problem").length,
      },
      rows,
    },
    pinByIndex,
  };
}

async function loadCatalog(): Promise<{ students: CatalogStudent[]; parents: CatalogParent[] }> {
  const [students, parents] = await Promise.all([
    prisma.student.findMany({
      select: { id: true, name: true, parentName: true, parentPhone: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "parent" },
      select: { id: true, phone: true, name: true },
    }),
  ]);
  return { students, parents };
}

export async function previewParentImport(rows: ParentImportInput[]): Promise<ParentImportPreview> {
  const catalog = await loadCatalog();
  return classifyParentImport({ rows, ...catalog }).preview;
}

export async function applyParentImport(
  rows: ParentImportInput[],
  include: number[],
  actor: ParentImportActor
): Promise<ParentImportApplyResult> {
  const wanted = new Set(include);
  const selected = rows
    .map((row, index) => ({ row, index }))
    .filter((item) => wanted.has(item.index));
  const catalog = await loadCatalog();
  const classified = classifyParentImport({
    rows: selected.map((item) => item.row),
    indexes: selected.map((item) => item.index),
    ...catalog,
  });
  const skipped = classified.preview.rows
    .filter((row) => row.status === "problem")
    .map((row) => ({ index: row.index, studentName: row.studentName, problems: row.problems }));
  const unchanged = classified.preview.rows.filter((row) => row.status === "unchanged").length;
  const actionable = classified.preview.rows.filter((row) => row.status === "create" || row.status === "update");
  if (!actionable.length) {
    return { ok: true, created: 0, updated: 0, linked: 0, unchanged, skipped, logId: null };
  }

  const defaultHash = await hashPin(getDefaultPin());
  const phonePlans = new Map<
    string,
    { phone: string; name: string; pin: string | null; createUser: boolean; pinHash: string | null }
  >();
  for (const row of actionable) {
    if (!row.phone || !row.diff) continue;
    const pin = classified.pinByIndex.get(row.index) || null;
    const existing = phonePlans.get(row.phone);
    if (!existing) {
      phonePlans.set(row.phone, {
        phone: row.phone,
        name: row.diff.parentName.after,
        pin,
        createUser: row.diff.parentRecord === "create",
        pinHash: null,
      });
    } else if (pin) {
      existing.pin = pin;
    }
  }
  for (const plan of phonePlans.values()) {
    if (plan.pin) plan.pinHash = await hashPin(plan.pin);
    else if (plan.createUser) plan.pinHash = defaultHash;
    plan.pin = null;
  }

  const summaryRows: { studentId: string; action: string; phoneLast4: string }[] = [];
  let created = 0;
  let updated = 0;
  let linked = 0;

  const logId = await prisma.$transaction(async (tx) => {
    for (const row of actionable) {
      if (!row.match || !row.diff || !row.phone) continue;
      const student = catalog.students.find((item) => item.id === row.match!.studentId);
      const nextName = row.diff.parentName.after;
      const nameSame = normName(student?.parentName || "") === normName(nextName);
      const phoneSame = normalizePhone(student?.parentPhone) === row.phone;
      if (!nameSame || !phoneSame) {
        await tx.student.update({
          where: { id: row.match.studentId },
          data: { parentName: nextName, parentPhone: row.phone },
        });
        linked += 1;
        summaryRows.push({
          studentId: row.match.studentId,
          action: row.status,
          phoneLast4: row.phone.slice(-4),
        });
      }
    }

    for (const plan of phonePlans.values()) {
      const existing = await tx.user.findUnique({
        where: { phone_role: { phone: plan.phone, role: "parent" } },
      });
      if (!existing) {
        await tx.user.create({
          data: {
            phone: plan.phone,
            role: "parent",
            name: plan.name || "Parent",
            parentPhone: plan.phone,
            pinHash: plan.pinHash || defaultHash,
            mustChangePin: true,
          },
        });
        created += 1;
        continue;
      }
      const nameSame = normName(existing.name) === normName(plan.name);
      const phoneSame = existing.parentPhone === plan.phone;
      if (nameSame && phoneSame && !plan.pinHash) continue;
      await tx.user.update({
        where: { id: existing.id },
        data: {
          name: plan.name || existing.name || "Parent",
          parentPhone: plan.phone,
          ...(plan.pinHash
            ? { pinHash: plan.pinHash, mustChangePin: true, pinChangedAt: null }
            : {}),
        },
      });
      updated += 1;
    }

    const log = await tx.parentImportLog.create({
      data: {
        actorUserId: actor.id || null,
        actorName: actor.name.trim() || "Staff",
        actorRole: actor.role || "admin",
        appliedCount: summaryRows.length,
        createdCount: created,
        updatedCount: updated,
        summary: { rows: summaryRows },
      },
    });
    return log.id;
  });

  return { ok: true, created, updated, linked, unchanged, skipped, logId };
}
