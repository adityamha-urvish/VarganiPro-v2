// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SetSecretPinModal } from "./set-secret-pin-modal";

const { supabaseRpcMock } = vi.hoisted(() => ({
  supabaseRpcMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: supabaseRpcMock,
  },
}));

describe("Phase 9-3B: SetSecretPinModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SetSecretPinModal isOpen={false} onSuccess={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("validates PIN match and calls change_self_pin on valid submit", async () => {
    const onSuccess = vi.fn();
    supabaseRpcMock.mockResolvedValueOnce({
      data: { success: true, must_change_pin: false },
      error: null,
    });

    render(<SetSecretPinModal isOpen={true} onSuccess={onSuccess} />);

    expect(screen.getByText("Set Your Secret PIN")).toBeTruthy();

    const oldPinInput = screen.getByLabelText("Current Temporary PIN");
    const newPinInput = screen.getByLabelText("New 4-Digit Secret PIN");
    const confirmPinInput = screen.getByLabelText("Confirm New PIN");
    const submitBtn = screen.getByRole("button", { name: /Save PIN & Continue/ });

    fireEvent.change(oldPinInput, { target: { value: "1234" } });
    fireEvent.change(newPinInput, { target: { value: "5678" } });
    fireEvent.change(confirmPinInput, { target: { value: "5678" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabaseRpcMock).toHaveBeenCalledWith("change_self_pin", {
        p_old_pin: "1234",
        p_new_pin: "5678",
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("displays error if new PIN and confirm PIN mismatch", async () => {
    render(<SetSecretPinModal isOpen={true} onSuccess={vi.fn()} />);

    const oldPinInput = screen.getByLabelText("Current Temporary PIN");
    const newPinInput = screen.getByLabelText("New 4-Digit Secret PIN");
    const confirmPinInput = screen.getByLabelText("Confirm New PIN");
    const submitBtn = screen.getByRole("button", { name: /Save PIN & Continue/ });

    fireEvent.change(oldPinInput, { target: { value: "1234" } });
    fireEvent.change(newPinInput, { target: { value: "5678" } });
    fireEvent.change(confirmPinInput, { target: { value: "9999" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/New PIN and Confirm PIN do not match/)
      ).toBeTruthy();
    });
  });
});
