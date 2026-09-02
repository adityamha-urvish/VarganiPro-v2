import { describe, expect, it } from "vitest";
import { extractClientIp } from "./client-ip-extractor";

describe("Edge Function Client IP Extractor", () => {
  it("prioritizes cf-connecting-ip when present", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.195",
      "x-real-ip": "198.51.100.1",
      "x-forwarded-for": "192.0.2.1, 10.0.0.1",
    });

    const ip = extractClientIp(headers);
    expect(ip).toBe("203.0.113.195");
  });

  it("falls back to x-real-ip when cf-connecting-ip is missing", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.1",
      "x-forwarded-for": "192.0.2.1, 10.0.0.1",
    });

    const ip = extractClientIp(headers);
    expect(ip).toBe("198.51.100.1");
  });

  it("falls back to leftmost IP in x-forwarded-for when other headers missing", () => {
    const headers = new Headers({
      "x-forwarded-for": "  49.36.120.44 , 10.1.1.2 ",
    });

    const ip = extractClientIp(headers);
    expect(ip).toBe("49.36.120.44");
  });

  it("returns empty string when no IP headers are present", () => {
    const headers = new Headers({
      "content-type": "application/json",
    });

    const ip = extractClientIp(headers);
    expect(ip).toBe("");
  });

  it("handles plain object record headers correctly", () => {
    const headers = {
      "cf-connecting-ip": "103.21.244.2",
    };

    const ip = extractClientIp(headers);
    expect(ip).toBe("103.21.244.2");
  });
});
