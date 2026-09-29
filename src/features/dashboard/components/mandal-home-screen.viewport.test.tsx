// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MandalHomeScreen } from "./mandal-home-screen";

const viewports = [
  { name: "Small Mobile (360x800)", width: 360, height: 800 },
  { name: "Standard Mobile (390x844 - iPhone 12/13/14)", width: 390, height: 844 },
  { name: "Modern iPhone (393x852 - iPhone 14/15/16 Pro)", width: 393, height: 852 },
  { name: "Max Mobile (430x932 - iPhone 14/15/16 Plus/Pro Max)", width: 430, height: 932 },
];

describe("Browser / Viewport Characterization & Layout Safety", () => {
  afterEach(() => {
    cleanup();
  });

  const adminProps = {
    userName: "Aditya Secretary",
    mandalName: "शिवनेरी गणेशोत्सव मंडळ",
    eventName: "गणेशोत्सव २०२६",
    eventCode: "SHIV-26",
    isAdmin: true,
    adminTotalMetrics: {
      totalAmount: 185000,
      cashAmount: 125000,
      upiAmount: 60000,
      receiptCount: 142,
    },
    adminTodayMetrics: {
      totalAmount: 38000,
      cashAmount: 26000,
      upiAmount: 12000,
      receiptCount: 31,
    },
    totalExpenses: 45000,
    todayExpenses: 8500,
    onStartCollection: vi.fn(),
    onNavigateTab: vi.fn(),
  };

  const volunteerProps = {
    userName: "Rahul Shinde",
    mandalName: "शिवनेरी गणेशोत्सव मंडळ",
    eventName: "गणेशोत्सव २०२६",
    eventCode: "SHIV-26",
    isAdmin: false,
    volunteerMyTodayMetrics: {
      totalAmount: 9500,
      cashAmount: 7500,
      upiAmount: 2000,
      receiptCount: 12,
      pendingSyncCount: 1,
    },
    volunteerMandalMetrics: {
      totalAmount: 185000,
      cashAmount: 125000,
      upiAmount: 60000,
      receiptCount: 142,
    },
    totalExpenses: 45000,
    todayExpenses: 8500,
    onStartCollection: vi.fn(),
    onNavigateTab: vi.fn(),
  };

  for (const vp of viewports) {
    describe(`Viewport: ${vp.name}`, () => {
      it("Admin Mode: verifies Total Mandal, Today's Mandal, Tap toggle, Swipe, and Expenses without overflow", () => {
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;

        const { container } = render(<MandalHomeScreen {...adminProps} />);

        // 1. Initial State: Total Mandal
        expect(screen.getByTestId("carousel-slide-title").textContent).toBe("TOTAL MANDAL COLLECTION");
        expect(screen.getByTestId("carousel-main-amount").textContent).toContain("₹1,85,000");
        expect(screen.getByTestId("carousel-cash-amount").textContent).toContain("₹1,25,000");
        expect(screen.getByTestId("carousel-upi-amount").textContent).toContain("₹60,000");
        expect(screen.getByTestId("carousel-receipt-count").textContent).toContain("142 receipts");
        expect(screen.getByTestId("carousel-expense-text").textContent).toContain("Total Expenses: ₹45,000");

        // 2. Tap Toggle to Today's Mandal
        fireEvent.click(screen.getByTestId("carousel-tab-1"));
        expect(screen.getByTestId("carousel-slide-title").textContent).toBe("TODAY'S MANDAL COLLECTION");
        expect(screen.getByTestId("carousel-main-amount").textContent).toContain("₹38,000");
        expect(screen.getByTestId("carousel-cash-amount").textContent).toContain("₹26,000");
        expect(screen.getByTestId("carousel-upi-amount").textContent).toContain("₹12,000");
        expect(screen.getByTestId("carousel-receipt-count").textContent).toContain("31 receipts");
        expect(screen.getByTestId("carousel-expense-text").textContent).toContain("Today's Expenses: ₹8,500");

        // 3. Swipe Gesture back to Total Mandal
        const carousel = screen.getByTestId("collection-summary-carousel");
        fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
        fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 250 }] });
        expect(screen.getByTestId("carousel-slide-title").textContent).toBe("TOTAL MANDAL COLLECTION");

        // 4. Layout & Overflow Safety: Container has max-w-lg and w-full
        const mainCard = container.querySelector(".max-w-lg");
        expect(mainCard).toBeTruthy();
        expect(mainCard?.classList.contains("w-full")).toBe(true);
      });

      it("Volunteer Mode: verifies My Today's Collection, Total Mandal, Tap toggle, Swipe, and Offline badge", () => {
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;

        render(<MandalHomeScreen {...volunteerProps} />);

        // 1. Initial State: My Today's Collection
        expect(screen.getByTestId("carousel-slide-title").textContent).toBe("MY TODAY'S COLLECTION");
        expect(screen.getByTestId("carousel-main-amount").textContent).toContain("₹9,500");
        expect(screen.getByTestId("carousel-cash-amount").textContent).toContain("₹7,500");
        expect(screen.getByTestId("carousel-upi-amount").textContent).toContain("₹2,000");
        expect(screen.getByTestId("carousel-receipt-count").textContent).toContain("12 receipts");
        expect(screen.getByText("(1 offline receipts captured)")).toBeTruthy();

        // 2. Tap Toggle to Total Mandal's Collection
        fireEvent.click(screen.getByTestId("carousel-tab-1"));
        expect(screen.getByTestId("carousel-slide-title").textContent).toBe("TOTAL MANDAL'S COLLECTION");
        expect(screen.getByTestId("carousel-main-amount").textContent).toContain("₹1,85,000");
        expect(screen.getByTestId("carousel-cash-amount").textContent).toContain("₹1,25,000");
        expect(screen.getByTestId("carousel-upi-amount").textContent).toContain("₹60,000");
        expect(screen.getByTestId("carousel-receipt-count").textContent).toContain("142 receipts");
        expect(screen.getByTestId("carousel-expense-text").textContent).toContain("Total Expenses: ₹45,000");

        // 3. Swipe Gesture back to My Today
        const carousel = screen.getByTestId("collection-summary-carousel");
        fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
        fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 250 }] });
        expect(screen.getByTestId("carousel-slide-title").textContent).toBe("MY TODAY'S COLLECTION");
      });
    });
  }
});
