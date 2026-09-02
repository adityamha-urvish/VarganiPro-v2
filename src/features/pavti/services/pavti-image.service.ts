import { toJpeg, toPng, toBlob } from "html-to-image";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { DigitalPavtiCard } from "../components/digital-pavti-card";
import type { PavtiTemplateConfig, PavtiReceiptData } from "../types/pavti.types";

export interface PavtiImageOptions {
  pixelRatio?: number;
  quality?: number;
  width?: number;
  height?: number;
  format?: "jpeg" | "png";
}

const DEFAULT_OPTIONS: Required<Omit<PavtiImageOptions, "width" | "height">> = {
  pixelRatio: 2, // 2x Retina resolution for sharp text on mobile screens
  quality: 0.95, // High-fidelity JPEG compression
  format: "jpeg",
};

/**
 * Generate a JPEG/PNG Data URL from an already mounted Pavti DOM element.
 */
export async function generatePavtiDataUrlFromElement(
  element: HTMLElement,
  options?: PavtiImageOptions
): Promise<string> {
  const merged = { ...DEFAULT_OPTIONS, ...options };

  const renderOptions = {
    quality: merged.quality,
    pixelRatio: merged.pixelRatio,
    backgroundColor: "#FFFDF7",
    cacheBust: false,
    canvasWidth: merged.width,
    canvasHeight: merged.height,
  };

  if (merged.format === "png") {
    return toPng(element, renderOptions);
  }

  return toJpeg(element, renderOptions);
}

/**
 * Generate a Blob (JPEG/PNG) from an already mounted Pavti DOM element.
 */
export async function generatePavtiBlobFromElement(
  element: HTMLElement,
  options?: PavtiImageOptions
): Promise<Blob> {
  const merged = { ...DEFAULT_OPTIONS, ...options };

  const blob = await toBlob(element, {
    quality: merged.quality,
    pixelRatio: merged.pixelRatio,
    backgroundColor: "#FFFDF7",
    cacheBust: false,
    type: merged.format === "png" ? "image/png" : "image/jpeg",
    canvasWidth: merged.width,
    canvasHeight: merged.height,
  });

  if (!blob) {
    throw new Error("Failed to generate image blob from Pavti element");
  }

  return blob;
}

/**
 * Generate a File object (ready for Web Share API / File Download) from an element.
 */
export async function generatePavtiFileFromElement(
  element: HTMLElement,
  fileName: string,
  options?: PavtiImageOptions
): Promise<File> {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const blob = await generatePavtiBlobFromElement(element, merged);
  const mimeType = merged.format === "png" ? "image/png" : "image/jpeg";
  const extension = merged.format === "png" ? ".png" : ".jpg";
  const fullFileName = fileName.endsWith(extension) ? fileName : `${fileName}${extension}`;

  return new File([blob], fullFileName, { type: mimeType });
}

/**
 * Off-screen rendering: Render Pavti data to a JPEG/PNG Blob without requiring
 * an existing visible modal in the DOM.
 */
export async function renderPavtiToBlob(
  config: PavtiTemplateConfig,
  receipt: PavtiReceiptData,
  options?: PavtiImageOptions
): Promise<Blob> {
  const merged = { ...DEFAULT_OPTIONS, ...options };

  // Create temporary container off-screen
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  container.style.width = "860px";
  container.style.visibility = "hidden";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(
        createElement(DigitalPavtiCard, {
          config,
          receipt,
          idPrefix: "offscreen-pavti-render",
        })
      );
      // Allow microtask & font layout to complete
      setTimeout(resolve, 50);
    });

    const cardElement = container.querySelector("#offscreen-pavti-render") as HTMLElement;
    if (!cardElement) {
      throw new Error("Rendered Pavti element not found in DOM");
    }

    return await generatePavtiBlobFromElement(cardElement, merged);
  } finally {
    // Cleanup offscreen DOM
    root.unmount();
    container.remove();
  }
}

/**
 * Off-screen rendering directly to a File object (ready for Web Share or download).
 */
export async function renderPavtiToFile(
  config: PavtiTemplateConfig,
  receipt: PavtiReceiptData,
  fileName: string,
  options?: PavtiImageOptions
): Promise<File> {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const blob = await renderPavtiToBlob(config, receipt, merged);
  const mimeType = merged.format === "png" ? "image/png" : "image/jpeg";
  const extension = merged.format === "png" ? ".png" : ".jpg";
  const fullFileName = fileName.endsWith(extension) ? fileName : `${fileName}${extension}`;

  return new File([blob], fullFileName, { type: mimeType });
}

/**
 * Result of a Web Share invocation.
 */
export interface SharePavtiResult {
  success: boolean;
  cancelled?: boolean;
  unsupported?: boolean;
  error?: string;
}

/**
 * Checks if the browser natively supports Web Share API Level 2 with image files.
 */
export function canSharePavtiFile(file: File): boolean {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Shares a generated Pavti image File using Web Share API Level 2.
 * Handles user cancellations (AbortError), permission errors (NotAllowedError),
 * and unsupported environments gracefully without throwing uncaught exceptions.
 */
export async function sharePavtiFile(
  file: File,
  caption?: string
): Promise<SharePavtiResult> {
  if (!canSharePavtiFile(file)) {
    return {
      success: false,
      unsupported: true,
      error: "या डिव्हाइस किंवा ब्राउझरवर थेट इमेज शेअरिंग उपलब्ध नाही (Web Share Level 2 unsupported)",
    };
  }

  try {
    await navigator.share({
      files: [file],
      title: "वर्गणी पावती",
      text: caption || "वर्गणी पावती (Vargani Pavti)",
    });
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // User cancelled or closed the share sheet — not an application error
      return { success: false, cancelled: true };
    }
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      return {
        success: false,
        error: "शेअर करण्याची परवानगी मिळाली नाही (Share permission denied or activation lost)",
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `शेअर करताना त्रुटी आली: ${message}`,
    };
  }
}

/**
 * Helper to trigger a direct browser file download for a generated image blob.
 */
export function downloadImageBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
