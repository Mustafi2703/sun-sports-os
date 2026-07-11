import { useRef, useState } from "react";
import { Download, Upload, RotateCcw, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { academyName, getSnapshot, resetToSeed, saveSnapshot, students, coaches, batches } from "@/data/academy";
import { parseAcademyExcel, fetchAndParseSeedExcel } from "@/lib/excelImport";
import { toast } from "sonner";

const Settings = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastImport, setLastImport] = useState<string | null>(null);

  const applySnapshot = (label: string) => (snap: Awaited<ReturnType<typeof parseAcademyExcel>>) => {
    saveSnapshot(snap);
    setLastImport(`${label} · ${snap.students.length} students, ${snap.coaches.length} coaches, ${snap.batches.length} batches`);
    toast.success(`Imported ${snap.students.length} students`);
    // Reload so all pages pick up mutable exports
    setTimeout(() => window.location.reload(), 600);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const snap = await parseAcademyExcel(file);
      applySnapshot(file.name)(snap);
    } catch (e) {
      console.error(e);
      toast.error("Could not parse Excel file. Use the Sun Sports template format.");
    } finally {
      setBusy(false);
    }
  };

  const reloadSeedExcel = async () => {
    setBusy(true);
    try {
      const snap = await fetchAndParseSeedExcel();
      applySnapshot("sun-sports-students-2026.xlsx")(snap);
    } catch (e) {
      console.error(e);
      toast.error("Seed Excel not found in /public/data");
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = () => {
    resetToSeed();
    toast.success("Reset to Sun Sports seed data");
    setTimeout(() => window.location.reload(), 400);
  };

  const snap = getSnapshot();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Academy profile, data import, and integrations." />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Academy profile">
          <Field label="Academy name" defaultValue={academyName} />
          <Field label="Program" defaultValue="High Performance Cricket" />
          <Field label="Phone" defaultValue={coaches[0]?.phone ?? "+91 90330 02641"} />
          <Field label="Address" defaultValue="Ahmedabad, Gujarat" />
        </Card>

        <Card title="Data import">
          <p className="text-sm text-muted-foreground">
            Upload the Sun Sports Excel roster (students, coaches, batches). Current store:{" "}
            <span className="text-foreground font-medium">{students.length}</span> students ·{" "}
            <span className="text-foreground font-medium">{batches.length}</span> batches ·{" "}
            <span className="text-foreground font-medium">{coaches.length}</span> coaches.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              disabled={busy}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {busy ? "Importing…" : "Upload Excel"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={reloadSeedExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Load bundled HP data
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={resetDemo}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset seed
            </Button>
            <a href="/data/sun-sports-students-2026.xlsx" download>
              <Button size="sm" variant="ghost">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download template
              </Button>
            </a>
          </div>

          {lastImport && (
            <p className="text-xs text-primary flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> {lastImport}
            </p>
          )}

          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground mt-2">
            Expected sheets: <strong className="text-foreground">Student Data Entry</strong>,{" "}
            <strong className="text-foreground">Coaches</strong>, <strong className="text-foreground">Batches</strong>.
            Snapshot size: {JSON.stringify(snap).length.toLocaleString()} chars (local browser storage).
          </div>
        </Card>

        <Card title="Notifications">
          <Toggle label="Daily email summary" defaultChecked />
          <Toggle label="WhatsApp alerts for overdue fees" defaultChecked />
          <Toggle label="Coach push notifications" defaultChecked />
          <Toggle label="Parent portal access alerts" />
        </Card>

        <Card title="WhatsApp integration">
          <Field label="Business number" defaultValue={coaches[0]?.phone ?? "+91 90330 02641"} />
          <p className="text-xs text-primary">✓ Ready for WhatsApp Business API (Phase 1)</p>
        </Card>
      </div>
    </div>
  );
};

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
    <h3 className="font-display font-semibold">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, defaultValue }: { label: string; defaultValue: string }) => (
  <div>
    <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
    <Input defaultValue={defaultValue} />
  </div>
);

const Toggle = ({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
    <span className="text-sm">{label}</span>
    <Switch defaultChecked={defaultChecked} />
  </div>
);

export default Settings;
