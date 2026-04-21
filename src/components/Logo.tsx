import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo = ({ className, showText = true }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {/* Cricket bat */}
          <path d="M14.5 3.5l6 6-9 9-3-3 9-9z" />
          <path d="M8.5 12.5l-4 4a2 2 0 102.83 2.83l4-4" />
          <circle cx="5" cy="19" r="0.5" />
        </svg>
      </div>
      {showText && (
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          Sports<span className="text-primary">OS</span>
        </span>
      )}
    </div>
  );
};