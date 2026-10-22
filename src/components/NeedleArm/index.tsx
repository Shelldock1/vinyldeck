// src/components/NeedleArm/index.tsx
// Spring-physics tonearm via motion/react.
// Pivots from hinge at top-right.
// isPlaying=true  → 10° (on record).
// isPlaying=false → 25° (lifted).
//
// Phase 3:
//   - LED uses CSS class --dim vs default (theme-colored via --ui-accent)
//   - Needle-bump class applied when arm settles on record (onAnimationComplete)
//   - trackKey prop: changes trigger lift → wait → drop sequence for skip

import { motion, useAnimation } from "motion/react";
import { useEffect, useRef, useState } from "react";
import "./NeedleArm.css";

const NEEDLE_ANGLE_LIFTED = 15; // degrees: resting, off record
const NEEDLE_ANGLE_DOWN = 4; // degrees: playing, on record
const LIFT_BEFORE_SKIP_DEG = 30; // degrees: temporary lift on track skip

interface NeedleArmProps {
  isPlaying: boolean;
  trackKey?: string; // pass track title or ID — changes trigger lift/re-drop
}

export function NeedleArm({ isPlaying, trackKey }: NeedleArmProps) {
  const controls = useAnimation();
  const prevTrackKey = useRef(trackKey);
  const [showBump, setShowBump] = useState(false);
  const [isLifted, setIsLifted] = useState(!isPlaying);

  // Phase 3.2: On track skip — lift arm briefly, then re-drop
  // This simulates the tonearm physically lifting and re-cueing
  useEffect(() => {
    if (trackKey === prevTrackKey.current) return;
    prevTrackKey.current = trackKey;

    // Only do the skip animation if we're playing (arm is down)
    if (!isPlaying) return;

    const doSkipAnimation = async () => {
      setIsLifted(true);
      // Lift fast (like a real cue mechanism)
      await controls.start({
        rotate: LIFT_BEFORE_SKIP_DEG,
        transition: { type: "spring", stiffness: 80, damping: 15, mass: 0.8 },
      });

      // Brief pause at lifted position
      await new Promise((r) => setTimeout(r, 280));

      // Drop back to playing position
      setIsLifted(false);
      await controls.start({
        rotate: NEEDLE_ANGLE_DOWN,
        transition: { type: "spring", stiffness: 60, damping: 18, mass: 1.2 },
      });

      // Phase 3.2: Trigger needle bump — arm hits groove
      setShowBump(true);
      setTimeout(() => setShowBump(false), 140);
    };

    doSkipAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey]);

  // Normal play/pause toggling
  useEffect(() => {
    const targetAngle = isPlaying ? NEEDLE_ANGLE_DOWN : NEEDLE_ANGLE_LIFTED;
    setIsLifted(!isPlaying);

    controls
      .start({
        rotate: targetAngle,
        transition: { type: "spring", stiffness: 60, damping: 18, mass: 1.2 },
      })
      .then(() => {
        // Phase 3.2: Needle bump only on arm drop (not on lift)
        if (isPlaying) {
          setShowBump(true);
          setTimeout(() => setShowBump(false), 140);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return (
    <div className="needle-arm-container">
      <motion.div
        className="needle-arm"
        animate={controls}
        initial={{ rotate: NEEDLE_ANGLE_LIFTED }}
      >
        {/* Pivot stack + counterweight */}
        <div className="needle-arm__pivot-stack" aria-hidden="true">
          <div className="needle-arm__counterweight" />
          <div className="needle-arm__base-ring" />
          <div className="needle-arm__hinge" />
        </div>

        {/* Arm wand */}
        <div className="needle-arm__body" />
        <div className="needle-arm__bend" />

        {/* Headshell + cartridge */}
        <div
          className={`needle-arm__head${showBump ? " needle-arm__head--bump" : ""}`}
        >
          <div className="needle-arm__headshell-plate" />
          <div className="needle-arm__cartridge">
            <span className="needle-arm__stylus" aria-hidden="true" />
          </div>
          <div className="needle-arm__screws" aria-hidden="true">
            <span />
            <span />
          </div>
          {/* Phase 3.1: LED — theme-colored via --ui-accent, dimmed when lifted */}
          <div
            className={`needle-arm__led${isLifted ? " needle-arm__led--dim" : ""}`}
          />
        </div>
      </motion.div>
    </div>
  );
}
