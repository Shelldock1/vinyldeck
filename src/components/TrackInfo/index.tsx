// src/components/TrackInfo/index.tsx
// Title + artist + album block.
// Phase 5:
//   - All styling via TrackInfo.css (--font-display/body/mono vars)
//   - AnimatePresence: next enters LEFT/exits RIGHT; previous enters RIGHT/exits LEFT
//   - Empty state: "— / —" placeholder in mono
//   - Title hover: text-shadow bloom via CSS :hover
//   - Single-line ellipsis on all text rows

import { AnimatePresence, motion } from "motion/react";
import type { TrackChangeDirection } from "../../lib/trackTransition/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";
import "./TrackInfo.css";

interface TrackInfoProps {
  track: string;
  artist: string;
  album?: string;
  direction?: TrackChangeDirection;
  showTooltip?: boolean;
}

const slideTransition = {
  duration: 0.30,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

function enterX(direction: TrackChangeDirection): number {
  if (direction === "next") return -24;
  if (direction === "previous") return 24;
  return 0;
}

function exitX(direction: TrackChangeDirection): number {
  if (direction === "next") return 24;
  if (direction === "previous") return -24;
  return 0;
}

export function TrackInfo({
  track,
  artist,
  album,
  direction = "unknown",
  showTooltip = true,
}: TrackInfoProps) {
  const trackKey = `${track}::${artist}`;
  const isEmpty = !track || track === "Nothing Playing";
  const slideVariants = {
    enter: {
      x: enterX(direction),
      opacity: 0,
    },
    center: {
      x: 0,
      opacity: 1,
    },
    exit: {
      x: exitX(direction),
      opacity: 0,
    },
  };

  const content = (
    <>
      {/* Phase 5.1: --font-display, hover bloom via CSS */}
      <h2 className="track-info__title">{track}</h2>

      {/* Phase 5.1: --font-body, uppercase tracking */}
      {artist && <p className="track-info__artist">{artist}</p>}

      {/* Phase 5.1: --font-mono, muted stamp */}
      {album && <p className="track-info__album">{album}</p>}
    </>
  );

  return (
    <div className="track-info">
      <AnimatePresence mode="wait" initial={false}>
        {isEmpty ? (
          // Phase 5.2: Empty state placeholder
          <motion.p
            key="empty"
            className="track-info__empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            — / —
          </motion.p>
        ) : (
          // Phase 5.3: Slide transition on track change
          <motion.div
            key={trackKey}
            className="track-info__motion"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
          >
            {showTooltip ? (
              <Tooltip>
                <TooltipTrigger className="track-info__tooltip-trigger">
                  {content}
                </TooltipTrigger>
                <TooltipContent>{track}</TooltipContent>
              </Tooltip>
            ) : (
              <div className="track-info__tooltip-trigger">{content}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
