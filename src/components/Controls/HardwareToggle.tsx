import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";

interface HardwareToggleProps {
  label: string;
  checked: boolean;
  tooltip: string;
  showTooltip?: boolean;
  /** Tiny engraved badge, used for repeat-one. */
  badge?: string;
  glyph: "shuffle" | "repeat";
  onToggle: () => void;
}

function ShuffleGlyph() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M1.5 3.2h1.6c1 0 1.7.45 2.4 1.3l1.8 2.2c.7.85 1.4 1.3 2.4 1.3h1.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M1.5 8.7h1.6c1 0 1.7-.45 2.4-1.3l1.8-2.2c.7-.85 1.4-1.3 2.4-1.3h1.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M9.5 2.1 11 3.2 9.5 4.3M9.5 7.6 11 8.7 9.5 9.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RepeatGlyph() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3.1 4.3A4 4 0 0 1 10 6M8.9 7.7A4 4 0 0 1 2 6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M3.1 1.9v2.4h2.4M8.9 10.1V7.7H6.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HardwareToggle({
  label,
  checked,
  tooltip,
  showTooltip = true,
  badge,
  glyph,
  onToggle,
}: HardwareToggleProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={tooltip}
      className={`hardware-toggle${checked ? " hardware-toggle--on" : ""}${
        badge ? " hardware-toggle--badged" : ""
      }`}
      onClick={onToggle}
    >
      <span className="hardware-toggle__track" aria-hidden="true" />
      <span className="hardware-toggle__lever" aria-hidden="true">
        <span className="hardware-toggle__glyph">
          {glyph === "shuffle" ? <ShuffleGlyph /> : <RepeatGlyph />}
        </span>
      </span>
      {badge ? (
        <span className="hardware-toggle__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );

  if (!showTooltip) return control;

  return (
    <Tooltip>
      <TooltipTrigger>{control}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
