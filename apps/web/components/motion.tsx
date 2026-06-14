// Entrance wrappers — CSS-driven so content is visible by default and never
// gated behind JS hydration. (Framer Motion is still used for interactive
// pieces: the edge gauge, distribution bars, cost flash, masthead.)
import type { ReactNode, CSSProperties } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

export function FadeUp({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const style: CSSProperties | undefined = delay ? { animationDelay: `${delay}s` } : undefined;
  return (
    <div className={`reveal ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Stagger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
  /** accepted for call-site compatibility; CSS handles the cadence */
  delay?: number;
  gap?: number;
}) {
  return <div className={`reveal-group ${className}`}>{children}</div>;
}

export function Item({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export { EASE };
