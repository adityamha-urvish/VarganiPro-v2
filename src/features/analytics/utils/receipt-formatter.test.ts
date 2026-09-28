import { describe, it, expect } from "vitest";
import {
  formatReceiptCode,
  isReceiptPrefixValid,
  resolveFestivalKind,
  getFestivalGreetings,
} from "./receipt-formatter";

describe("Receipt Formatter & Festival Resolver", () => {
  describe("formatReceiptCode", () => {
    it("formats receipt code with physical book prefix", () => {
      expect(formatReceiptCode({ receiptNumber: 262, receiptPrefix: "NU-" })).toBe("NU-262");
      expect(formatReceiptCode({ receiptNumber: 45, receiptPrefix: "GU-" })).toBe("GU-45");
      expect(formatReceiptCode({ receiptNumber: 101, receiptPrefix: "BK1-" })).toBe("BK1-101");
    });

    it("formats cleanly as #number when prefix is absent or empty (never synthesizes VP-)", () => {
      expect(formatReceiptCode({ receiptNumber: 262 })).toBe("#262");
      expect(formatReceiptCode({ receiptNumber: 262, receiptPrefix: "" })).toBe("#262");
      expect(formatReceiptCode({ receiptNumber: 262, receiptPrefix: null })).toBe("#262");
      expect(formatReceiptCode({ receiptNumber: 262, receiptPrefix: "   " })).toBe("#262");
    });
  });

  describe("isReceiptPrefixValid", () => {
    it("validates non-empty prefix strings", () => {
      expect(isReceiptPrefixValid("NU-")).toBe(true);
      expect(isReceiptPrefixValid("GU")).toBe(true);
      expect(isReceiptPrefixValid("")).toBe(false);
      expect(isReceiptPrefixValid(null)).toBe(false);
      expect(isReceiptPrefixValid(undefined)).toBe(false);
      expect(isReceiptPrefixValid("   ")).toBe(false);
    });
  });

  describe("resolveFestivalKind", () => {
    it("identifies Navratri from various English and Marathi keywords", () => {
      expect(resolveFestivalKind("Navratri Utsav 2026", "Shree Durga Mandal")).toBe("navratri");
      expect(resolveFestivalKind("नवरात्रौत्सव २०२६", "देवी मंडळ")).toBe("navratri");
      expect(resolveFestivalKind("Durga Puja 2026")).toBe("navratri");
      expect(resolveFestivalKind("Dussehra Festival", "Mata Trust")).toBe("navratri");
      expect(resolveFestivalKind("Dandiya Night 2026")).toBe("navratri");
    });

    it("identifies Ganesh festival from various English and Marathi keywords", () => {
      expect(resolveFestivalKind("Ganesh Utsav 2026", "Bappa Mitra Mandal")).toBe("ganesh");
      expect(resolveFestivalKind("सार्वजनिक गणेशोत्सव", "बाल गोपाळ मित्र मंडळ")).toBe("ganesh");
      expect(resolveFestivalKind("Ganpati Utsav")).toBe("ganesh");
      expect(resolveFestivalKind("Ganesh Chaturthi")).toBe("ganesh");
    });

    it("defaults to other for unknown or general festivals", () => {
      expect(resolveFestivalKind("Annual Gathering 2026", "Samaj Seva Trust")).toBe("other");
      expect(resolveFestivalKind("Diwali Utsav")).toBe("other");
      expect(resolveFestivalKind(null, null)).toBe("other");
    });
  });

  describe("getFestivalGreetings", () => {
    it("returns Navratri greetings with Jai Mata Di and Kulswamini mantra", () => {
      const g = getFestivalGreetings("Navratri Utsav 2026");
      expect(g.kind).toBe("navratri");
      expect(g.headerDevotional).toBe("🚩 जय माता दी 🚩");
      expect(g.closingGreeting).toContain("जय माता दी! 🙏🌺");
      expect(g.mantra).toBe("॥ श्री कुलस्वामिनी प्रसन्न ॥");
      expect(g.artworkType).toBe("navratri");
    });

    it("returns Ganesh greetings with Ganpati Bappa Morya", () => {
      const g = getFestivalGreetings("Ganesh Utsav 2026");
      expect(g.kind).toBe("ganesh");
      expect(g.headerDevotional).toBe("🚩 श्री गणेश उत्सव 🚩");
      expect(g.closingGreeting).toContain("गणपती बाप्पा मोरया! 🌺");
      expect(g.mantra).toBe("॥ श्री गणेशाय नमः ॥");
      expect(g.artworkType).toBe("ganpati");
    });

    it("returns neutral greetings for other/unknown events without Ganesh defaults", () => {
      const g = getFestivalGreetings("General Campaign");
      expect(g.kind).toBe("other");
      expect(g.headerDevotional).toBe("🚩 उत्सव वर्गणी पावती 🚩");
      expect(g.closingGreeting).toBe("आपल्या सहकार्याबद्दल धन्यवाद! 🙏");
      expect(g.mantra).toBeNull();
      expect(g.artworkType).toBe("other");
    });
  });
});
