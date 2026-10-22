import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { RenderWindowMode, WindowMode } from "./types";

export async function getCurrentRenderWindowMode(): Promise<RenderWindowMode> {
  if (!isTauri()) return "main";
  return getCurrentWindow().label === "mini" ? "mini" : "main";
}

export async function setNativeWindowMode(mode: WindowMode): Promise<void> {
  if (!isTauri()) return;
  await invoke("cmd_set_window_mode", { mode });
}

export async function setNativeAlwaysOnTop(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("cmd_set_always_on_top", { enabled });
}
