// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MandalHomeScreen } from "./mandal-home-screen";

describe("MandalHomeScreen - Collection Summary Carousel Card", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    userName: "Aditya Patil",
    mandalName: "शिवनेरी मंडळ",
    eventName: "गणेशोत्सव २०२६",
    eventCode: "SHIV-26",
    onStartCollection: vi.fn(),
    onNavigateTab: vi.fn(),
  };

  describe("ADMIN Role", () => {
    const adminProps = {
      ...defaultProps,
      isAdmin: true,
      adminTotalMetrics: {
        totalAmount: 250000,
        cashAmount: 180000,
        upiAmount: 70000,
        receiptCount: 150,
      },
      adminTodayMetrics: {
        totalAmount: 45000,
        cashAmount: 30000,
        upiAmount: 15000,
        receiptCount: 25,
      },
      totalExpenses: 60000,
      todayExpenses: 12000,
    };

    it("renders Slide 0 (Total Mandal Collection) by default with Total Expenses", () => {
      render(<MandalHomeScreen {...adminProps} />);

      expect(screen.getByTestId("carousel-slide-title").textContent).toBe(
        "TOTAL MANDAL COLLECTION"
      );
      expect(screen.getByTestId("carousel-main-amount").textContent).toContain(
        "₹2,50,000"
      );
      expect(screen.getByTestId("carousel-cash-amount").textContent).toContain(
        "₹1,80,000"
      );
      expect(screen.getByTestId("carousel-upi-amount").textContent).toContain(
        "₹70,000"
      );
      expect(screen.getByTestId("carousel-receipt-count").textContent).toContain(
        "150 receipts"
      );
      expect(screen.getByTestId("carousel-expense-text").textContent).toContain(
        "Total Expenses: ₹60,000"
      );
    });

    it("switches to Slide 1 (Today's Mandal Collection) on tab click with Today's Expenses", () => {
      render(<MandalHomeScreen {...adminProps} />);

      // Click tab 1 ("Today's")
      fireEvent.click(screen.getByTestId("carousel-tab-1"));

      expect(screen.getByTestId("carousel-slide-title").textContent).toBe(
        "TODAY'S MANDAL COLLECTION"
      );
      expect(screen.getByTestId("carousel-main-amount").textContent).toContain(
        "₹45,000"
      );
      expect(screen.getByTestId("carousel-cash-amount").textContent).toContain(
        "₹30,000"
      );
      expect(screen.getByTestId("carousel-upi-amount").textContent).toContain(
        "₹15,000"
      );
      expect(screen.getByTestId("carousel-receipt-count").textContent).toContain(
        "25 receipts"
      );
      expect(screen.getByTestId("carousel-expense-text").textContent).toContain(
        "Today's Expenses: ₹12,000"
      );
    });

    it("navigates to expenses tab when clicking expenses link", () => {
      const onNavigateTab = vi.fn();
      render(<MandalHomeScreen {...adminProps} onNavigateTab={onNavigateTab} />);

      fireEvent.click(screen.getByTestId("carousel-expense-text"));
      expect(onNavigateTab).toHaveBeenCalledWith("expenses");
    });
  });

  describe("VOLUNTEER Role", () => {
    const volunteerProps = {
      ...defaultProps,
      isAdmin: false,
      volunteerMyTodayMetrics: {
        totalAmount: 12000,
        cashAmount: 10000,
        upiAmount: 2000,
        receiptCount: 8,
        pendingSyncCount: 2,
      },
      volunteerMandalMetrics: {
        totalAmount: 250000,
        cashAmount: 180000,
        upiAmount: 70000,
        receiptCount: 150,
      },
      totalExpenses: 60000,
      todayExpenses: 12000,
    };

    it("renders Slide 0 (My Today's Collection) by default with offline badge", () => {
      render(<MandalHomeScreen {...volunteerProps} />);

      expect(screen.getByTestId("carousel-slide-title").textContent).toBe(
        "MY TODAY'S COLLECTION"
      );
      expect(screen.getByTestId("carousel-main-amount").textContent).toContain(
        "₹12,000"
      );
      expect(screen.getByTestId("carousel-cash-amount").textContent).toContain(
        "₹10,000"
      );
      expect(screen.getByTestId("carousel-upi-amount").textContent).toContain(
        "₹2,000"
      );
      expect(screen.getByTestId("carousel-receipt-count").textContent).toContain(
        "8 receipts"
      );
      expect(screen.getAllByText("⚡").length).toBeGreaterThan(0);
      expect(screen.getByText("(2 offline receipts captured)")).toBeTruthy();
    });

    it("switches to Slide 1 (Total Mandal's Collection) with Total Expenses", () => {
      render(<MandalHomeScreen {...volunteerProps} />);

      // Click tab 1 ("Total Mandal")
      fireEvent.click(screen.getByTestId("carousel-tab-1"));

      expect(screen.getByTestId("carousel-slide-title").textContent).toBe(
        "TOTAL MANDAL'S COLLECTION"
      );
      expect(screen.getByTestId("carousel-main-amount").textContent).toContain(
        "₹2,50,000"
      );
      expect(screen.getByTestId("carousel-cash-amount").textContent).toContain(
        "₹1,80,000"
      );
      expect(screen.getByTestId("carousel-upi-amount").textContent).toContain(
        "₹70,000"
      );
      expect(screen.getByTestId("carousel-receipt-count").textContent).toContain(
        "150 receipts"
      );
      expect(screen.getByTestId("carousel-expense-text").textContent).toContain(
        "Total Expenses: ₹60,000"
      );
    });
  });

  describe("Touch Swipe Gestures", () => {
    it("handles touch swipe left and right between slides", () => {
      render(
        <MandalHomeScreen
          {...defaultProps}
          isAdmin={true}
          adminTotalMetrics={{
            totalAmount: 100000,
            cashAmount: 80000,
            upiAmount: 20000,
            receiptCount: 50,
          }}
          adminTodayMetrics={{
            totalAmount: 20000,
            cashAmount: 15000,
            upiAmount: 5000,
            receiptCount: 10,
          }}
        />
      );

      const carousel = screen.getByTestId("collection-summary-carousel");

      // Swipe Left (deltaX = 100 - 200 = -100) -> transitions to Slide 1
      fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
      fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 100 }] });

      expect(screen.getByTestId("carousel-slide-title").textContent).toBe(
        "TODAY'S MANDAL COLLECTION"
      );

      // Swipe Right (deltaX = 250 - 100 = 150) -> transitions back to Slide 0
      fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
      fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 250 }] });

      expect(screen.getByTestId("carousel-slide-title").textContent).toBe(
        "TOTAL MANDAL COLLECTION"
      );
    });
  });
});
