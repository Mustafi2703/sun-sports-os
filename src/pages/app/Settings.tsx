import { useEffect, useRef, useState } from "react";
import { Download, Upload, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademy } from "@/context/AcademyContext";
import { toast } from "sonner";
import type { Coach, Portal } from "@/lib/api";

type PortalUser = {
  id: string;
  phone: string;
  role: string;
  name: string;
  coachId?: string | null;
  parentPhone?: string | null;
  createdAt: string;
};

const Settings = () => {
  const { academyName, students, coaches, batches, api, refresh, error } = useAcademy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [coachEdit, setCoachEdit] = useState<Coach | null | undefined>(undefined);
  const [coachForm, setCoachForm] = useState({ name: "", phone: "", specialty: "", email: "" });
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", phone: "", role: "parent" as Portal, pin: "1234" });
  const [authInfo, setAuthInfo] = useState<{ smsConfigured: boolean; smsProvider: string; pin: boolean } | null>(null);

  const loadUsers = async () => {
    try {
      const rows = await api.listUsers();
      setUsers(rows as PortalUser[]);
    } catch {
      /* ignore if offline */
    }
  };

  useEffect(() => {
    void loadUsers();
    void api
      .authMethods()
      .then((m) => setAuthInfo({ smsConfigured: m.smsConfigured, smsProvider: m.smsProvider, pin: m.pin }))
      .catch(() => undefined);
  }, [api]);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await api.importExcel(file, "upsert");
      toast.success(`Imported — ${result.students} students, ${result.coaches} coaches`);
      await refresh();
      await loadUsers();
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
      toast.success(coachEdit ? "Coach updated" : "Coach added — portal login created");
      setCoachEdit(undefined);
      await refresh();
      await loadUsers();
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
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const saveUser = async () => {
    const phone = userForm.phone.replace(/\D/g, "").slice(-10);
    if (phone.length < 10 || !userForm.name.trim()) {
      toast.error("Name and 10-digit phone required");
      return;
    }
    setBusy(true);
    try {
      await api.createUser({
        phone,
        role: userForm.role,
        name: userForm.name.trim(),
        pin: userForm.pin || undefined,
      });
      toast.success("Portal user created");
      setUserOpen(false);
      setUserForm({ name: "", phone: "", role: "parent", pin: "1234" });
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u: PortalUser) => {
    if (!confirm(`Remove ${u.role} login for ${u.phone}?`)) return;
    try {
      await api.deleteUser(u.id);
      toast.success("User removed");
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Academy profile, portal users, coaches, and data import." />
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
            Parents, coaches, and team each sign in with phone OTP (PIN backup available).
          </p>
          <ul className="text-sm space-y-2">
            <li>
              <a className="text-primary underline" href="/parent/login" target="_blank" rel="noreferrer">Parent portal</a>
              <span className="text-muted-foreground"> — parent WhatsApp on student profile</span>
            </li>
            <li>
              <a className="text-primary underline" href="/coach/login" target="_blank" rel="noreferrer">Coach portal</a>
              <span className="text-muted-foreground"> — coach phone in Settings</span>
            </li>
            <li>
              <a className="text-primary underline" href="/app/login" target="_blank" rel="noreferrer">Internal team</a>
              <span className="text-muted-foreground"> — admin phone</span>
            </li>
          </ul>
          {authInfo && (
            <p className="text-xs text-muted-foreground mt-3">
              SMS: {authInfo.smsConfigured ? `live via ${authInfo.smsProvider}` : "not configured (OTP shown on login for testing)"}
              {authInfo.pin ? " · PIN backup on" : " · PIN off"}
            </p>
          )}
        </Card>

        <Card title="Portal users">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setUserOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add user
            </Button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground">No users loaded yet.</p>
            )}
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{u.role} · {u.phone}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => void removeUser(u)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
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
            Tournament share opens WhatsApp with a prefilled summary. Bulk fee alerts need Meta Business credentials later.
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
            <div className="space-y-1.5"><Label className="text-xs">Phone (portal login)</Label><Input value={coachForm.phone} onChange={(e) => setCoachForm((f) => ({ ...f, phone: e.target.value }))} /></div>
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

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add portal user</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={userForm.phone} onChange={(e) => setUserForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Portal</Label>
              <Select value={userForm.role} onValueChange={(v) => setUserForm((f) => ({ ...f, role: v as Portal }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                  <SelectItem value="admin">Team (admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Backup PIN</Label><Input value={userForm.pin} onChange={(e) => setUserForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void saveUser()}>
              {busy ? "Saving…" : "Create"}
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
