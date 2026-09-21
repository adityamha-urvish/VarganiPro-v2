// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "./error-boundary";

function ProblematicComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Simulated rendering exception in child component");
  }
  return <div>Normal Component Content</div>;
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children normally when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal Component Content")).toBeTruthy();
  });

  it("catches render errors, displays fallback UI, and does not wipe localStorage auth session", () => {
    // Set a mock user session in localStorage
    localStorage.setItem("vp_user", JSON.stringify({ id: "user-123", email: "test@example.com" }));

    // Suppress console.error in test output for clean logs
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Fallback UI rendered
    expect(screen.getByText(/काहीतरी चूक झाली \(Something went wrong\)/i)).toBeTruthy();
    expect(screen.getByText("Simulated rendering exception in child component")).toBeTruthy();

    // Critical assertion: user session in localStorage must remain intact!
    expect(localStorage.getItem("vp_user")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("vp_user")!)).toEqual({
      id: "user-123",
      email: "test@example.com",
    });

    consoleErrorSpy.mockRestore();
  });

  it("allows user to retry/recover via the try again button", () => {
    let shouldThrow = true;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeTruthy();

    // Simulate fixing the issue before retry
    shouldThrow = false;
    const retryBtn = screen.getByRole("button", { name: /पुन्हा प्रयत्न करा/i });
    expect(retryBtn).toBeTruthy();

    rerender(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.click(retryBtn);
    expect(screen.getByText("Normal Component Content")).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
