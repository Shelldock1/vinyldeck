// src/components/Crate/CrateStamp.tsx
// Bottom-left pressing stamp for the record on the deck, mirroring the
// source badge. Celebrates a first pressing, then settles into a quiet
// "No. 007 · Midnight Galaxy · 12 plays" line. Click opens the crate.

import { useEffect, useState } from "react";
import { useCrateStore } from "../../lib/collection";
import { formatPressingNumber, rarityFor } from "../../lib/collection/records";
import type { CollectedRecord } from "../../lib/collection/types";

const NEW_PRESSING_MS = 5200;

interface CrateStampProps {
  record: CollectedRecord | null;
  onOpenCrate: () => void;
}

export function CrateStamp({ record, onOpenCrate }: CrateStampProps) {
  const lastNewPressing = useCrateStore((state) => state.lastNewPressing);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!record || !lastNewPressing || lastNewPressing.key !== record.key) {
      setCelebrating(false);
      return;
    }
    const remaining = NEW_PRESSING_MS - (Date.now() - lastNewPressing.at);
    if (remaining <= 0) return;
    setCelebrating(true);
    const id = setTimeout(() => setCelebrating(false), remaining);
    return () => clearTimeout(id);
  }, [record, lastNewPressing]);

  if (!record) return null;

  const rarity = rarityFor(record.recipe);
  const plays = record.playCount === 1 ? "1 play" : `${record.playCount} plays`;

  return (
    <button
      type="button"
      className={`crate-stamp${celebrating ? " crate-stamp--new" : ""}`}
      data-rarity={rarity}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onOpenCrate}
      aria-label={`${formatPressingNumber(record.pressingNumber)}, ${record.pressingName ?? "pressing"}. Open the crate`}
    >
      <span className="crate-stamp__dot" aria-hidden="true" />
      {celebrating ? (
        <span className="crate-stamp__text">
          <strong>New pressing</strong> · {record.pressingName ?? formatPressingNumber(record.pressingNumber)}
        </span>
      ) : (
        <span className="crate-stamp__text">
          {formatPressingNumber(record.pressingNumber)}
          {record.pressingName ? ` · ${record.pressingName}` : ""} · {plays}
        </span>
      )}
    </button>
  );
}
