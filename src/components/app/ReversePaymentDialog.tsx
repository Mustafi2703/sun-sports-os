import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReversePaymentDialog({
  open,
  title,
  summary,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  summary: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);

  const submit = async () => {
    const next = reason.trim();
    if (next.length < 3) {
      setError("Enter a reason of at least 3 characters.");
      return;
    }
    setError("");
    try {
      await onConfirm(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reverse this receipt");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{summary}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reverse-reason">Reason</Label>
          <Textarea
            id="reverse-reason"
            value={reason}
            maxLength={500}
            placeholder="Why this was marked received"
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The original receipt stays in the history as reversed. This month goes back to unpaid.
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void submit()}>
            {busy ? "Reversing..." : "Reverse receipt"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
