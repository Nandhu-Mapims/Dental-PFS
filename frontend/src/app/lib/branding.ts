import { useEffect, useState } from "react";
import {
  getBrandingSettingsApi,
  resetBrandingSettingsApi,
  saveBrandingSettingsApi,
  saveFeatureSettingsApi,
  type BrandingSettings,
  type BrandingSettingsInput,
} from "./api";

const BRANDING_UPDATED_EVENT = "feedback:branding-updated";

const DEFAULT_BRANDING: BrandingSettings = {
  primaryColor: "#8B1538",
  accentColor: "#C9A227",
  pageBackgroundColor: "#FAF7F2",
  logoDataUrl: null,
  voiceRecordingMaxSeconds: 120,
  botThinkSeconds: 3,
  botSkipIntro: false,
  botSkipThinkCountdown: false,
  ticketingEnabled: false,
};

function clampVoiceMaxSeconds(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BRANDING.voiceRecordingMaxSeconds;
  return Math.min(600, Math.max(15, Math.round(n)));
}

function clampBotThinkSeconds(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BRANDING.botThinkSeconds;
  return Math.min(30, Math.max(1, Math.round(n)));
}

let brandingCache: BrandingSettings = DEFAULT_BRANDING;
/** True once settings came back from the server, so guards can tell "off" from "not loaded yet". */
let brandingLoaded = false;

export function getBrandingSettings(): BrandingSettings {
  return brandingCache;
}

function setBrandingCache(next: BrandingSettings): BrandingSettings {
  brandingCache = { ...next, ticketingEnabled: Boolean(next.ticketingEnabled) };
  brandingLoaded = true;
  window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT));
  return brandingCache;
}

export async function loadBrandingSettings(): Promise<BrandingSettings> {
  try {
    const fetched = await getBrandingSettingsApi();
    return setBrandingCache({
      primaryColor: fetched.primaryColor || DEFAULT_BRANDING.primaryColor,
      accentColor: fetched.accentColor || DEFAULT_BRANDING.accentColor,
      pageBackgroundColor: fetched.pageBackgroundColor || DEFAULT_BRANDING.pageBackgroundColor,
      logoDataUrl: fetched.logoDataUrl || null,
      voiceRecordingMaxSeconds: clampVoiceMaxSeconds(fetched.voiceRecordingMaxSeconds),
      botThinkSeconds: clampBotThinkSeconds(fetched.botThinkSeconds),
      botSkipIntro: Boolean(fetched.botSkipIntro ?? fetched.botSkipIntroAndCountdown),
      botSkipThinkCountdown: Boolean(
        fetched.botSkipThinkCountdown ?? fetched.botSkipIntroAndCountdown
      ),
      ticketingEnabled: Boolean(fetched.ticketingEnabled),
    });
  } catch {
    return brandingCache;
  }
}

export async function saveBrandingSettings(
  settings: BrandingSettingsInput
): Promise<BrandingSettings> {
  const saved = await saveBrandingSettingsApi(settings);
  return setBrandingCache(saved);
}

export async function resetBrandingSettings(): Promise<BrandingSettings> {
  const reset = await resetBrandingSettingsApi();
  return setBrandingCache(reset);
}

export async function saveTicketingEnabled(enabled: boolean): Promise<BrandingSettings> {
  const saved = await saveFeatureSettingsApi({ ticketingEnabled: enabled });
  return setBrandingCache(saved);
}

/**
 * Whether the ticketing module is switched on. `loaded` stays false until the
 * settings arrive, so route guards wait instead of bouncing a deep link.
 */
export function useTicketingEnabled(): { enabled: boolean; loaded: boolean } {
  const read = () => ({ enabled: brandingCache.ticketingEnabled, loaded: brandingLoaded });
  const [state, setState] = useState(read);
  useEffect(() => {
    const unsubscribe = onBrandingSettingsChange(() => setState(read()));
    if (brandingLoaded) setState(read());
    else void loadBrandingSettings();
    return unsubscribe;
  }, []);
  return state;
}

export function applyBrandingTheme(settings: BrandingSettings): void {
  const root = document.documentElement;
  root.style.setProperty("--primary", settings.primaryColor);
  // Brand accent only — "--accent" is the shadcn hover surface for menus and must stay a light tint.
  root.style.setProperty("--brand-gold", settings.accentColor);
  root.style.setProperty("--ring", settings.primaryColor);
  root.style.setProperty("--background", settings.pageBackgroundColor);
}

export function onBrandingSettingsChange(callback: () => void): () => void {
  window.addEventListener(BRANDING_UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener(BRANDING_UPDATED_EVENT, callback);
  };
}
