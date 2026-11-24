import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReversePaymentDialog } from "@/components/app/ReversePaymentDialog";
import { inr, type FeePayment } from "@/lib/api";
import { cn } from "@/lib/utils";

function isReversed(payment: FeePayment) {
  return Boolean(payment.reversedAt);
}

export function PaymentHistoryList({
  payments,
  canReverse,
  onReverse,
}: {
  payments: FeePayment[];
  canReverse?: boolean;
  onReverse?: (paymentId: string, reason: string) => Promise<void>;
}) {
  const [target, setTarget] = useState<FeePayment | null>(null);
  const [busy, setBusy] = useState(false);

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4">
        No payments recorded yet.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        {payments.map((payment) => {
          const reversed = isReversed(payment);
          const when = payment.month || new Date(payment.paidAt).toLocaleDateString("en-IN");
          return (
            <div key={payment.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm", reversed && "line-through text-muted-foreground")}>{when}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm", reversed && "line-through text-muted-foreground")}>{inr(payment.amount)}</span>
                  {reversed ? (
                    <Badge variant="outline">Reversed</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30">{payment.method}</Badge>
                  )}
                  {canReverse && onReverse && !reversed ? (
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setTarget(payment)}>
                      Reverse
                    </Button>
                  ) : null}
                </div>
              </div>
              {reversed ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Reversed {payment.reversedAt ? new Date(payment.reversedAt).toLocaleString("en-IN") : ""}
                  {payment.reversedByName ? ` by ${payment.reversedByName}` : ""}
                  {payment.reversalReason ? `. ${payment.reversalReason}` : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <ReversePaymentDialog
        open={!!target}
        title="Reverse this receipt?"
        summary={
          target
            ? `${target.month || "This receipt"} for ${inr(target.amount)} via ${target.method} will stop counting as paid.`
            : ""
        }
        busy={busy}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        onConfirm={async (reason) => {
          if (!target || !onReverse) return;
          setBusy(true);
          try {
            await onReverse(target.id, reason);
            setTarget(null);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
