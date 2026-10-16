import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  /** mark = icon crop + wordmark. full = the academy logo artwork. */
  variant?: "mark" | "full";
}

export const Logo = ({ className, showText = true, variant = "mark" }: LogoProps) => {
  if (variant === "full") {
    return (
      <img
        src="/logo.jpg"
        alt="Sun Sports High-Performance Cricket Academy"
        className={cn("h-28 w-28 rounded-2xl object-cover bg-black shadow-glow", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <img
        src="/logo.jpg"
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg object-cover object-top bg-black"
      />
      {showText && (
        <span className="font-display text-lg font-bold tracking-tight text-foreground truncate">
          Sun<span className="text-primary">Sports</span>
          <span className="ml-1.5 text-xs font-semibold text-muted-foreground tracking-wide">OS</span>
        </span>
      )}
    </div>
  );
};
