// src/components/SourceBadge/index.tsx
// Small pill badge showing music source name.
// Bottom-right corner. Fades in on source change.

import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../lib/i18n";

interface SourceBadgeProps {
  sourceName: string;
}

export function SourceBadge({ sourceName }: SourceBadgeProps) {
  const t = useT();
  if (!sourceName) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={sourceName}
        className="source-badge"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 0.55, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ opacity: 0.9 }}
        aria-label={t.badge.nowPlayingFrom(sourceName)}
      >
        <span className="source-badge__dot" />
        <span className="source-badge__label">{sourceName}</span>
      </motion.div>
    </AnimatePresence>
  );
}
