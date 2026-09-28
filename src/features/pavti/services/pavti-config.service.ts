import type { PavtiTemplateConfig } from "../types/pavti.types";
import { resolveFestivalKind } from "@/features/analytics/utils/receipt-formatter";

const STORAGE_KEY_PREFIX = "varganipro_pavti_config_";

export function getPavtiConfigStorageKey(organizationId?: string | null): string {
  const cleanId = organizationId?.trim();
  return cleanId ? `${STORAGE_KEY_PREFIX}${cleanId}` : `${STORAGE_KEY_PREFIX}anonymous`;
}

/**
 * Creates dynamic default Pavti configuration from current Mandal & Event context.
 * Never defaults to hardcoded test data or Ganesh assumptions for Navratri / neutral Mandals.
 */
export function createDefaultPavtiConfig(
  _organizationId?: string | null,
  fallbackMandalName?: string | null,
  fallbackEventName?: string | null,
  fallbackSignatory?: string | null
): PavtiTemplateConfig {
  const cleanMandal = fallbackMandalName?.trim() || "उत्सव मंडळ";
  const cleanEvent = fallbackEventName?.trim() || "उत्सव २०२६";
  const festivalType = resolveFestivalKind(cleanEvent, cleanMandal);

  return {
    festivalType,
    mandalName: cleanMandal,
    eventName: cleanEvent,
    yearText: "",
    secretaryName: fallbackSignatory?.trim() || "अध्यक्ष / खजिनदार",
    secretaryDesignation: "अध्यक्ष / खजिनदार",
  };
}

export function loadPavtiConfig(
  organizationId?: string | null,
  fallbackMandalName?: string | null,
  fallbackEventName?: string | null,
  fallbackSignatory?: string | null
): PavtiTemplateConfig {
  const defaults = createDefaultPavtiConfig(
    organizationId,
    fallbackMandalName,
    fallbackEventName,
    fallbackSignatory
  );

  if (typeof window === "undefined" || !organizationId?.trim()) {
    return defaults;
  }

  try {
    const key = getPavtiConfigStorageKey(organizationId);
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PavtiTemplateConfig>;
      return {
        festivalType: parsed.festivalType || defaults.festivalType,
        mandalName: parsed.mandalName?.trim() || defaults.mandalName,
        eventName: parsed.eventName?.trim() || defaults.eventName,
        yearText: parsed.yearText !== undefined ? parsed.yearText : defaults.yearText,
        secretaryName: parsed.secretaryName?.trim() || defaults.secretaryName,
        secretaryDesignation: parsed.secretaryDesignation?.trim() || defaults.secretaryDesignation,
      };
    }
  } catch (e) {
    console.error("Failed to load Pavti config:", e);
  }

  return defaults;
}

export function savePavtiConfig(config: PavtiTemplateConfig, organizationId?: string | null): void {
  if (typeof window === "undefined" || !organizationId?.trim()) return;

  try {
    const key = getPavtiConfigStorageKey(organizationId);
    window.localStorage.setItem(key, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save Pavti config:", e);
  }
}
