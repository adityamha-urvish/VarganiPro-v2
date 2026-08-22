import { Button } from "@/components/ui/button";

export type StartCollectionEvent = {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
};

export type StartCollectionBook = {
  id: string;
  book_number: string;
  prefix: string;
  start_number: number;
  end_number: number;
  current_number: number | null;
  status: string;
  event_id: string;
};

export type StartCollectionCardProps = {
  title?: string;
  description?: string;
  idPrefix?: string;
  events: StartCollectionEvent[];
  books: StartCollectionBook[];
  selectedEventId: string;
  selectedBookId: string;
  loading: boolean;
  error: string | null;
  onEventChange: (eventId: string) => void;
  onBookChange: (bookId: string) => void;
  onStartCollection: () => void;
};

export function StartCollectionCard({
  title = "Start Collection",
  description = "Select an active event and an available receipt book to begin collecting.",
  idPrefix = "start",
  events,
  books,
  selectedEventId,
  selectedBookId,
  loading,
  error,
  onEventChange,
  onBookChange,
  onStartCollection,
}: StartCollectionCardProps) {
  const selectedBook = books.find((item) => item.id === selectedBookId);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${idPrefix}-event`}
            className="mb-2 block text-sm font-medium"
          >
            Event
          </label>
          <select
            id={`${idPrefix}-event`}
            value={selectedEventId}
            onChange={(e) => onEventChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={loading}
          >
            <option value="">Select an event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({event.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-receipt-book`}
            className="mb-2 block text-sm font-medium"
          >
            Receipt Book
          </label>
          <select
            id={`${idPrefix}-receipt-book`}
            value={selectedBookId}
            onChange={(e) => onBookChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={loading || !selectedEventId || books.length === 0}
          >
            <option value="">
              {books.length === 0
                ? "No available receipt books"
                : "Select a receipt book"}
            </option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.book_number} — {book.prefix}
                {book.current_number ?? book.start_number}-{book.end_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBook && (
        <div className="mt-5 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Book Number</p>
              <p className="font-semibold">{selectedBook.book_number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receipt Range</p>
              <p className="font-semibold">
                {selectedBook.prefix}
                {selectedBook.current_number ?? selectedBook.start_number} –{" "}
                {selectedBook.prefix}
                {selectedBook.end_number}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold capitalize">{selectedBook.status}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          onClick={onStartCollection}
          disabled={loading || !selectedEventId || !selectedBookId}
        >
          {loading ? "Starting Collection..." : "Start Collection"}
        </Button>
      </div>
    </div>
  );
}
