// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generatePavtiDataUrlFromElement,
  generatePavtiBlobFromElement,
  generatePavtiFileFromElement,
  canSharePavtiFile,
  sharePavtiFile,
  downloadImageBlob,
} from "./pavti-image.service";

// Mock html-to-image
vi.mock("html-to-image", () => ({
  toJpeg: vi.fn().mockResolvedValue("data:image/jpeg;base64,samplejpegdata"),
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,samplepngdata"),
  toBlob: vi.fn().mockImplementation((_element, options) => {
    const type = options?.type || "image/jpeg";
    return Promise.resolve(new Blob(["mock-image-bytes"], { type }));
  }),
}));

describe("PavtiImageService Tests", () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    mockElement = document.createElement("div");
    mockElement.id = "test-card";
    document.body.appendChild(mockElement);
  });

  it("generates JPEG data URL with default high quality options", async () => {
    const dataUrl = await generatePavtiDataUrlFromElement(mockElement);
    expect(dataUrl).toBe("data:image/jpeg;base64,samplejpegdata");
  });

  it("generates PNG data URL when format is png", async () => {
    const dataUrl = await generatePavtiDataUrlFromElement(mockElement, { format: "png" });
    expect(dataUrl).toBe("data:image/png;base64,samplepngdata");
  });

  it("generates JPEG Blob with correct mime type", async () => {
    const blob = await generatePavtiBlobFromElement(mockElement);
    expect(blob).toBeDefined();
    expect(blob.type).toBe("image/jpeg");
  });

  it("generates File object with proper .jpg extension", async () => {
    const file = await generatePavtiFileFromElement(mockElement, "receipt-1042");
    expect(file.name).toBe("receipt-1042.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  it("generates File object with proper .png extension when requested", async () => {
    const file = await generatePavtiFileFromElement(mockElement, "receipt-1042", { format: "png" });
    expect(file.name).toBe("receipt-1042.png");
    expect(file.type).toBe("image/png");
  });

  it("triggers browser download with expected filename", () => {
    const mockBlob = new Blob(["test"], { type: "image/jpeg" });
    const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/123");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadImageBlob(mockBlob, "vargani-pavti-1042.jpg");

    expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
    expect(clickSpy).toHaveBeenCalled();
  });

  describe("Web Share Level 2 Image Sharing Tests", () => {
    it("canSharePavtiFile returns false when navigator.share or navigator.canShare is missing", () => {
      const file = new File(["test"], "receipt.jpg", { type: "image/jpeg" });
      
      // Temporarily remove share APIs
      const originalShare = navigator.share;
      const originalCanShare = navigator.canShare;
      delete (navigator as unknown as { share?: unknown }).share;
      delete (navigator as unknown as { canShare?: unknown }).canShare;

      expect(canSharePavtiFile(file)).toBe(false);

      // Restore
      if (originalShare) navigator.share = originalShare;
      if (originalCanShare) navigator.canShare = originalCanShare;
    });

    it("canSharePavtiFile returns true when navigator.canShare({ files: [file] }) is true", () => {
      const file = new File(["test"], "receipt.jpg", { type: "image/jpeg" });
      navigator.share = vi.fn();
      navigator.canShare = vi.fn().mockReturnValue(true);

      expect(canSharePavtiFile(file)).toBe(true);
      expect(navigator.canShare).toHaveBeenCalledWith({ files: [file] });
    });

    it("canSharePavtiFile returns false when navigator.canShare({ files: [file] }) is false", () => {
      const file = new File(["test"], "receipt.jpg", { type: "image/jpeg" });
      navigator.share = vi.fn();
      navigator.canShare = vi.fn().mockReturnValue(false);

      expect(canSharePavtiFile(file)).toBe(false);
    });

    it("sharePavtiFile returns unsupported when canShare is false", async () => {
      const file = new File(["test"], "receipt.jpg", { type: "image/jpeg" });
      navigator.canShare = vi.fn().mockReturnValue(false);

      const result = await sharePavtiFile(file, "पावती कॅप्शन");
      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
      expect(result.error).toContain("थेट इमेज शेअरिंग उपलब्ध नाही");
    });

    it("sharePavtiFile invokes navigator.share with files and caption and returns success", async () => {
      const file = new File(["test"], "Vargani-Pavti-101.jpg", { type: "image/jpeg" });
      const shareMock = vi.fn().mockResolvedValue(undefined);
      navigator.share = shareMock;
      navigator.canShare = vi.fn().mockReturnValue(true);

      const result = await sharePavtiFile(file, "🚩 वर्गणी पावती #101");
      expect(result.success).toBe(true);
      expect(shareMock).toHaveBeenCalledWith({
        files: [file],
        title: "वर्गणी पावती",
        text: "🚩 वर्गणी पावती #101",
      });
    });

    it("sharePavtiFile handles AbortError as normal user cancellation", async () => {
      const file = new File(["test"], "receipt.jpg", { type: "image/jpeg" });
      const abortError = new DOMException("The share operation was aborted", "AbortError");
      navigator.share = vi.fn().mockRejectedValue(abortError);
      navigator.canShare = vi.fn().mockReturnValue(true);

      const result = await sharePavtiFile(file);
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("sharePavtiFile handles NotAllowedError gracefully", async () => {
      const file = new File(["test"], "receipt.jpg", { type: "image/jpeg" });
      const notAllowedError = new DOMException("Permission denied", "NotAllowedError");
      navigator.share = vi.fn().mockRejectedValue(notAllowedError);
      navigator.canShare = vi.fn().mockReturnValue(true);

      const result = await sharePavtiFile(file);
      expect(result.success).toBe(false);
      expect(result.cancelled).toBeFalsy();
      expect(result.error).toContain("शेअर करण्याची परवानगी मिळाली नाही");
    });

    it("sharePavtiFile handles generic Error gracefully", async () => {
      const file = new File(["test"], "receipt.jpg", { type: "image/jpeg" });
      navigator.share = vi.fn().mockRejectedValue(new Error("Native intent failed"));
      navigator.canShare = vi.fn().mockReturnValue(true);

      const result = await sharePavtiFile(file);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Native intent failed");
    });
  });
});

