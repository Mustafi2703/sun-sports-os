import { ReactNode, ElementType } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "scale";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  direction?: Direction;
  delay?: number; // ms
  className?: string;
  threshold?: number;
}

export const Reveal = ({
  children,
  as: Tag = "div",
  direction = "up",
  delay = 0,
  className,
  threshold = 0.15,
}: RevealProps) => {
  const { ref, visible } = useReveal<HTMLElement>({ threshold });
  return (
    <Tag
      ref={ref as never}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn("reveal", `reveal-${direction}`, visible && "is-visible", className)}
    >
      {children}
    </Tag>
  );
};