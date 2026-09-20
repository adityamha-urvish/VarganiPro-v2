import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createReceiptBook,
  fetchOrganizationReceiptBooks,
  assignReceiptBook,
  type ReceiptBookAdminRecord,
  type ReceiptBookStatus,
} from "../services/receipt-book-admin.service";
import {
  fetchVolunteers,
  type VolunteerRecord,
} from "@/features/admin/volunteers/services/volunteer-admin.service";

interface ReceiptBooksManagementPanelProps {
  organizationId: string;
  eventId?: string | null;
}

export function ReceiptBooksManagementPanel({
  organizationId,
  eventId,
}: ReceiptBooksManagementPanelProps) {
  const [books, setBooks] = useState<ReceiptBookAdminRecord[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningBookId, setAssigningBookId] = useState<string | null>(null);

  // Add Book Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [bookNumber, setBookNumber] = useState("");
  const [prefix, setPrefix] = useState("VP-");
  const [startNumber, setStartNumber] = useState("");
  const [endNumber, setEndNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [booksData, volsData] = await Promise.all([
        fetchOrganizationReceiptBooks(organizationId, eventId),
        fetchVolunteers(organizationId).catch((err) => {
          console.warn("Could not load volunteers for assignment:", err);
          return [] as VolunteerRecord[];
        }),
      ]);
      setBooks(booksData);
      setVolunteers(volsData);
    } catch (err: unknown) {
      console.error("Error loading receipt books:", err);
      setError(err instanceof Error ? err.message : "Failed to load receipt books");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [organizationId, eventId]);

  const handleAssignVolunteer = async (bookId: string, volunteerId: string | null) => {
    setAssigningBookId(bookId);
    setError(null);
    try {
      await assignReceiptBook(bookId, volunteerId);
      await loadData();
    } catch (err: unknown) {
      console.error("Assign volunteer error:", err);
      setError(err instanceof Error ? err.message : "Failed to assign volunteer");
    } finally {
      setAssigningBookId(null);
    }
  };


  // Derived Preview calculation
  const parsedStart = parseInt(startNumber, 10);
  const parsedEnd = parseInt(endNumber, 10);
  const isValidRange =
    !isNaN(parsedStart) &&
    !isNaN(parsedEnd) &&
    parsedStart >= 1 &&
    parsedEnd > parsedStart;
  const totalLeaves = isValidRange ? parsedEnd - parsedStart + 1 : 0;
  const cleanPrefix = prefix.trim() ? prefix.trim().toUpperCase() : "VP-";
  const cleanBookNo = bookNumber.trim() || "Book #";

  const handleOpenModal = () => {
    setFormError(null);
    // Suggest next logical book number and start number based on existing books
    if (books.length > 0) {
      const maxEnd = Math.max(...books.map((b) => b.endNumber), 0);
      setBookNumber(`BK-${String(books.length + 1).padStart(2, "0")}`);
      setStartNumber(String(maxEnd + 1));
      setEndNumber(String(maxEnd + 100));
    } else {
      setBookNumber("BK-01");
      setStartNumber("1");
      setEndNumber("100");
    }
    setShowAddModal(true);
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!bookNumber.trim()) {
      setFormError("Book identifier is required (e.g. BK-02 or Book 2)");
      return;
    }

    if (!isValidRange) {
      setFormError("End receipt number must be strictly greater than start receipt number");
      return;
    }

    if (totalLeaves > 1000) {
      setFormError("Maximum allowed receipts per book is 1,000");
      return;
    }

    if (!eventId) {
      setFormError("No active festival event found for this Mandal");
      return;
    }

    setSubmitting(true);
    try {
      await createReceiptBook({
        organizationId,
        eventId,
        bookNumber: bookNumber.trim(),
        prefix: cleanPrefix,
        startNumber: parsedStart,
        endNumber: parsedEnd,
      });

      setShowAddModal(false);
      setBookNumber("");
      setStartNumber("");
      setEndNumber("");
      await loadData();
    } catch (err: unknown) {
      console.error("Create receipt book error:", err);
      setFormError(err instanceof Error ? err.message : "Failed to create receipt book");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: ReceiptBookStatus) => {
    switch (status) {
      case "available":
        return (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            ● Ready
          </span>
        );
      case "assigned":
        return (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
            ● Assigned
          </span>
        );
      case "checked_out":
        return (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            ⚡ Active
          </span>
        );
      case "exhausted":
        return (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-slate-200 text-slate-700 border border-slate-300">
            ✓ Exhausted
          </span>
        );
      case "closed":
        return (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
            ✓ Closed
          </span>
        );
      default:
        return (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span>📚</span> Receipt Books • पावती पुस्तके
          </h2>
          <p className="text-xs text-muted-foreground">
            Register physical paper books, monitor remaining leaves, and audit assignment.
          </p>
        </div>

        <Button
          type="button"
          data-testid="add-receipt-book-btn"
          onClick={handleOpenModal}
          className="font-bold text-xs gap-1.5 cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <span>+</span> Register New Book
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* Roster Card */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Physical Receipt Books ({books.length})
          </CardTitle>
          <button
            type="button"
            onClick={loadData}
            className="text-xs text-primary font-semibold hover:underline cursor-pointer"
          >
            ↻ Refresh
          </button>
        </CardHeader>

        <CardContent className="p-0 divide-y">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading receipt books...
            </div>
          ) : books.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-3xl">📚</p>
              <p className="text-xs font-bold text-slate-700">No physical receipt books registered</p>
              <p className="text-[11px] text-muted-foreground">
                Register your Mandal&apos;s first physical receipt book to begin door-to-door collection.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleOpenModal}
                className="mt-2 font-bold text-xs cursor-pointer"
              >
                + Register First Book
              </Button>
            </div>
          ) : (
            books.map((book) => {
              const capacity = Math.max(1, book.endNumber - book.startNumber + 1);
              const used = Math.min(
                capacity,
                Math.max(0, book.currentNumber - book.startNumber)
              );
              const percentUsed = Math.min(100, Math.round((used / capacity) * 100));
              const remainingLeaves = Math.max(0, book.endNumber - book.currentNumber + 1);

              return (
                <div
                  key={book.receiptBookId}
                  data-testid={`receipt-book-row-${book.bookNumber}`}
                  className="p-4 hover:bg-slate-50/80 transition-colors space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900">
                          {book.bookNumber}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {book.prefix}{book.startNumber} → {book.prefix}{book.endNumber}
                        </span>
                        {getStatusBadge(book.status)}
                      </div>
                      {book.assignedVolunteerName && (
                        <p className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                          <span>👤 Handled by:</span>
                          <span className="font-bold text-slate-800">
                            {book.assignedVolunteerName}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="text-left sm:text-right text-xs">
                      <span className="text-muted-foreground block text-[11px]">Total Collection</span>
                      <span className="font-black text-slate-900 text-sm">
                        ₹{book.totalAmountCollected.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Progress & Leaves Count */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span>
                        Leaf {book.currentNumber > book.endNumber ? book.endNumber : book.currentNumber} of {book.endNumber} ({used}/{capacity} used)
                      </span>
                      <span className={remainingLeaves <= 10 && remainingLeaves > 0 ? "text-amber-600 font-bold" : ""}>
                        {remainingLeaves === 0 ? "0 remaining (Exhausted)" : `${remainingLeaves} leaves remaining`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          book.status === "exhausted"
                            ? "bg-slate-400"
                            : percentUsed >= 90
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                  </div>

                  {/* Volunteer Assignment Controls */}
                  {(book.status === "available" || book.status === "assigned") && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="font-bold">Assign Volunteer:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          data-testid={`assign-select-${book.bookNumber}`}
                          disabled={assigningBookId === book.receiptBookId}
                          value={book.assignedVolunteerId || ""}
                          onChange={(e) =>
                            handleAssignVolunteer(
                              book.receiptBookId,
                              e.target.value ? e.target.value : null
                            )
                          }
                          className="h-8 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-primary focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Available (Unassigned) --</option>
                          {volunteers
                            .filter((v) => v.status === "active")
                            .map((v) => (
                              <option key={v.volunteerId} value={v.volunteerId}>
                                👤 {v.fullName} ({v.mobile})
                              </option>
                            ))}
                        </select>
                        {assigningBookId === book.receiptBookId && (
                          <span className="text-[11px] text-amber-700 font-bold animate-pulse">
                            Saving...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>


      {/* Register Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>➕</span> Register Physical Receipt Book
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add a physical printed receipt book to your Mandal&apos;s inventory.
              </p>
            </CardHeader>

            <CardContent>
              {formError && (
                <div
                  data-testid="receipt-book-form-error"
                  className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium"
                >
                  ⚠️ {formError}
                </div>
              )}

              <form onSubmit={handleCreateBook} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bookNo" className="text-xs font-bold text-slate-700">
                      Book Identifier *
                    </Label>
                    <Input
                      id="bookNo"
                      data-testid="input-book-number"
                      placeholder="e.g. BK-02 or Book 2"
                      value={bookNumber}
                      onChange={(e) => setBookNumber(e.target.value)}
                      className="mt-1 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bookPrefix" className="text-xs font-bold text-slate-700">
                      Series / Prefix *
                    </Label>
                    <Input
                      id="bookPrefix"
                      data-testid="input-book-prefix"
                      placeholder="e.g. VP-"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      className="mt-1 font-mono font-bold uppercase"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="startNum" className="text-xs font-bold text-slate-700">
                      Start Number *
                    </Label>
                    <Input
                      id="startNum"
                      data-testid="input-start-number"
                      type="number"
                      min={1}
                      placeholder="e.g. 101"
                      value={startNumber}
                      onChange={(e) => setStartNumber(e.target.value)}
                      className="mt-1 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="endNum" className="text-xs font-bold text-slate-700">
                      End Number *
                    </Label>
                    <Input
                      id="endNum"
                      data-testid="input-end-number"
                      type="number"
                      min={1}
                      placeholder="e.g. 200"
                      value={endNumber}
                      onChange={(e) => setEndNumber(e.target.value)}
                      className="mt-1 font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs space-y-1">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-amber-900 block">
                    📋 Physical Book Preview
                  </span>
                  <p className="font-mono font-bold text-sm text-slate-900">
                    {cleanPrefix} — {cleanBookNo} — {isValidRange ? `${parsedStart} to ${parsedEnd}` : "Invalid Range"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isValidRange
                      ? `Total capacity: ${totalLeaves} receipts • Starts with status: Ready`
                      : "Enter start and end numbers to compute capacity."}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    data-testid="submit-create-book-btn"
                    disabled={submitting || !isValidRange || !bookNumber.trim()}
                    className="flex-1 font-bold text-xs cursor-pointer"
                  >
                    {submitting ? "Registering Book..." : "Register Physical Book ⚡"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddModal(false)}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
