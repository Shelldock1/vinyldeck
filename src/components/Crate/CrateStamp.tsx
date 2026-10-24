// src/components/Crate/CrateStamp.tsx
// Bottom-left pressing stamp for the record on the deck, mirroring the
// source badge. Celebrates a first pressing, then settles into a quiet
// "No. 007 · Midnight Galaxy · 12 plays" line. Click opens the crate.

import { useEffect, useState } from "react";
import { useCrateStore } from "../../lib/collection";
import { formatPressingNumber, rarityFor } from "../../lib/collection/records";
import type { CollectedRecord } from "../../lib/collection/types";
import { useT } from "../../lib/i18n";

const NEW_PRESSING_MS = 5200;

interface CrateStampProps {
  record: CollectedRecord | null;
  onOpenCrate: () => void;
}

export function CrateStamp({ record, onOpenCrate }: CrateStampProps) {
  const t = useT();
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
  const plays = t.stamp.plays(record.playCount);
  const number = formatPressingNumber(record.pressingNumber, t.common.numberPrefix);

  return (
    <button
      type="button"
      className={`crate-stamp${celebrating ? " crate-stamp--new" : ""}`}
      data-rarity={rarity}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onOpenCrate}
      aria-label={`${number}, ${record.pressingName ?? t.stamp.pressing}. ${t.stamp.openCrate}`}
    >
      <span className="crate-stamp__dot" aria-hidden="true" />
      {celebrating ? (
        <span className="crate-stamp__text">
          <strong>{t.stamp.newPressing}</strong> · {record.pressingName ?? number}
        </span>
      ) : (
        <span className="crate-stamp__text">
          {number}
          {record.pressingName ? ` · ${record.pressingName}` : ""} · {plays}
        </span>
      )}
    </button>
  );
}
