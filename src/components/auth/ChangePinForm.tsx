import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { api, type AuthUser } from "@/lib/api";
import { KeyRound } from "lucide-react";

export function ChangePinForm({
  forced,
  onSuccess,
}: {
  forced?: boolean;
  onSuccess: (user: AuthUser) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{4,8}$/.test(next)) {
      setError("PIN must be 4 to 8 digits");
      return;
    }
    if (next !== confirm) {
      setError("The two PINs do not match");
      return;
    }
    if (!forced && !/^\d{4,8}$/.test(current)) {
      setError("Enter your current PIN");
      return;
    }
    setBusy(true);
    try {
      const res = await api.changePin({
        newPin: next,
        ...(forced ? {} : { currentPin: current }),
      });
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3.5">
      {!forced && (
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Current PIN</label>
          <Input
            className="h-12 text-base"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={8}
            value={current}
            onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">New PIN</label>
        <Input
          className="h-12 text-base"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder="4–8 digits"
          maxLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))}
          required
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Confirm new PIN</label>
        <Input
          className="h-12 text-base"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground" disabled={busy}>
        {busy ? "Saving…" : "Save new PIN"}
      </Button>
    </form>
  );
}

export function ChangePinButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { markPinChanged } = useAuth();
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5 mr-2" /> Change PIN
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change PIN</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Enter your current PIN, then choose a new one.</p>
          <ChangePinForm
            onSuccess={(user) => {
              markPinChanged(user);
              setOpen(false);
              toast.success("PIN updated");
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ForceChangePin() {
  const { user, markPinChanged, logout } = useAuth();
  return (
    <div className="app-shell min-h-dvh flex items-center justify-center p-4 safe-pt safe-pb safe-px">
      <div className="w-full max-w-md surface-elevated rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-bold">Choose your PIN</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {user?.name ? `${user.name}, set` : "Set"} a PIN only you know. You’ll use it the next time you sign in.
          </p>
        </div>
        <ChangePinForm forced onSuccess={markPinChanged} />
        <Button type="button" variant="ghost" className="w-full" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
