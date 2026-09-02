import type { PavtiTemplateConfig } from "../types/pavti.types";

const STORAGE_KEY_PREFIX = "varganipro_pavti_config_";

export const DEFAULT_PAVTI_CONFIG: PavtiTemplateConfig = {
  festivalType: "ganpati",
  mandalName: "श्री गणेश मित्र मंडळ",
  eventName: "सार्वजनिक गणेशोत्सव २०२६",
  yearText: "12 वा वर्ष",
  secretaryName: "अक्षय जोशी",
  secretaryDesignation: "अध्यक्ष / खजिनदार",
};

export function getPavtiConfigStorageKey(organizationId?: string | null): string {
  return organizationId ? `${STORAGE_KEY_PREFIX}${organizationId}` : `${STORAGE_KEY_PREFIX}default`;
}

export function loadPavtiConfig(
  organizationId?: string | null,
  fallbackMandalName?: string | null,
  fallbackEventName?: string | null
): PavtiTemplateConfig {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_PAVTI_CONFIG,
      mandalName: fallbackMandalName || DEFAULT_PAVTI_CONFIG.mandalName,
      eventName: fallbackEventName || DEFAULT_PAVTI_CONFIG.eventName,
    };
  }

  try {
    const key = getPavtiConfigStorageKey(organizationId);
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PavtiTemplateConfig>;
      return {
        festivalType: parsed.festivalType || "ganpati",
        mandalName: parsed.mandalName || fallbackMandalName || DEFAULT_PAVTI_CONFIG.mandalName,
        eventName: parsed.eventName || fallbackEventName || DEFAULT_PAVTI_CONFIG.eventName,
        yearText: parsed.yearText !== undefined ? parsed.yearText : DEFAULT_PAVTI_CONFIG.yearText,
        secretaryName: parsed.secretaryName || DEFAULT_PAVTI_CONFIG.secretaryName,
        secretaryDesignation: parsed.secretaryDesignation || DEFAULT_PAVTI_CONFIG.secretaryDesignation,
      };
    }
  } catch (e) {
    console.error("Failed to load Pavti config:", e);
  }

  return {
    ...DEFAULT_PAVTI_CONFIG,
    mandalName: fallbackMandalName || DEFAULT_PAVTI_CONFIG.mandalName,
    eventName: fallbackEventName || DEFAULT_PAVTI_CONFIG.eventName,
  };
}

export function savePavtiConfig(config: PavtiTemplateConfig, organizationId?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    const key = getPavtiConfigStorageKey(organizationId);
    window.localStorage.setItem(key, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save Pavti config:", e);
  }
}
