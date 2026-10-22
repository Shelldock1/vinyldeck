// src/components/Crate/CrateDisc.tsx
// Lightweight collection-shelf vinyl. The live deck's VinylRecord reads its
// pressing from global CSS vars on <html>; the crate shows many records at
// once, so each disc is drawn from its stored recipe + three colors instead.

import type { CSSProperties } from "react";
import { hashAngle } from "../../hooks/useCrate";
import { wearFor } from "../../lib/collection/records";
import type { CollectedRecord } from "../../lib/collection/types";

const BLANK_COLORS = { primary: "#141414", secondary: "#2a2a2a", accent: "#8c1c2c" };

interface CrateDiscProps {
  record: CollectedRecord;
  className?: string;
}

export function CrateDisc({ record, className }: CrateDiscProps) {
  const colors = record.colors ?? BLANK_COLORS;
  const wear = wearFor(record.playCount);
  const style = {
    "--crate-c1": colors.primary,
    "--crate-c2": colors.secondary,
    "--crate-c3": colors.accent,
    "--crate-angle": `${hashAngle(record.key)}deg`,
    "--vinyl-wear": wear.toFixed(3),
    "--vinyl-wear-angle": `${hashAngle(record.key)}deg`,
  } as CSSProperties;

  return (
    <div
      className={`crate-disc${className ? ` ${className}` : ""}`}
      data-recipe={record.recipe ?? "blank"}
      style={style}
      aria-hidden="true"
    >
      <div className="crate-disc__wax" />
      <div className="crate-disc__grooves" />
      {wear > 0.02 && <div className="vinyl-wear" />}
      <div className="crate-disc__label">
        {record.thumbnail ? (
          <img src={record.thumbnail} alt="" draggable={false} />
        ) : (
          <span>{(record.album || "?").charAt(0).toUpperCase()}</span>
        )}
      </div>
      {wear > 0.02 && <div className="vinyl-wear-label" />}
      <div className="crate-disc__gloss" />
    </div>
  );
}
