import type { PlaybackState } from "./types";

export function canUseTransportControls(playback: PlaybackState): boolean {
  return playback.canControl;
}

export function canUseSkipControls(playback: PlaybackState): boolean {
  return playback.canControl && playback.canSkip;
}

export function canUseSeekControl(playback: PlaybackState): boolean {
  return playback.canSeek && playback.duration > 0;
}
