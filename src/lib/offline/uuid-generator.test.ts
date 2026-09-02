import { describe, it, expect, vi } from "vitest";
import { generateUUID } from "./offline-db";

describe("generateUUID Compatibility & RFC 4122 v4 Invariants", () => {
  const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("A. generates valid RFC 4122 v4 UUID when crypto.randomUUID is available", () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(UUID_V4_REGEX);
  });

  it("B. generates valid RFC 4122 v4 UUID when randomUUID is unavailable (Insecure Context / LAN IP)", () => {
    const originalCrypto = globalThis.crypto;
    // Simulate non-secure context where crypto.randomUUID is undefined but getRandomValues is available
    const mockedCrypto = {
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      randomUUID: undefined,
    };

    vi.stubGlobal("crypto", mockedCrypto);

    try {
      const uuid = generateUUID();
      expect(uuid).toMatch(UUID_V4_REGEX);
      expect(uuid.charAt(14)).toBe("4"); // Version 4
      expect(["8", "9", "a", "b"]).toContain(uuid.charAt(19).toLowerCase()); // Variant 1
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("C. generates valid RFC 4122 v4 UUID with Math.random fallback when crypto is completely absent", () => {
    vi.stubGlobal("crypto", undefined);

    try {
      const uuid = generateUUID();
      expect(uuid).toMatch(UUID_V4_REGEX);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("D. generates 1,000 unique UUIDs without collision in non-secure context", () => {
    const originalCrypto = globalThis.crypto;
    const mockedCrypto = {
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      randomUUID: undefined,
    };

    vi.stubGlobal("crypto", mockedCrypto);

    try {
      const set = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const id = generateUUID();
        expect(set.has(id)).toBe(false);
        set.add(id);
      }
      expect(set.size).toBe(1000);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
