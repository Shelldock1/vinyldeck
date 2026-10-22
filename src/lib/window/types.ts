export const WINDOW_MODES = ["main", "fullscreen", "mini"] as const;
export type WindowMode = (typeof WINDOW_MODES)[number];

export type RenderWindowMode = "main" | "mini";
