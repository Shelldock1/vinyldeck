import {
  createContext,
  useEffect,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from "react";
import "./Tooltip.css";

type TooltipSide = "top" | "bottom";

interface TooltipContextValue {
  id: string;
  open: boolean;
  side: TooltipSide;
  triggerRef: RefObject<HTMLSpanElement | null>;
  show: () => void;
  hide: () => void;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

interface TooltipProps {
  children: ReactNode;
  side?: TooltipSide;
  maxVisibleMs?: number;
}

export function Tooltip({ children, side = "top", maxVisibleMs }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !maxVisibleMs) return;
    const timeoutId = window.setTimeout(() => setOpen(false), maxVisibleMs);
    return () => window.clearTimeout(timeoutId);
  }, [maxVisibleMs, open]);

  return (
    <TooltipContext.Provider
      value={{
        id,
        open,
        side,
        triggerRef,
        show: () => setOpen(true),
        hide: () => setOpen(false),
      }}
    >
      {children}
    </TooltipContext.Provider>
  );
}

interface TooltipTriggerProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function TooltipTrigger({
  children,
  className = "",
  onKeyDown,
  ...props
}: TooltipTriggerProps) {
  const context = useTooltipContext();

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Escape") context.hide();
    onKeyDown?.(event);
  }

  return (
    <span
      ref={context.triggerRef}
      className={`tooltip-trigger ${className}`.trim()}
      aria-describedby={context.open ? context.id : undefined}
      onMouseEnter={context.show}
      onMouseLeave={context.hide}
      onFocus={context.show}
      onBlur={context.hide}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </span>
  );
}

interface TooltipContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function TooltipContent({
  children,
  className = "",
  ...props
}: TooltipContentProps) {
  const context = useTooltipContext();
  const style = getTooltipStyle(context.triggerRef, context.side);

  if (!context.open) return null;

  const tooltip = (
    <div
      id={context.id}
      role="tooltip"
      className={`tooltip-content tooltip-content--${context.side} ${className}`.trim()}
      style={style}
      {...props}
    >
      {children}
    </div>
  );

  return createPortal(tooltip, document.body);
}

function getTooltipStyle(
  ref: RefObject<HTMLSpanElement | null>,
  side: TooltipSide,
) {
  const rect = getTriggerRect(ref.current);
  if (!rect) return undefined;
  const top = side === "top" ? rect.top - 10 : rect.bottom + 10;
  const left = rect.left + rect.width / 2;

  return {
    "--tooltip-x": `${Math.min(Math.max(left, 72), window.innerWidth - 72)}px`,
    "--tooltip-y": `${Math.min(Math.max(top, 24), window.innerHeight - 24)}px`,
  } as CSSProperties;
}

function getTriggerRect(trigger: HTMLSpanElement | null) {
  if (!trigger) return null;

  const child = trigger.firstElementChild;
  if (child instanceof HTMLElement || child instanceof SVGElement) {
    const childRect = child.getBoundingClientRect();
    if (childRect.width > 0 && childRect.height > 0) return childRect;
  }

  return trigger.getBoundingClientRect();
}

function useTooltipContext() {
  const context = useContext(TooltipContext);
  if (!context) throw new Error("Tooltip components must be used inside Tooltip");
  return context;
}
