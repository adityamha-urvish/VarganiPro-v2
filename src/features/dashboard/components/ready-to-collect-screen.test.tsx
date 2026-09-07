// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  ReadyToCollectScreen,
} from "./ready-to-collect-screen";
import type {
  StartCollectionEvent,
  StartCollectionBook,
} from "./start-collection-card";

const mockEvents: StartCollectionEvent[] = [
  {
    id: "event-1",
    name: "Ganesh Utsav 2026",
    code: "GU26",
    start_date: "2026-09-01",
    end_date: "2026-09-10",
  },
  {
    id: "event-2",
    name: "Navratri 2026",
    code: "NV26",
    start_date: "2026-10-01",
    end_date: "2026-10-10",
  },
];

const mockBooks: StartCollectionBook[] = [
  {
    id: "book-1",
    book_number: "BOOK-01",
    prefix: "VP-",
    start_number: 1,
    end_number: 100,
    current_number: 1,
    status: "available",
    event_id: "event-1",
  },
  {
    id: "book-2",
    book_number: "BOOK-02",
    prefix: "VP-",
    start_number: 101,
    end_number: 200,
    current_number: 101,
    status: "available",
    event_id: "event-1",
  },
];

describe("ReadyToCollectScreen Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // 1. State A: Standard New Session
  it("renders State A (Standard New Session) with 2x2 grid, brand headers and action button", () => {
    const onStart = vi.fn();
    render(
      <ReadyToCollectScreen
        state="new"
        events={mockEvents}
        books={mockBooks}
        selectedEventId="event-1"
        selectedBookId="book-1"
        onStartCollection={onStart}
      />
    );

    expect(screen.getByRole("heading", { name: "Ready to Collect?" })).toBeDefined();
    expect(screen.getByText("सुरू करायचे?")).toBeDefined();
    expect(screen.getByLabelText("Event")).toBeDefined();
    expect(screen.getByLabelText("Receipt Book")).toBeDefined();
    expect(screen.getByText("Receipt Range")).toBeDefined();
    expect(screen.getByText("VP-1 – VP-100")).toBeDefined();
    expect(screen.getByText("100 Receipts")).toBeDefined();

    const startBtn = screen.getByRole("button", { name: /Start Collection/i });
    expect(startBtn).toBeDefined();
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  // 2. State B: Resume Paused Session
  it("renders State B (Paused / Resume Collection) with active in-progress badge and resume CTA", () => {
    const onStart = vi.fn();
    render(
      <ReadyToCollectScreen
        state="paused"
        eventName="Ganesh Utsav 2026"
        eventCode="GU26"
        bookNumber="VP-14"
        bookPrefix="VP-"
        startNumber={1}
        endNumber={50}
        currentNumber={19}
        remainingCount={32}
        areaName="Sector 4"
        buildingName="Shree Krupa"
        collectedFlats={14}
        totalFlats={24}
        onStartCollection={onStart}
      />
    );

    expect(screen.getByText(/Active In-Progress/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeDefined();
    expect(screen.getByText("पुढे सुरू ठेवा")).toBeDefined();
    expect(screen.getByText("Shree Krupa")).toBeDefined();
    expect(screen.getByText("14/24 Flats Done")).toBeDefined();
    expect(screen.getByText("32 Receipts")).toBeDefined();

    const continueBtn = screen.getByRole("button", { name: /Continue Collection/i });
    expect(continueBtn).toBeDefined();
    fireEvent.click(continueBtn);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  // 3. State C: Low Stock Warning
  it("renders State C (Low Stock Warning) when 5 or fewer receipts remain", () => {
    const onStart = vi.fn();
    render(
      <ReadyToCollectScreen
        state="low_stock"
        eventName="Ganesh Utsav 2026"
        eventCode="GU26"
        bookNumber="VP-14"
        remainingCount={4}
        onStartCollection={onStart}
      />
    );

    expect(screen.getByText(/Low Stock · 4 Left/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: "Receipt Book Low" })).toBeDefined();
    expect(screen.getByText("4 पावत्या शिल्लक आहेत")).toBeDefined();
    expect(screen.getByText("4 Receipts")).toBeDefined();
    expect(screen.getByText("Request next series")).toBeDefined();

    const startBtn = screen.getByRole("button", { name: /Start Collection/i });
    expect(startBtn).toBeDefined();
  });

  // 4. State D: Exhausted Receipt Book / Next Book Request
  it("renders State D (Book Complete) when remaining count is 0 and triggers next book", () => {
    const onNextBook = vi.fn();
    render(
      <ReadyToCollectScreen
        state="exhausted"
        eventName="Ganesh Utsav 2026"
        eventCode="GU26"
        bookNumber="VP-14"
        remainingCount={0}
        onRequestNextBook={onNextBook}
      />
    );

    expect(screen.getAllByText(/Book Completed/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Book Completed" })).toBeDefined();
    expect(screen.getByText("पावती पुस्तक पूर्ण भरले आहे")).toBeDefined();
    expect(screen.getByText("0 Receipts")).toBeDefined();
    expect(screen.getByText("Book Full (50/50)")).toBeDefined();

    const nextBtn = screen.getByRole("button", { name: /Get Next Book/i });
    expect(nextBtn).toBeDefined();
    fireEvent.click(nextBtn);
    expect(onNextBook).toHaveBeenCalledTimes(1);
  });

  // 5. Interactive Event & Book Selection
  it("handles event and book selection dropdown changes properly", () => {
    const onEventChange = vi.fn();
    const onBookChange = vi.fn();

    render(
      <ReadyToCollectScreen
        events={mockEvents}
        books={mockBooks}
        selectedEventId="event-1"
        selectedBookId="book-1"
        onEventChange={onEventChange}
        onBookChange={onBookChange}
      />
    );

    const eventSelect = screen.getByLabelText("Event") as HTMLSelectElement;
    fireEvent.change(eventSelect, { target: { value: "event-2" } });
    expect(onEventChange).toHaveBeenCalledWith("event-2");

    const bookSelect = screen.getByLabelText("Receipt Book") as HTMLSelectElement;
    fireEvent.change(bookSelect, { target: { value: "book-2" } });
    expect(onBookChange).toHaveBeenCalledWith("book-2");
  });

  // 6. Loading state disables button and shows loading message
  it("renders loading state correctly", () => {
    render(
      <ReadyToCollectScreen
        events={mockEvents}
        books={mockBooks}
        selectedEventId="event-1"
        selectedBookId="book-1"
        loading={true}
      />
    );

    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("Starting Collection...");
    expect(btn).toHaveProperty("disabled", true);
  });
});
