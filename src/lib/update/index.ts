// Manual update check adapter.
//
// There is no auto-updater yet (release signing keys are not part of the
// pipeline), so the About tab asks Rust for the newest GitHub release and can
// open its page in the system browser. Browser development has no backend;
// checks report that they are desktop-only instead of pretending to work.
import { invoke, isTauri } from "@tauri-apps/api/core";

export const UPDATE_CHECK_COMMAND = "cmd_update_check";
export const OPEN_RELEASE_COMMAND = "cmd_open_release";
export const RELEASE_URL_PREFIX = "https://github.com/Shelldock1/vinyldeck/releases";

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  publishedAt: string | null;
}

/** Raised when a check is requested outside the desktop shell. */
export class UpdateCheckUnavailableError extends Error {
  constructor() {
    super("Update checks are only available in the desktop app.");
    this.name = "UpdateCheckUnavailableError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate the Rust payload before it reaches React state. */
export function normalizeUpdateStatus(value: unknown): UpdateStatus {
  if (!isRecord(value)) {
    throw new Error("update status was not an object");
  }

  const { currentVersion, latestVersion, updateAvailable, releaseUrl, publishedAt } = value;
  if (typeof currentVersion !== "string" || typeof latestVersion !== "string") {
    throw new Error("update status is missing version information");
  }
  if (typeof updateAvailable !== "boolean") {
    throw new Error("update status is missing the availability flag");
  }
  if (typeof releaseUrl !== "string" || !releaseUrl.startsWith(RELEASE_URL_PREFIX)) {
    throw new Error("update status has an unexpected release URL");
  }
  if (publishedAt !== null && typeof publishedAt !== "string") {
    throw new Error("update status has an invalid publish date");
  }

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    releaseUrl,
    publishedAt,
  };
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  if (!isTauri()) {
    throw new UpdateCheckUnavailableError();
  }
  const raw = await invoke<unknown>(UPDATE_CHECK_COMMAND);
  return normalizeUpdateStatus(raw);
}

export async function openReleasePage(url: string): Promise<void> {
  if (!url.startsWith(RELEASE_URL_PREFIX)) {
    throw new Error("refusing to open a URL outside the VinylDeck releases");
  }
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await invoke(OPEN_RELEASE_COMMAND, { url });
}
