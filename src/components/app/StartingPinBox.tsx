import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function makePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function StartingPinBox({
  description,
  onSave,
}: {
  description: string;
  onSave: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const next = pin.replace(/\D/g, "");
    if (!/^\d{4,6}$/.test(next)) {
      setError("PIN must be 4 to 6 digits");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(next);
      setPin("");
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Could not save the starting PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border px-3 py-3 space-y-2">
      <p className="text-[11px] text-muted-foreground">Set starting PIN</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      <p className="text-xs text-muted-foreground">Write the PIN down before you save. It is not shown again.</p>
      <div className="flex gap-2">
        <Input
          className="h-10 font-mono tracking-widest"
          inputMode="numeric"
          autoComplete="off"
          placeholder="4 to 6 digits"
          maxLength={6}
          value={pin}
          onChange={(event) => {
            setSaved(false);
            setPin(event.target.value.replace(/\D/g, ""));
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0"
          onClick={() => {
            setSaved(false);
            setError("");
            setPin(makePin());
          }}
        >
          Generate
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {saved && <p className="text-xs text-muted-foreground">Starting PIN saved. The parent must choose a new PIN after signing in.</p>}
      <Button type="button" className="w-full h-10 bg-primary text-primary-foreground" disabled={busy || !pin} onClick={() => void save()}>
        {busy ? "Saving…" : "Save starting PIN"}
      </Button>
    </div>
  );
}
