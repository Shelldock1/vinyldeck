import type { HTMLAttributes, ReactNode } from "react";
import "./Kbd.css";

interface KbdProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Kbd({ children, className = "", ...props }: KbdProps) {
  return (
    <kbd className={`kbd ${className}`.trim()} {...props}>
      {children}
    </kbd>
  );
}
export function KbdGroup({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`kbd-group ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
