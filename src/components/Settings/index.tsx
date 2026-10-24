import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ART_AMBIENT_MODE,
  THEME_IDS,
  THEME_LABELS,
  applyVisualMode,
  resetAmbientColors,
} from "../../lib/themes/applier";
import type { ThemeId } from "../../lib/themes/applier";
import { selectSettings, useVinylDeckStore } from "../../lib/playback/store";
import { commitSettings, normalizeDiscordClientId } from "../../lib/settings";
import { listMediaPlayers } from "../../lib/media/players";
import type { MediaPlayer } from "../../lib/media/players";
import {
  SLEEP_MINUTE_OPTIONS,
  cancelSleepTimer,
  formatSleepTimerStatus,
  getSleepTimer,
  startSleepTimer,
  subscribeToSleepTimer,
} from "../../lib/sleep";
import type { SleepTimerMode, SleepTimerSnapshot } from "../../lib/sleep";
import { setNativeAlwaysOnTop, setNativeWindowMode } from "../../lib/window";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import type { WindowMode } from "../../lib/window/types";
import "./Settings.css";
import { logger } from "../../lib/logger";
import { LANGUAGE_SETTINGS, localeFor, useLanguage, useT } from "../../lib/i18n";
import { setLanguage } from "../../lib/i18n/switch";
import {
  UpdateCheckUnavailableError,
  checkForUpdate,
  openReleasePage,
} from "../../lib/update";
import type { UpdateStatus } from "../../lib/update";
import { version as APP_VERSION } from "../../../package.json";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const SETTINGS_TABS = ["LOOK", "VINYL", "DISPLAY", "SOURCE", "OTHER", "ABOUT"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const SHELL_CARD_META: Record<ThemeId, { bg: string; accent: string }> = {
  noir: { bg: "#000000", accent: "#f1efea" },
  glass: { bg: "#f5f2ea", accent: "#0070d9" },
};

type UpdateCheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current"; status: UpdateStatus }
  | { kind: "available"; status: UpdateStatus }
  | { kind: "error"; browserOnly: boolean };

export function Settings({ open, onClose, initialTab = "LOOK" }: SettingsProps) {
  const t = useT();
  const language = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [players, setPlayers] = useState<MediaPlayer[]>([]);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerSnapshot | null>(null);
  const [sleepNow, setSleepNow] = useState(() => Date.now());
  const [sleepError, setSleepError] = useState<string | null>(null);
  const [discordIdDraft, setDiscordIdDraft] = useState("");
  const [discordIdSaved, setDiscordIdSaved] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateCheckState>({ kind: "idle" });
  const [updateOpenFailed, setUpdateOpenFailed] = useState(false);
  const settings = useVinylDeckStore(selectSettings);
  const currentTheme = useVinylDeckStore((s) => s.theme);
  const ambientMode = useVinylDeckStore((s) => s.ambientMode);
  const hydrateSettings = useVinylDeckStore((s) => s.hydrateSettings);
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const setDevForceEmpty = useVinylDeckStore((s) => s.setDevForceEmpty);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Escape is owned by useKeyboardShortcuts (topmost surface wins).
  useFocusTrap(overlayRef, open);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    setDiscordIdDraft(settings.discordClientId);
  }, [settings.discordClientId]);

  // Refresh the session list on open and while Settings stays open.
  useEffect(() => {
    if (!open) return;

    let alive = true;
    const refresh = () => {
      void listMediaPlayers().then((next) => {
        if (alive) setPlayers(next);
      });
    };

    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open]);

  // Load the active sleep timer on open and follow backend changes.
  useEffect(() => {
    if (!open) return;

    let alive = true;
    let unlisten: (() => void) | undefined;
    setSleepNow(Date.now());
    setSleepError(null);

    void subscribeToSleepTimer((snapshot) => {
      if (!alive) return;
      setSleepTimer(snapshot);
      setSleepNow(Date.now());
    })
      .then((nextUnlisten) => {
        if (!alive) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        // Snapshot after subscribing so no change can slip between the two.
        void getSleepTimer().then((snapshot) => {
          if (alive) setSleepTimer(snapshot);
        });
      })
      .catch((error) => {
        logger.warn("[Settings] Sleep timer subscribe failed:", error);
      });

    return () => {
      alive = false;
      unlisten?.();
    };
  }, [open]);

  // Remaining minutes only need a coarse refresh; events carry real changes.
  useEffect(() => {
    if (!open || sleepTimer?.mode !== "minutes") return;

    const timer = window.setInterval(() => setSleepNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open, sleepTimer]);

  function applyCommittedSettings(nextSettings: typeof settings) {
    hydrateSettings(nextSettings);
    applyVisualMode(nextSettings.theme, nextSettings.ambientMode, nextSettings.scheme);
    if (nextSettings.ambientMode === "off") resetAmbientColors();
  }

  function updateBackendSettings(patch: Parameters<typeof commitSettings>[0]) {
    void commitSettings(patch)
      .then(applyCommittedSettings)
      .catch((error) => {
        logger.warn("[Settings] Update failed:", error);
      });
  }

  function commitDiscordId() {
    const next = normalizeDiscordClientId(discordIdDraft);
    setDiscordIdDraft(next);
    if (next === settings.discordClientId) return;
    updateBackendSettings({ discordClientId: next });
    setDiscordIdSaved(true);
    window.setTimeout(() => setDiscordIdSaved(false), 1600);
  }

  function handleThemeSelect(theme: ThemeId) {
    updateBackendSettings({ theme });
  }

  function handleArtAmbientToggle() {
    const nextMode = ambientMode === "off" ? ART_AMBIENT_MODE : "off";
    if (nextMode === "off") resetAmbientColors();
    updateBackendSettings({
      ambientMode: nextMode,
      artAmbient: nextMode !== "off",
    });
  }

  function handleWindowModeSelect(mode: WindowMode) {
    void commitSettings({ windowMode: mode })
      .then((nextSettings) => {
        applyCommittedSettings(nextSettings);
        return setNativeWindowMode(mode);
      })
      .catch((error) => {
        logger.warn("[Window] Mode change failed:", error);
      });
  }

  function handleAlwaysOnTopToggle() {
    const next = !settings.alwaysOnTop;
    void commitSettings({ alwaysOnTop: next })
      .then((nextSettings) => {
        applyCommittedSettings(nextSettings);
        return setNativeAlwaysOnTop(next);
      })
      .catch((error) => {
        logger.warn("[Window] Always-on-top change failed:", error);
      });
  }

  function handlePlayerSelect(player: MediaPlayer | null) {
    updateBackendSettings({
      playerSourceId: player?.id ?? "",
      playerSourceName: player?.name ?? "",
    });
  }

  function handleSleepStart(mode: SleepTimerMode, minutes?: number) {
    setSleepError(null);
    void startSleepTimer(mode, minutes)
      .then((snapshot) => {
        setSleepTimer(snapshot);
        setSleepNow(Date.now());
      })
      .catch((error) => {
        logger.warn("[Settings] Sleep timer failed:", error);
        setSleepError(
          error instanceof Error ? error.message : String(error),
        );
      });
  }

  function handleSleepCancel() {
    setSleepError(null);
    void cancelSleepTimer()
      .then(() => setSleepTimer(null))
      .catch((error) => {
        logger.warn("[Settings] Sleep timer cancel failed:", error);
        setSleepError(
          error instanceof Error ? error.message : String(error),
        );
      });
  }

  function handleCheckForUpdates() {
    setUpdateOpenFailed(false);
    setUpdateState({ kind: "checking" });
    void checkForUpdate()
      .then((status) => {
        setUpdateState(
          status.updateAvailable
            ? { kind: "available", status }
            : { kind: "current", status },
        );
      })
      .catch((error) => {
        const browserOnly = error instanceof UpdateCheckUnavailableError;
        if (!browserOnly) {
          logger.warn("[Settings] Update check failed:", error);
        }
        setUpdateState({ kind: "error", browserOnly });
      });
  }

  function handleOpenRelease(url: string) {
    setUpdateOpenFailed(false);
    void openReleasePage(url).catch((error) => {
      logger.warn("[Settings] Opening the release page failed:", error);
      setUpdateOpenFailed(true);
    });
  }

  const selectedPlayer = players.find(
    (player) => player.id === settings.playerSourceId,
  );
  const savedPlayerMissing =
    settings.playerSourceId.length > 0 && !selectedPlayer;

  const updateMessage =
    updateState.kind === "checking"
      ? t.settings.checkingForUpdates
      : updateState.kind === "available"
        ? t.settings.updateAvailable(updateState.status.latestVersion)
        : updateState.kind === "current"
          ? t.settings.updateCurrent
          : updateState.kind === "error"
            ? updateState.browserOnly
              ? t.settings.updateBrowserOnly
              : t.settings.updateError
            : t.settings.updateCopy;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="settings-overlay"
          aria-modal="true"
          role="dialog"
          aria-label={t.settings.dialog}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            className="settings-overlay__scrim"
            type="button"
            aria-label={t.settings.close}
            tabIndex={-1}
            onClick={onClose}
          />
          <SettingsParticles />

          <motion.section
            className={`settings-panel settings-panel--${activeTab.toLowerCase()}`}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              className="settings-panel__close"
              aria-label={t.settings.close}
              title={t.common.close}
              onClick={onClose}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="settings-panel__edge-light" aria-hidden="true" />
            <div className="settings-panel__sidebar">
              <p className="settings-panel__eyebrow">{t.settings.eyebrow}</p>
              <nav className="settings-nav" aria-label={t.settings.nav}>
                {SETTINGS_TABS.map((tab) => {
                  const active = tab === activeTab;

                  return (
                    <button
                      key={tab}
                      type="button"
                      className={`settings-nav__item${active ? " settings-nav__item--active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setActiveTab(tab)}
                    >
                      <span className="settings-nav__rail" aria-hidden="true" />
                      <span>{t.settings.tabs[tab].toUpperCase()}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="settings-panel__content">
              <p className="settings-panel__section-label">
                {t.settings.tabs[activeTab].toUpperCase()}
              </p>
              {activeTab === "LOOK" ? (
                <div className="settings-look">
                  <div className="settings-look__section">
                    <div className="settings-look__header">
                      <h3>{t.settings.shellTitle}</h3>
                      <p>{t.settings.shellCopy}</p>
                    </div>
                    <div
                      className="settings-theme-grid settings-shell-grid"
                      role="radiogroup"
                      aria-label={t.settings.shellGroup}
                    >
                      {THEME_IDS.map((theme) => {
                        const active = theme === currentTheme;
                        const meta = SHELL_CARD_META[theme];

                        return (
                          <button
                            key={theme}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={t.theme.shell(THEME_LABELS[theme])}
                            className={`settings-theme-card settings-shell-card settings-shell-card--${theme}${active ? " settings-theme-card--active" : ""}`}
                            onClick={() => handleThemeSelect(theme)}
                          >
                            <span
                              className="settings-theme-card__disc settings-shell-card__disc"
                              style={
                                {
                                  "--settings-card-bg": meta.bg,
                                  "--settings-card-accent": meta.accent,
                                } as CSSProperties
                              }
                              aria-hidden="true"
                            />
                            <span className="settings-theme-card__copy">
                              <span className="settings-theme-card__name">
                                {THEME_LABELS[theme]}
                              </span>
                              <span className="settings-theme-card__note">
                                {t.settings.shells[theme].note}
                              </span>
                              <span className="settings-card__material">
                                {t.settings.shells[theme].material}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="settings-look__section">
                    <div className="settings-look__header">
                      <h3>{t.settings.artAmbientTitle}</h3>
                      <p>{t.settings.artAmbientCopy}</p>
                    </div>
                    <div className="settings-toggle-list settings-toggle-list--compact">
                      <SettingsToggle
                        label={t.settings.artAmbientToggle}
                        description={t.settings.artAmbientDescription}
                        checked={ambientMode !== "off"}
                        onToggle={handleArtAmbientToggle}
                      />
                    </div>
                  </div>

                  <div className="settings-look__section">
                    <div className="settings-look__header">
                      <h3>{t.settings.languageTitle}</h3>
                      <p>{t.settings.languageCopy}</p>
                    </div>
                    <div
                      className="settings-sleep__options"
                      role="radiogroup"
                      aria-label={t.settings.languageGroup}
                    >
                      {LANGUAGE_SETTINGS.map((language) => {
                        const active = settings.language === language;
                        return (
                          <button
                            key={language}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            lang={language === "auto" ? undefined : language}
                            className={`settings-sleep__option${active ? " settings-sleep__option--active" : ""}`}
                            onClick={() => void setLanguage(language)}
                          >
                            {t.language.names[language]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : activeTab === "VINYL" ? (
                <div className="settings-toggle-list">
                  <SettingsToggle
                    label={t.settings.vinylWobble}
                    description={t.settings.vinylWobbleDescription}
                    checked={settings.vinylWobble}
                    onToggle={() =>
                      updateBackendSettings({
                        vinylWobble: !settings.vinylWobble,
                      })
                    }
                  />
                  <SettingsToggle
                    label={t.settings.filmGrain}
                    description={t.settings.filmGrainDescription}
                    checked={settings.filmGrain}
                    onToggle={() =>
                      updateBackendSettings({ filmGrain: !settings.filmGrain })
                    }
                  />
                </div>
              ) : activeTab === "DISPLAY" ? (
                <div className="settings-toggle-list settings-display">
                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          {t.settings.windowMode}
                        </span>
                        <span className="settings-toggle-row__description">
                          {t.settings.windowModeDescription}
                        </span>
                      </span>
                    </div>
                    <div
                      className="settings-window-mode-grid"
                      role="group"
                      aria-label={t.settings.windowMode}
                    >
                      {(["main", "fullscreen", "mini"] as const).map((mode) => {
                        const active =
                          mode !== "mini" && settings.windowMode === mode;

                        return (
                          <button
                            key={mode}
                            type="button"
                            className={`settings-theme-card settings-window-mode-card${active ? " settings-theme-card--active" : ""}`}
                            onClick={() => handleWindowModeSelect(mode)}
                          >
                            <span className="settings-theme-card__copy">
                              <span className="settings-theme-card__name">
                                {t.settings.windowModes[mode].name}
                              </span>
                              <span className="settings-theme-card__note">
                                {t.settings.windowModes[mode].note}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="settings-display__switch-grid">
                    <SettingsToggle
                      label={t.settings.alwaysOnTop}
                      description={t.settings.alwaysOnTopDescription}
                      checked={settings.alwaysOnTop}
                      onToggle={handleAlwaysOnTopToggle}
                    />
                    <SettingsToggle
                      label={t.settings.leanBack}
                      description={t.settings.leanBackDescription}
                      checked={settings.leanBackMode}
                      onToggle={() =>
                        updateBackendSettings({
                          leanBackMode: !settings.leanBackMode,
                        })
                      }
                    />
                    <SettingsToggle
                      label={t.settings.cursorHide}
                      description={t.settings.cursorHideDescription}
                      checked={settings.cursorHide}
                      onToggle={() =>
                        updateBackendSettings({
                          cursorHide: !settings.cursorHide,
                        })
                      }
                    />
                  </div>
                  <div className="settings-slider-row">
                    <div className="settings-slider-row__header">
                      <span className="settings-toggle-row__copy">
                        <span className="settings-toggle-row__label">
                          {t.settings.idleTimeout}
                        </span>
                        <span className="settings-toggle-row__description">
                          {t.settings.idleTimeoutDescription}
                        </span>
                      </span>
                      <span className="settings-slider-row__value">
                        {t.settings.seconds(settings.idleTimeoutSeconds)}
                      </span>
                    </div>
                    <input
                      className="settings-slider"
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={settings.idleTimeoutSeconds}
                      aria-label={t.settings.idleTimeout}
                      onChange={(event) =>
                        updateBackendSettings({
                          idleTimeoutSeconds: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <div
                      className="settings-slider-row__ticks"
                      aria-hidden="true"
                    >
                      <span>{t.settings.seconds(1)}</span>
                      <span>{t.settings.seconds(3)}</span>
                      <span>{t.settings.seconds(5)}</span>
                    </div>
                  </div>
                  <div className="settings-toggle-list settings-toggle-list--compact">
                    <SettingsToggle
                      label={t.settings.miniTransparency}
                      description={t.settings.miniTransparencyDescription}
                      checked={settings.miniTransparentMode}
                      onToggle={() =>
                        updateBackendSettings({
                          miniTransparentMode: !settings.miniTransparentMode,
                        })
                      }
                    />
                  </div>
                </div>
              ) : activeTab === "SOURCE" ? (
                <div className="settings-source">
                  <div className="settings-look__header">
                    <h3>{t.settings.playerSource}</h3>
                    <p>{t.settings.playerSourceCopy}</p>
                  </div>
                  <div
                    className="settings-source__list"
                    role="radiogroup"
                    aria-label={t.settings.playerSourceGroup}
                  >
                    <SourcePlayerRow
                      label={t.settings.auto}
                      note={t.settings.autoNote}
                      selected={settings.playerSourceId.length === 0}
                      onSelect={() => handlePlayerSelect(null)}
                    />
                    {savedPlayerMissing ? (
                      <SourcePlayerRow
                        label={settings.playerSourceName || settings.playerSourceId}
                        note={t.settings.savedMissing}
                        missingLabel={t.settings.notRunning}
                        selected
                        missing
                        onSelect={() => {}}
                      />
                    ) : null}
                    {players.map((player) => (
                      <SourcePlayerRow
                        key={player.id}
                        label={player.name}
                        note={player.id}
                        selected={player.id === settings.playerSourceId}
                        playing={player.isPlaying}
                        playingLabel={t.settings.playing}
                        onSelect={() => handlePlayerSelect(player)}
                      />
                    ))}
                  </div>
                  {players.length === 0 ? (
                    <p className="settings-source__empty">
                      {t.settings.noSessions}
                    </p>
                  ) : null}
                </div>
              ) : activeTab === "OTHER" ? (
                <div className="settings-toggle-list">
                  <SettingsToggle
                    label={t.settings.keyboardShortcuts}
                    description={t.settings.keyboardShortcutsDescription}
                    checked={settings.keyboardShortcutsEnabled}
                    onToggle={() =>
                      updateBackendSettings({
                        keyboardShortcutsEnabled:
                          !settings.keyboardShortcutsEnabled,
                      })
                    }
                  />
                  <SettingsToggle
                    label={t.settings.quitToTray}
                    description={t.settings.quitToTrayDescription}
                    checked={settings.quitToTray}
                    onToggle={() =>
                      updateBackendSettings({
                        quitToTray: !settings.quitToTray,
                      })
                    }
                  />
                  <SettingsToggle
                    label={t.settings.startAtLogin}
                    description={t.settings.startAtLoginDescription}
                    checked={settings.startWithWindows}
                    onToggle={() =>
                      updateBackendSettings({
                        startWithWindows: !settings.startWithWindows,
                      })
                    }
                  />

                  <div className="settings-field">
                    <label
                      className="settings-field__label"
                      htmlFor="settings-discord-id"
                    >
                      {t.settings.discord}
                    </label>
                    <p className="settings-field__description">
                      {t.settings.discordDescription}
                    </p>
                    <div className="settings-field__row">
                      <input
                        id="settings-discord-id"
                        className="settings-field__input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={32}
                        placeholder={t.settings.discordPlaceholder}
                        value={discordIdDraft}
                        onChange={(event) =>
                          setDiscordIdDraft(event.currentTarget.value)
                        }
                        onBlur={commitDiscordId}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      <span
                        className={`settings-field__saved${discordIdSaved ? " settings-field__saved--visible" : ""}`}
                        aria-live="polite"
                      >
                        {t.settings.saved}
                      </span>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label
                      className="settings-field__label"
                      htmlFor="settings-overlay-url"
                    >
                      {t.settings.obs}
                    </label>
                    <p className="settings-field__description">
                      {t.settings.obsDescription}
                    </p>
                    <input
                      id="settings-overlay-url"
                      className="settings-field__input"
                      type="text"
                      readOnly
                      value="http://127.0.0.1:43110/overlay"
                      aria-label={t.settings.obsUrl}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </div>

                  <div className="settings-sleep">
                    <div className="settings-look__header">
                      <h3>{t.settings.sleepTitle}</h3>
                      <p>{t.settings.sleepCopy}</p>
                    </div>
                    <div
                      className="settings-sleep__options"
                      role="group"
                      aria-label={t.settings.sleepGroup}
                    >
                      <button
                        type="button"
                        className={`settings-sleep__option${sleepTimer ? "" : " settings-sleep__option--active"}`}
                        aria-pressed={!sleepTimer}
                        onClick={handleSleepCancel}
                      >
                        {t.common.off}
                      </button>
                      {SLEEP_MINUTE_OPTIONS.map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          className="settings-sleep__option"
                          aria-pressed={false}
                          onClick={() => handleSleepStart("minutes", minutes)}
                        >
                          {t.sleep.minutes(minutes)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`settings-sleep__option${sleepTimer?.mode === "endOfTrack" ? " settings-sleep__option--active" : ""}`}
                        aria-pressed={sleepTimer?.mode === "endOfTrack"}
                        onClick={() => handleSleepStart("endOfTrack")}
                      >
                        {t.settings.endOfTrack}
                      </button>
                    </div>
                    <div
                      className={`settings-sleep__status${sleepTimer ? " settings-sleep__status--active" : ""}${sleepError ? " settings-sleep__status--error" : ""}`}
                      aria-live="polite"
                    >
                      <span
                        className="settings-sleep__dot"
                        aria-hidden="true"
                      />
                      <span className="settings-sleep__status-label">
                        {sleepTimer ? t.settings.active : t.settings.sleep}
                      </span>
                      <span className="settings-sleep__status-value">
                        {sleepError ??
                          formatSleepTimerStatus(sleepTimer, sleepNow, t.sleep)}
                      </span>
                      {sleepTimer ? (
                        <button
                          type="button"
                          className="settings-sleep__cancel"
                          onClick={handleSleepCancel}
                        >
                          {t.settings.cancel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : activeTab === "ABOUT" ? (
                <div className="settings-about">
                  <p className="settings-about__kicker">VinylDeck</p>
                  <h3>{t.settings.aboutHeadline}</h3>
                  <p className="settings-about__body">{t.settings.aboutBody}</p>
                  <div
                    className="settings-about__grid"
                    aria-label={t.settings.aboutDetails}
                  >
                    <span>{t.settings.version}</span>
                    <strong>{APP_VERSION}</strong>
                    <span>{t.settings.playback}</span>
                    <strong>{t.settings.playbackValue}</strong>
                    <span>{t.settings.windows}</span>
                    <strong>{t.settings.windowsValue}</strong>
                    <span>{t.settings.visuals}</span>
                    <strong>{t.settings.visualsValue}</strong>
                  </div>
                  <div className="settings-about__update">
                    <div className="settings-about__update-copy">
                      <span className="settings-about__kicker">{t.settings.updates}</span>
                      <p
                        className={`settings-about__update-status${updateState.kind === "available" ? " settings-about__update-status--available" : ""}`}
                        aria-live="polite"
                      >
                        {updateMessage}
                      </p>
                      {updateOpenFailed ? (
                        <p className="settings-about__update-status settings-about__update-status--error">
                          {t.settings.openReleaseError}
                        </p>
                      ) : null}
                      {updateState.kind === "available" && updateState.status.publishedAt ? (
                        <p className="settings-about__update-date">
                          {t.settings.releasePublished(
                            new Date(updateState.status.publishedAt).toLocaleDateString(
                              localeFor(language),
                              { year: "numeric", month: "short", day: "numeric" },
                            ),
                          )}
                        </p>
                      ) : null}
                    </div>
                    <div className="settings-about__update-actions">
                      {updateState.kind === "available" ? (
                        <button
                          type="button"
                          className="settings-about__update-button"
                          onClick={() => handleOpenRelease(updateState.status.releaseUrl)}
                        >
                          {t.settings.viewRelease}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`settings-about__update-button${updateState.kind === "available" ? " settings-about__update-button--ghost" : ""}`}
                        onClick={handleCheckForUpdates}
                        disabled={updateState.kind === "checking"}
                      >
                        {t.settings.checkForUpdates}
                      </button>
                    </div>
                  </div>
                  <div className="settings-about__qa">
                    <SettingsToggle
                      label={t.settings.testEmpty}
                      description={t.settings.testEmptyDescription}
                      checked={devForceEmpty}
                      onToggle={() => setDevForceEmpty(!devForceEmpty)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SourcePlayerRowProps {
  label: string;
  note: string;
  selected: boolean;
  playing?: boolean;
  playingLabel?: string;
  missing?: boolean;
  missingLabel?: string;
  onSelect: () => void;
}

function SourcePlayerRow({
  label,
  note,
  selected,
  playing = false,
  playingLabel,
  missing = false,
  missingLabel,
  onSelect,
}: SourcePlayerRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`settings-source__row${selected ? " settings-source__row--active" : ""}${missing ? " settings-source__row--missing" : ""}`}
      disabled={missing}
      onClick={onSelect}
    >
      <span className="settings-source__radio" aria-hidden="true" />
      <span className="settings-source__copy">
        <span className="settings-source__name">{label}</span>
        <span className="settings-source__note">{note}</span>
      </span>
      {playing ? (
        <span className="settings-source__playing">
          <span className="settings-source__dot" aria-hidden="true" />
          {playingLabel}
        </span>
      ) : null}
      {missing ? (
        <span className="settings-source__playing settings-source__playing--idle">
          {missingLabel}
        </span>
      ) : null}
    </button>
  );
}

interface SettingsToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function SettingsToggle({
  label,
  description,
  checked,
  onToggle,
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      className="settings-toggle-row"
      aria-pressed={checked}
      onClick={onToggle}
    >
      <span className="settings-toggle-row__copy">
        <span className="settings-toggle-row__label">{label}</span>
        <span className="settings-toggle-row__description">{description}</span>
      </span>
      <span
        className={`settings-switch${checked ? " settings-switch--on" : ""}`}
        aria-hidden="true"
      >
        <span className="settings-switch__glow" />
        <span className="settings-switch__thumb" />
      </span>
    </button>
  );
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
}

function SettingsParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const canvasEl = canvas;
    const ctx = context;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frameId = 0;
    let particles: Particle[] = [];

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      canvasEl.width = Math.round(window.innerWidth * ratio);
      canvasEl.height = Math.round(window.innerHeight * ratio);
      canvasEl.style.width = `${window.innerWidth}px`;
      canvasEl.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function resetParticles() {
      particles = Array.from({ length: 25 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: 1 + Math.random(),
        speed: 0.18 + Math.random() * 0.34,
        alpha: 0.12 + Math.random() * 0.08,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";

      for (const particle of particles) {
        particle.y -= particle.speed;
        if (particle.y < -4) {
          particle.y = window.innerHeight + 4;
          particle.x = Math.random() * window.innerWidth;
        }

        ctx.globalAlpha = particle.alpha;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      frameId = window.requestAnimationFrame(draw);
    }

    resize();
    resetParticles();
    window.addEventListener("resize", resize);

    if (!prefersReducedMotion) {
      frameId = window.requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas className="settings-particles" ref={canvasRef} aria-hidden="true" />
  );
}
