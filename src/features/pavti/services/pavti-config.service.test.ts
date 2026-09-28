// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPavtiConfig,
  savePavtiConfig,
  createDefaultPavtiConfig,
} from "./pavti-config.service";

describe("Pavti Config Service & Cross-Mandal Isolation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("Dynamic Defaults (createDefaultPavtiConfig)", () => {
    it("creates Navratri config for Navratri event without Ganpati defaults", () => {
      const cfg = createDefaultPavtiConfig(
        "org-navratri-1",
        "श्री नवदुर्गा उत्सव मंडळ",
        "Navratri Utsav 2026",
        "राकेश घरत"
      );
      expect(cfg.festivalType).toBe("navratri");
      expect(cfg.mandalName).toBe("श्री नवदुर्गा उत्सव मंडळ");
      expect(cfg.eventName).toBe("Navratri Utsav 2026");
      expect(cfg.secretaryName).toBe("राकेश घरत");
    });

    it("creates Ganesh config for Ganesh event", () => {
      const cfg = createDefaultPavtiConfig(
        "org-ganesh-1",
        "बाल गोपाळ मित्र मंडळ",
        "सार्वजनिक गणेशोत्सव २०२६",
        "सुनील पाटील"
      );
      expect(cfg.festivalType).toBe("ganesh");
      expect(cfg.mandalName).toBe("बाल गोपाळ मित्र मंडळ");
      expect(cfg.eventName).toBe("सार्वजनिक गणेशोत्सव २०२६");
      expect(cfg.secretaryName).toBe("सुनील पाटील");
    });
  });

  describe("Strict Cross-Mandal Cache Isolation (Org A -> Org B -> Org A)", () => {
    const orgA = "org-navratri-nerul";
    const orgB = "org-ganesh-dadar";

    it("prevents Org A custom config from bleeding into Org B, and preserves both independently", () => {
      // 1. Configure Org A (Navratri Mandal)
      savePavtiConfig(
        {
          festivalType: "navratri",
          mandalName: "नेरूळ सार्वजनिक नवरात्रौत्सव मंडळ",
          eventName: "Navratri Festival 2026",
          yearText: "१४ वे वर्ष",
          secretaryName: "राकेश घरत",
          secretaryDesignation: "अध्यक्ष",
        },
        orgA
      );

      // 2. Load Org A -> exact match
      const loadedA1 = loadPavtiConfig(orgA);
      expect(loadedA1.mandalName).toBe("नेरूळ सार्वजनिक नवरात्रौत्सव मंडळ");
      expect(loadedA1.festivalType).toBe("navratri");
      expect(loadedA1.yearText).toBe("१४ वे वर्ष");
      expect(loadedA1.secretaryName).toBe("राकेश घरत");

      // 3. Switch to Org B (Ganesh Mandal without saved config)
      // Must NOT contain any of Org A's data!
      const loadedB_default = loadPavtiConfig(
        orgB,
        "दादर सार्वजनिक गणेशोत्सव मंडळ",
        "Ganesh Utsav 2026",
        "अक्षय जोशी"
      );
      expect(loadedB_default.mandalName).toBe("दादर सार्वजनिक गणेशोत्सव मंडळ");
      expect(loadedB_default.festivalType).toBe("ganesh");
      expect(loadedB_default.secretaryName).toBe("अक्षय जोशी");
      expect(loadedB_default.mandalName).not.toContain("नेरूळ");
      expect(loadedB_default.yearText).toBe("");

      // 4. Save custom config for Org B
      savePavtiConfig(
        {
          festivalType: "ganesh",
          mandalName: "दादर सार्वजनिक गणेशोत्सव मंडळ",
          eventName: "Ganesh Utsav 2026",
          yearText: "७५ वे वर्ष",
          secretaryName: "अक्षय जोशी",
          secretaryDesignation: "कार्याध्यक्ष",
        },
        orgB
      );

      // 5. Verify Org B loaded
      const loadedB = loadPavtiConfig(orgB);
      expect(loadedB.yearText).toBe("७५ वे वर्ष");
      expect(loadedB.mandalName).toBe("दादर सार्वजनिक गणेशोत्सव मंडळ");

      // 6. Switch back to Org A -> Org A data remains 100% intact and untouched
      const loadedA2 = loadPavtiConfig(orgA);
      expect(loadedA2.mandalName).toBe("नेरूळ सार्वजनिक नवरात्रौत्सव मंडळ");
      expect(loadedA2.festivalType).toBe("navratri");
      expect(loadedA2.yearText).toBe("१४ वे वर्ष");
      expect(loadedA2.secretaryName).toBe("राकेश घरत");
      expect(loadedA2.yearText).not.toBe("७५ वे वर्ष");
    });
  });
});
