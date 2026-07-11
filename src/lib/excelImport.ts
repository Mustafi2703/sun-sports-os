import * as XLSX from "xlsx";
import { snapshotFromExcelRows, type AcademySnapshot } from "@/data/academy";

function sheetToObjects(wb: XLSX.WorkBook, preferredNames: string[]): Record<string, unknown>[] {
  const names = wb.SheetNames;
  const sheetName =
    preferredNames.find((n) => names.some((s) => s.toLowerCase().includes(n.toLowerCase()))) ??
    names[0];
  if (!sheetName) return [];
  const actual = names.find((s) => s.toLowerCase().includes(sheetName.toLowerCase())) ?? sheetName;
  const sheet = wb.Sheets[actual];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}

export async function parseAcademyExcel(file: ArrayBuffer | File): Promise<AcademySnapshot> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const students = sheetToObjects(wb, ["Student", "Data Entry"]);
  const coaches = sheetToObjects(wb, ["Coach"]);
  const batches = sheetToObjects(wb, ["Batch", "Bathch"]);

  return snapshotFromExcelRows({ students, coaches, batches });
}

export async function fetchAndParseSeedExcel(): Promise<AcademySnapshot> {
  const res = await fetch("/data/sun-sports-students-2026.xlsx");
  if (!res.ok) throw new Error("Could not load seed Excel file");
  const buf = await res.arrayBuffer();
  return parseAcademyExcel(buf);
}
