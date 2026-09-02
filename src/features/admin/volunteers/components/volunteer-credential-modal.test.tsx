// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VolunteerCredentialModal } from "./volunteer-credential-modal";

describe("Phase 9-3B: VolunteerCredentialModal Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders temporary PIN for new user with one-time view badge", () => {
    render(
      <VolunteerCredentialModal
        isOpen={true}
        onClose={vi.fn()}
        volunteerName="Amit Kadam"
        mobile="9820011223"
        isNewUser={true}
        temporaryPin="8391"
        isReset={false}
      />
    );

    expect(screen.getByText("Volunteer Provisioned!")).toBeTruthy();
    expect(screen.getByText("Amit Kadam")).toBeTruthy();
    expect(screen.getByText("9820011223")).toBeTruthy();
    expect(screen.getByText("8391")).toBeTruthy();
    expect(screen.getByText("One-Time View")).toBeTruthy();
    expect(screen.getByText(/Send Details on WhatsApp/)).toBeTruthy();
  });

  it("renders existing user explanation without temporary PIN for existing user", () => {
    render(
      <VolunteerCredentialModal
        isOpen={true}
        onClose={vi.fn()}
        volunteerName="Sunil Patil"
        mobile="9820055555"
        isNewUser={false}
        temporaryPin={null}
        isReset={false}
      />
    );

    expect(screen.getByText("Existing Volunteer Linked!")).toBeTruthy();
    expect(screen.getByText("Sunil Patil")).toBeTruthy();
    expect(screen.getByText("9820055555")).toBeTruthy();
    expect(screen.queryByText("One-Time View")).toBeNull();
    expect(
      screen.getByText(/This mobile number is already active in VarganiPro/)
    ).toBeTruthy();
  });
});
