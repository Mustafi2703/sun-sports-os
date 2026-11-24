import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { api, type ParentImportPreview } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  create: "New parent",
  update: "Update",
  unchanged: "Unchanged",
  problem: "Problem",
} as const;

function downloadTemplate() {
  const csv = "student name,parent name,parent phone,pin\nDemo Student,Demo Parent,9000000000,\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "parent-login-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ParentImportPanel({ mode }: { mode: "admin" | "coach" }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParentImportPreview | null>(null);
  const [ticks, setTicks] = useState<Record<number, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const remember = (next: ParentImportPreview) => {
    setPreview(next);
    setConfirmed(false);
    const initial: Record<number, boolean> = {};
    for (const row of next.rows) initial[row.index] = row.suggested;
    setTicks(initial);
  };

  const previewText = async () => {
    if (!text.trim()) {
      toast.error("Paste a header row and the parent rows first.");
      return;
    }
    setBusy(true);
    setFile(null);
    try {
      remember(await api.previewParentImport(mode, text));
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Could not read those rows");
    } finally {
      setBusy(false);
    }
  };

  const previewFile = async (picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    setFile(picked);
    try {
      remember(await api.previewParentImportFile(mode, picked));
    } catch (error) {
      setPreview(null);
      setFile(null);
      toast.error(error instanceof Error ? error.message : "Could not read the file");
    } finally {
      setBusy(false);
    }
  };

  const selected = preview?.rows.filter((row) => row.selectable && ticks[row.index]).map((row) => row.index) || [];

  const apply = async () => {
    if (!preview || !confirmed || selected.length === 0) return;
    setBusy(true);
    try {
      const result = file
        ? await api.applyParentImportFile(mode, file, preview.confirm, selected)
        : await api.applyParentImport(mode, { text, confirm: preview.confirm, include: selected });
      const skipped = result.skipped.length ? ` ${result.skipped.length} skipped.` : "";
      toast.success(
        `Parent import saved. ${result.created} new logins, ${result.updated} updated, ${result.linked} student links.${skipped}`
      );
      setPreview(null);
      setTicks({});
      setConfirmed(false);
      setText("");
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply the import");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="font-display font-semibold">Bulk parent logins</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Columns: student name, parent name, parent phone, and optional pin. Use a 10-digit Indian mobile.
          Siblings can share one phone. The preview matches existing students and does not save anything.
          Apply updates parent logins and parent name and phone only.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(event) => void previewFile(event.target.files?.[0])}
        />
        <Button type="button" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> {busy ? "Reading…" : "Upload CSV or Excel"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={downloadTemplate}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Column template
        </Button>
      </div>
      {file && <p className="text-xs text-muted-foreground">File: {file.name}. Preview does not write to the database.</p>}
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        placeholder={"student name,parent name,parent phone,pin\nDemo Student,Demo Parent,9000000000,"}
      />
      <Button type="button" size="sm" variant="outline" disabled={busy || !text.trim()} onClick={() => void previewText()}>
        Preview pasted rows
      </Button>

      {preview && (
        <div className="space-y-3">
          <p className="text-sm">
            {preview.counts.create} new parent rows, {preview.counts.update} updates, {preview.counts.unchanged} unchanged,{" "}
            {preview.counts.problem} problems.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Apply</th>
                  <th className="px-3 py-2 text-left font-medium">Row</th>
                  <th className="px-3 py-2 text-left font-medium">In file</th>
                  <th className="px-3 py-2 text-left font-medium">Match</th>
                  <th className="px-3 py-2 text-left font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.map((row) => (
                  <tr key={row.index} className={cn(row.status === "problem" && "bg-destructive/5")}>
                    <td className="px-3 py-3 align-top">
                      <Checkbox
                        checked={Boolean(ticks[row.index])}
                        disabled={!row.selectable || busy}
                        onCheckedChange={(value) => setTicks((current) => ({ ...current, [row.index]: value === true }))}
                        aria-label={`Apply row ${row.index + 1}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-muted-foreground">{row.index + 1}</td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium">{row.studentName || "No student name"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.parentName || "No parent name"} · {row.phone || "No phone"}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.match ? (
                        <p>
                          {row.match.studentName}
                          <span className="block text-xs text-muted-foreground">
                            {row.match.label} ({row.match.confidence}%)
                          </span>
                        </p>
                      ) : (
                        <p className="text-muted-foreground">No student selected</p>
                      )}
                      {!row.match && row.candidates.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Closest: {row.candidates.map((item) => `${item.studentName} (${item.confidence}%)`).join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className={cn("font-medium", row.status === "problem" && "text-destructive")}>{STATUS_LABEL[row.status]}</p>
                      {row.problems.map((problem) => (
                        <p key={problem} className="text-xs text-destructive mt-1">{problem}</p>
                      ))}
                      {row.diff && (
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p>{row.diff.note}</p>
                          <p>Parent name: {row.diff.parentName.before || "blank"} to {row.diff.parentName.after || "blank"}</p>
                          <p>Phone: {row.diff.parentPhone.before || "blank"} to {row.diff.parentPhone.after || "blank"}</p>
                          <p>{row.diff.pin === "set" ? "A new starting PIN will be set." : "PIN unchanged."}</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {preview.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No data rows in that file.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={confirmed}
              disabled={busy || selected.length === 0}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <span>Apply only the ticked rows. This creates or updates parent logins and parent name and phone on those students.</span>
          </label>
          <Button type="button" disabled={busy || !confirmed || selected.length === 0} onClick={() => void apply()}>
            {busy ? "Saving…" : `Apply ${selected.length} parent row${selected.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
}
