import { invoke, isTauri } from "@tauri-apps/api/core";

export async function quitApplication(): Promise<void> {
  if (!isTauri()) return;
  await invoke("cmd_quit");
}
