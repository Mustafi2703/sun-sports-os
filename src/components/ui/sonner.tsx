import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-left"
      richColors
      closeButton
      offset={{ top: "max(1rem, env(safe-area-inset-top))", left: "1rem" }}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-foreground !border !border-border !shadow-lg rounded-xl text-left",
          title: "!text-foreground font-medium text-left",
          description: "!text-muted-foreground text-left",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
          closeButton: "!bg-background !border-border !text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
