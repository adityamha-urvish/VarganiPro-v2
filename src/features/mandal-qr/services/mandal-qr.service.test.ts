// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildUpiPaymentIntentUri,
  generateUpiQrSvg,
  generateUpiQrDataUrl,
  loadCachedMandalUpiConfig,
  saveCachedMandalUpiConfig,
} from "./mandal-qr.service";

describe("mandal-qr.service", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("builds canonical NPCI UPI payment intent URI without amount", () => {
    const uri = buildUpiPaymentIntentUri("ganesh@okhdfcbank", "श्री गणेश मंडळ");
    expect(uri).toContain("upi://pay?");
    expect(uri).toContain("pa=ganesh%40okhdfcbank");
    expect(uri).toContain("cu=INR");
    expect(uri).not.toContain("am=");
  });

  it("builds canonical NPCI UPI payment intent URI with fixed amount", () => {
    const uri = buildUpiPaymentIntentUri("ganesh@okhdfcbank", "श्री गणेश मंडळ", 501);
    expect(uri).toContain("pa=ganesh%40okhdfcbank");
    expect(uri).toContain("am=501.00");
    expect(uri).toContain("cu=INR");
  });

  it("generates non-empty SVG string for valid UPI URI offline", async () => {
    const uri = buildUpiPaymentIntentUri("mandal@upi", "Ganesh Mandal");
    const svg = await generateUpiQrSvg(uri, { size: 280 });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg.length).toBeGreaterThan(500);
  });

  it("generates non-empty PNG data URL for UPI URI", async () => {
    const uri = buildUpiPaymentIntentUri("mandal@upi", "Ganesh Mandal");
    const dataUrl = await generateUpiQrDataUrl(uri, { size: 280 });
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("persists and loads cached Mandal UPI configuration in localStorage for offline use", () => {
    const orgId = "org-test-123";
    const eventId = "event-test-456";

    // Initially null
    const empty = loadCachedMandalUpiConfig(orgId, eventId);
    expect(empty.upiId).toBeNull();

    // Save
    saveCachedMandalUpiConfig(orgId, eventId, {
      upiId: "mandaluat@axisbank",
      upiName: "Shree Ganesh Mandal UAT",
    });

    // Load
    const loaded = loadCachedMandalUpiConfig(orgId, eventId);
    expect(loaded.upiId).toBe("mandaluat@axisbank");
    expect(loaded.upiName).toBe("Shree Ganesh Mandal UAT");
  });
});
