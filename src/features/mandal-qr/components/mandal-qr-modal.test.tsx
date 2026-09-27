// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MandalQrModal } from "./mandal-qr-modal";

describe("MandalQrModal", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <MandalQrModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders QR code container and UPI ID when configured", async () => {
    render(
      <MandalQrModal
        isOpen={true}
        onClose={() => {}}
        mandalName="श्री गणेश मित्र मंडळ"
        eventName="सार्वजनिक गणेशोत्सव २०२६"
        configuredUpiId="shreeganesh@upi"
        configuredUpiName="श्री गणेश मित्र मंडळ"
      />
    );

    expect(screen.getByText("मंडळ UPI QR Code")).toBeDefined();
    expect(screen.getByText("shreeganesh@upi")).toBeDefined();
    expect(screen.getByTestId("btn-copy-upi-id")).toBeDefined();
    expect(screen.getByTestId("mandal-qr-container")).toBeDefined();

    // Await async QR generation
    await waitFor(() => {
      const container = screen.getByTestId("mandal-qr-container");
      expect(container.querySelector("svg")).not.toBeNull();
    });
  });

  it("calls onClose when close button or dismiss is clicked", () => {
    const onClose = vi.fn();
    render(
      <MandalQrModal
        isOpen={true}
        onClose={onClose}
        configuredUpiId="shreeganesh@upi"
      />
    );

    const closeBtn = screen.getByTestId("btn-close-mandal-qr");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows unconfigured state when no UPI ID is provided", () => {
    render(
      <MandalQrModal
        isOpen={true}
        onClose={() => {}}
        configuredUpiId=""
        isAdmin={false}
      />
    );

    expect(screen.getByText("UPI ID सेट केलेले नाही")).toBeDefined();
    expect(screen.getByText(/Mandal UPI ID is not configured yet/)).toBeDefined();
  });
});
