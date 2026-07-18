import { useRef, useState } from "react";
import { Download, Upload, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAcademy } from "@/context/AcademyContext";
import { toast } from "sonner";
import type { Coach } from "@/lib/api";

const Settings = () => {
  const { academyName, students, coaches, batches, api, refresh, error } = useAcademy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [coachEdit, setCoachEdit] = useState<Coach | null | undefined>(undefined);
  const [coachForm, setCoachForm] = useState({ name: "", phone: "", specialty: "", email: "" });

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await api.importExcel(file, "upsert");
      toast.success(`Imported — ${result.students} students, ${result.coaches} coaches`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const openCoach = (c?: Coach | null) => {
    setCoachEdit(c === undefined ? undefined : c);
    setCoachForm(
      c
        ? { name: c.name, phone: c.phone, specialty: c.specialty, email: c.email || "" }
        : { name: "", phone: "", specialty: "", email: "" }
    );
  };

  const saveCoach = async () => {
    setBusy(true);
    try {
      if (coachEdit) await api.updateCoach(coachEdit.id, coachForm);
      else await api.createCoach(coachForm);
      toast.success(coachEdit ? "Coach updated" : "Coach added");
      setCoachEdit(undefined);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const removeCoach = async (c: Coach) => {
    if (!confirm(`Delete coach ${c.name}?`)) return;
    try {
      await api.deleteCoach(c.id);
      toast.success("Coach deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Academy profile, coaches, and data import. Meta Business WhatsApp comes next." />
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          API error: {error}. Check VITE_API_URL and Railway backend.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Academy profile">
          <Field label="Academy name" defaultValue={academyName} />
          <Field label="Program" defaultValue="High Performance Cricket" />
          <Field label="Phone" defaultValue={coaches[0]?.phone ?? "+91 90330 02641"} />
          <Field label="Address" defaultValue="Ahmedabad, Gujarat" />
        </Card>

        <Card title="Portal access">
          <p className="text-sm text-muted-foreground mb-3">
            Parents, coaches, and internal team each have a separate login (phone + PIN).
          </p>
          <ul className="text-sm space-y-2">
            <li>
              <a className="text-primary underline" href="/parent/login" target="_blank" rel="noreferrer">Parent portal</a>
              <span className="text-muted-foreground"> — parent WhatsApp number · PIN 1234</span>
            </li>
            <li>
              <a className="text-primary underline" href="/coach/login" target="_blank" rel="noreferrer">Coach portal</a>
              <span className="text-muted-foreground"> — coach phone · PIN 1234</span>
            </li>
            <li>
              <a className="text-primary underline" href="/app/login" target="_blank" rel="noreferrer">Internal team</a>
              <span className="text-muted-foreground"> — 9000000001 · PIN 1234</span>
            </li>
          </ul>
        </Card>

        <Card title="Data import (API)">
          <p className="text-sm text-muted-foreground">
            Upload Excel to the Railway backend. Live store:{" "}
            <span className="text-foreground font-medium">{students.length}</span> students ·{" "}
            <span className="text-foreground font-medium">{batches.length}</span> batches ·{" "}
            <span className="text-foreground font-medium">{coaches.length}</span> coaches.
          </p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void onUpload(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={busy} className="bg-primary text-primary-foreground" onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> {busy ? "Importing…" : "Upload Excel"}
            </Button>
            <a href="/data/sun-sports-students-2026.xlsx" download>
              <Button size="sm" variant="ghost"><Download className="h-3.5 w-3.5 mr-1.5" /> Template</Button>
            </a>
          </div>
          <p className="text-xs text-primary flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sheets: Student Data Entry, Coaches, Batches
          </p>
        </Card>

        <Card title="Coaches">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => openCoach(null)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add coach
            </Button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {coaches.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.specialty} · {c.phone}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openCoach(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void removeCoach(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="WhatsApp / Meta Business">
          <Field label="Business number" defaultValue={coaches[0]?.phone ?? "+91 90330 02641"} />
          <p className="text-xs text-muted-foreground">
            Meta Business API connection will be wired in a follow-up. Messaging UI is ready; delivery stays mocked until credentials are added.
          </p>
          <Toggle label="WhatsApp alerts for overdue fees" defaultChecked />
          <Toggle label="Birthday wishes" defaultChecked />
        </Card>
      </div>

      <Dialog open={coachEdit !== undefined} onOpenChange={(o) => !o && setCoachEdit(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{coachEdit ? "Edit coach" : "Add coach"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={coachForm.name} onChange={(e) => setCoachForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={coachForm.phone} onChange={(e) => setCoachForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Specialty</Label><Input value={coachForm.specialty} onChange={(e) => setCoachForm((f) => ({ ...f, specialty: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input value={coachForm.email} onChange={(e) => setCoachForm((f) => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoachEdit(undefined)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" disabled={busy || !coachForm.name.trim()} onClick={() => void saveCoach()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
