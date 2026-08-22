import { Button } from "@/components/ui/button";
import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

export type SessionSummaryCardProps = {
  session: CollectionSessionContext;
  receiptCount: number;
  totalAmount: number;
  pendingCount: number;
  conflictCount: number;
  cashAmount: number;
  upiAmount: number;
  chequeAmount: number;
  bankTransferAmount: number;
  closingSession: boolean;
  sessionCloseError: string | null;
  sessionCloseMessage: string | null;
  onCloseSession: () => void;
};

export function SessionSummaryCard({
  session,
  receiptCount,
  totalAmount,
  pendingCount,
  conflictCount,
  cashAmount,
  upiAmount,
  chequeAmount,
  bankTransferAmount,
  closingSession,
  sessionCloseError,
  sessionCloseMessage,
  onCloseSession,
}: SessionSummaryCardProps) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">
          Collection
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {session.bookNumber}
        </p>
      </div>

      {/* Session information */}

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Receipt Book
            </p>

            <p className="text-lg font-semibold">
              {session.prefix}
              {session.currentNumber}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Available Range
            </p>

            <p className="font-medium">
              {session.startNumber} –{" "}
              {session.endNumber}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Status
            </p>

            <p className="font-medium">
              {session.bookStatus}
            </p>
          </div>
        </div>
      </div>

      {/* ----------------------------------------
          SESSION SUMMARY
      ----------------------------------------- */}

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Session Summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Collection summary for this session
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              session.sessionStatus === "open"
                ? "bg-green-100 text-green-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {session.sessionStatus === "open" ? "Open" : "Completed"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Receipts</p>
            <p className="mt-1 text-2xl font-bold">
              {receiptCount}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Collection</p>
            <p className="mt-1 text-2xl font-bold">
              ₹{totalAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Pending Sync</p>
            <p className="mt-1 text-2xl font-bold">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Conflicts</p>
            <p className="mt-1 text-2xl font-bold">
              {conflictCount}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Cash</p>
            <p className="font-semibold">₹{cashAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">UPI</p>
            <p className="font-semibold">₹{upiAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cheque</p>
            <p className="font-semibold">₹{chequeAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bank Transfer</p>
            <p className="font-semibold">
              ₹{bankTransferAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {sessionCloseError && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{sessionCloseError}</p>
          </div>
        )}

        {sessionCloseMessage && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-700">{sessionCloseMessage}</p>
          </div>
        )}

        {session.sessionStatus === "open" && (
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCloseSession}
              disabled={
                closingSession ||
                pendingCount > 0 ||
                conflictCount > 0
              }
            >
              {closingSession
                ? "Closing Session..."
                : "Close Collection Session"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
