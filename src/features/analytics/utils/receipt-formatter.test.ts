import { describe, it, expect } from "vitest";
import {
  formatReceiptCode,
  isReceiptPrefixValid,
  resolveFestivalKind,
  getFestivalGreetings,
  normalizeSearchReceiptToLocalReceipt,
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
    it("prioritizes explicit event context over receipt prefix", () => {
      // Explicit Ganesh event with NU- prefix should resolve to ganesh
      expect(resolveFestivalKind("सार्वजनिक गणेशोत्सव २०२६", "श्री गणेश मंडळ", "NU-")).toBe("ganesh");
      // Explicit Navratri event with GU- prefix should resolve to navratri
      expect(resolveFestivalKind("Navratri Utsav 2026", "Durga Mandal", "GU-")).toBe("navratri");
    });

    it("identifies Navratri from physical book prefix triggers (NU-, NR-, DU-, NV-) when event is neutral or absent", () => {
      expect(resolveFestivalKind(null, null, "NU-")).toBe("navratri");
      expect(resolveFestivalKind(null, null, "NR")).toBe("navratri");
      expect(resolveFestivalKind("General Campaign", "Mandal Trust", "NU-")).toBe("navratri");
      expect(resolveFestivalKind(null, null, "DU-1")).toBe("navratri");
    });

    it("identifies Ganesh from physical book prefix triggers (GU-, GN-, GP-) when event is neutral or absent", () => {
      expect(resolveFestivalKind(null, null, "GU-")).toBe("ganesh");
      expect(resolveFestivalKind(null, null, "GN")).toBe("ganesh");
      expect(resolveFestivalKind("General Campaign", "Mandal Trust", "GU-")).toBe("ganesh");
    });

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
      expect(resolveFestivalKind(null, null, "BK1-")).toBe("other");
    });
  });

  describe("getFestivalGreetings", () => {
    it("returns Navratri greetings with Jai Mata Di and Kulswamini mantra", () => {
      const g = getFestivalGreetings("Navratri Utsav 2026");
      expect(g.kind).toBe("navratri");
      expect(g.headerDevotional).toBe("🚩 जय माता दी 🚩");
      expect(g.closingGreeting).toBe("आपल्या सहकार्याबद्दल धन्यवाद!\nजय माता दी! 🌺");
      expect(g.mantra).toBe("॥ श्री कुलस्वामिनी प्रसन्न ॥");
      expect(g.artworkType).toBe("navratri");
    });

    it("returns Navratri greetings when triggered by NU- receipt prefix", () => {
      const g = getFestivalGreetings(null, null, "NU-");
      expect(g.kind).toBe("navratri");
      expect(g.headerDevotional).toBe("🚩 जय माता दी 🚩");
      expect(g.closingGreeting).toContain("जय माता दी! 🌺");
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

  describe("normalizeSearchReceiptToLocalReceipt", () => {
    it("safely normalizes snake_case search receipt item to camelCase local receipt format", () => {
      const searchItem = {
        id: "rec-123",
        receipt_number: 104,
        receipt_prefix: "NU-",
        amount: 501,
        payment_mode: "upi",
        payment_reference: "UPI/123456",
        donor_name: "Rahul Sharma",
        donor_mobile: "9820011223",
        unit_number: "402",
        building_name: "Gokul Heights",
        building_wing: "A",
        property_type: "residential",
        status: "issued",
        void_reason: null,
        voided_at: null,
        created_at: "2026-10-04T00:00:00.000Z",
      };

      const normalized = normalizeSearchReceiptToLocalReceipt(searchItem);
      expect(normalized.receiptNumber).toBe(104);
      expect(normalized.receiptPrefix).toBe("NU-");
      expect(normalized.paymentMode).toBe("upi");
      expect(normalized.donorName).toBe("Rahul Sharma");
      expect(normalized.donorMobile).toBe("9820011223");
      expect(normalized.unitNumber).toBe("402");
      expect(normalized.buildingName).toBe("Gokul Heights");
      expect(normalized.status).toBe("issued");
      expect(normalized.amount).toBe(501);
    });

    it("handles null / undefined / empty input defensively without throwing", () => {
      const emptyNormalized = normalizeSearchReceiptToLocalReceipt(null);
      expect(emptyNormalized.receiptNumber).toBe(0);
      expect(emptyNormalized.paymentMode).toBe("cash");
      expect(emptyNormalized.donorName).toBe("");

      const partialNormalized = normalizeSearchReceiptToLocalReceipt({});
      expect(partialNormalized.receiptNumber).toBe(0);
      expect(partialNormalized.paymentMode).toBe("cash");
    });
  });
});
