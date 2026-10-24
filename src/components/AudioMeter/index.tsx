// Slim segmented VU meter. The fill width and the segment mask are driven by
// the `--audio-level` custom property from useAudioReactivity, so this renders
// once and never updates React state.

import { useT } from "../../lib/i18n";
import "./AudioMeter.css";

export function AudioMeter() {
  const t = useT();
  return (
    <div className="audio-meter" aria-hidden="true" title={t.badge.audioLevel}>
      <div className="audio-meter__fill" />
    </div>
  );
}
