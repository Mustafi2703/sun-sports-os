import {
  classifyParentImport,
  matchStudentName,
  normalizeIndianMobile,
  parseParentImportText,
  type CatalogParent,
  type CatalogStudent,
} from "./parentImport.js";

function fail(errors: string[], message: string) {
  errors.push(message);
}

export function runParentImportChecks(): void {
  const errors: string[] = [];
  const students: CatalogStudent[] = [
    { id: "s1", name: "Demo Student 01", parentName: "Old Parent", parentPhone: "9001110001" },
    { id: "s2", name: "Demo Student 02", parentName: "Other Parent", parentPhone: "9001110002" },
    { id: "s3", name: "Aarav Shah", parentName: "Meera Shah", parentPhone: "9001110003" },
    { id: "s4", name: "Ananya Rao", parentName: null, parentPhone: null },
    { id: "s5", name: "Twin Student", parentName: "Twin Parent", parentPhone: "9001110005" },
    { id: "s6", name: "Twin Student", parentName: "Twin Parent", parentPhone: "9001110006" },
  ];
  const parents: CatalogParent[] = [
    { id: "p1", phone: "9001110001", name: "Old Parent" },
    { id: "p2", phone: "9001110002", name: "Other Parent" },
  ];

  const exact = matchStudentName("Demo Student 01", students);
  if (exact.kind !== "match" || exact.match.confidence !== 100) fail(errors, "exact match");
  const typo = matchStudentName("Demo Studnt 01", students);
  if (typo.kind !== "match" || typo.match.studentId !== "s1" || typo.match.confidence !== 92) {
    fail(errors, "typo match");
  }
  const nearNumber = matchStudentName("Demo Student 02", [students[0]]);
  if (nearNumber.kind === "match") fail(errors, "numeric near-name must not auto match");
  const twins = matchStudentName("Twin Student", students);
  if (twins.kind !== "ambiguous") fail(errors, "duplicate names are ambiguous");
  const reordered = matchStudentName("Shah Aarav", students);
  if (reordered.kind !== "match" || reordered.match.studentId !== "s3" || reordered.match.confidence !== 98) {
    fail(errors, "reordered name");
  }
  if (normalizeIndianMobile("+91 98765 43210") !== "9876543210") fail(errors, "91 prefix");
  if (normalizeIndianMobile("09876543210") !== "9876543210") fail(errors, "leading zero");
  if (normalizeIndianMobile("98765") !== null) fail(errors, "short phone");
  if (normalizeIndianMobile("987654321099") !== null) fail(errors, "extra digits");

  const parsed = parseParentImportText(
    [
      "student name,parent name,parent phone,pin",
      "Demo Student 01,Old Parent,9001110001,",
      "Demo Studnt 02,Other Parent,9001110002,246810",
      "Missing Kid,New Parent,9001110099,",
      "Twin Student,Twin Parent,9001112222,",
      "Aarav Shah,Meera Shah,12345,",
      "Ananya Rao,New Parent,9001110099,12",
      "Demo Student 01,Second Parent,9001113333,",
      ",,9001114444,",
    ].join("\n")
  );
  if ("error" in parsed) fail(errors, parsed.error);
  else {
    const preview = classifyParentImport({ rows: parsed.rows, students, parents }).preview;
    const blob = JSON.stringify(preview);
    if (blob.includes("246810")) fail(errors, "preview leaked a PIN");
    const byName = (name: string) => preview.rows.filter((row) => row.studentName.toLowerCase().includes(name));
    const firstDemo = preview.rows.find((row) => row.index === 0);
    if (!firstDemo?.problems.some((item) => item.includes("already matched"))) {
      fail(errors, "first duplicate row should also be a problem");
    }
    const fuzzy = preview.rows.find((row) => row.index === 1);
    if (fuzzy?.status !== "update" || fuzzy.match?.studentId !== "s2" || fuzzy.diff?.pin !== "set") {
      fail(errors, "fuzzy row should update and set a PIN without showing it");
    }
    const missing = preview.rows.find((row) => row.index === 2);
    if (missing?.status !== "problem" || !missing.problems.some((item) => item.includes("No matching student"))) {
      fail(errors, "missing student");
    }
    const ambiguous = preview.rows.find((row) => row.index === 3);
    if (ambiguous?.status !== "problem" || !ambiguous.problems.some((item) => item.includes("More than one"))) {
      fail(errors, "ambiguous student");
    }
    const badPhone = preview.rows.find((row) => row.index === 4);
    if (badPhone?.status !== "problem" || !badPhone.problems.some((item) => item.includes("10-digit"))) {
      fail(errors, "bad phone");
    }
    const badPin = preview.rows.find((row) => row.index === 5);
    if (badPin?.status !== "problem" || !badPin.problems.some((item) => item.includes("4 to 6"))) {
      fail(errors, "bad pin");
    }
    const duplicate = preview.rows.find((row) => row.index === 6);
    if (duplicate?.status !== "problem" || !duplicate.problems.some((item) => item.includes("already matched"))) {
      fail(errors, "duplicate student row");
    }
    const blank = preview.rows.find((row) => row.index === 7);
    if (blank?.status !== "problem" || !blank.problems.some((item) => item.includes("Student name"))) {
      fail(errors, "blank student name");
    }
    if (byName("demo student").length < 2) fail(errors, "parsed student rows");
  }

  const unchangedCase = classifyParentImport({
    rows: [{ studentName: "Demo Student 01", parentName: "Old Parent", parentPhone: "9001110001", pin: "" }],
    students,
    parents,
  }).preview;
  if (unchangedCase.rows[0]?.status !== "unchanged") {
    fail(errors, `expected unchanged, got ${unchangedCase.rows[0]?.status}`);
  }

  const siblings = classifyParentImport({
    rows: [
      { studentName: "Demo Student 01", parentName: "Shared Parent", parentPhone: "9001117777", pin: "" },
      { studentName: "Demo Student 02", parentName: "Shared Parent", parentPhone: "9001117777", pin: "135790" },
    ],
    students,
    parents,
  }).preview;
  if (siblings.rows[0]?.status !== "create" || siblings.rows[1]?.status !== "update") {
    fail(errors, `siblings expected create+update, got ${siblings.rows.map((row) => row.status).join(",")}`);
  }
  if (siblings.rows[0]?.diff?.pin !== "set" || JSON.stringify(siblings).includes("135790")) {
    fail(errors, "sibling PIN handling");
  }

  const clash = classifyParentImport({
    rows: [
      { studentName: "Demo Student 01", parentName: "Parent A", parentPhone: "9001117777", pin: "111111" },
      { studentName: "Demo Student 02", parentName: "Parent B", parentPhone: "9001117777", pin: "222222" },
    ],
    students,
    parents,
  }).preview;
  if (clash.rows.some((row) => row.status !== "problem")) fail(errors, "conflicting phone should be a problem");
  const clashBlob = JSON.stringify(clash);
  if (clashBlob.includes("111111") || clashBlob.includes("222222")) fail(errors, "conflicting PINs leaked");

  const selected = classifyParentImport({
    rows: [{ studentName: "Aarav Shah", parentName: "Meera Shah", parentPhone: "9001110003", pin: "" }],
    indexes: [4],
    students,
    parents: [{ id: "p3", phone: "9001110003", name: "Meera Shah" }],
  }).preview;
  if (selected.rows[0]?.index !== 4 || selected.rows[0]?.status !== "unchanged") {
    fail(errors, "index-preserving unchanged row");
  }

  if (errors.length) {
    throw new Error(`Parent import checks failed:\n${errors.join("\n")}`);
  }
}
