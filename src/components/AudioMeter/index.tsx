// Slim segmented VU meter. The fill width and the segment mask are driven by
// the `--audio-level` custom property from useAudioReactivity, so this renders
// once and never updates React state.

import "./AudioMeter.css";

export function AudioMeter() {
  return (
    <div className="audio-meter" aria-hidden="true" title="Live audio level">
      <div className="audio-meter__fill" />
    </div>
  );
}
