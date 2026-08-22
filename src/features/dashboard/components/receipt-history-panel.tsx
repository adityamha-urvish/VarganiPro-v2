import { Button } from "@/components/ui/button";
import type { LocalReceipt } from "@/lib/offline/offline-db";

export function getStatusLabel(
  status: LocalReceipt["syncStatus"]
) {
  switch (status) {
    case "pending":
      return "Pending";

    case "syncing":
      return "Syncing";

    case "synced":
      return "Synced";

    case "conflict":
      return "Conflict";

    default:
      return status;
  }
}

export function getStatusClass(
  status: LocalReceipt["syncStatus"]
) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";

    case "syncing":
      return "bg-blue-100 text-blue-800";

    case "synced":
      return "bg-green-100 text-green-800";

    case "conflict":
      return "bg-red-100 text-red-800";

    default:
      return "bg-muted text-muted-foreground";
  }
}

export type ReceiptHistoryPanelProps = {
  receipts: LocalReceipt[];
  receiptPrefix: string;
  sessionStatus: string;
  loading: boolean;
  onRefresh: () => void;
  onSyncNext: () => void;
  onViewReceipt: (receipt: LocalReceipt) => void;
  onPrintReceipt: (receipt: LocalReceipt) => void;
};

export function ReceiptHistoryPanel({
  receipts,
  receiptPrefix,
  sessionStatus,
  loading,
  onRefresh,
  onSyncNext,
  onViewReceipt,
  onPrintReceipt,
}: ReceiptHistoryPanelProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Receipt History
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Receipts stored on this device
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </Button>

          <Button
            type="button"
            onClick={onSyncNext}
            disabled={
              loading ||
              sessionStatus !== "open"
            }
          >
            Sync Next
          </Button>
        </div>
      </div>

      {loading &&
      receipts.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          Loading receipt history...
        </div>
      ) : receipts.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          No local receipts found for this
          receipt book.
        </div>
      ) : (
        <div className="divide-y">
          {receipts.map((receipt) => (
            <div
              key={receipt.clientReceiptId}
              className="p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Receipt identity */}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-semibold">
                      #{receipt.receiptNumber}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                        receipt.syncStatus
                      )}`}
                    >
                      {getStatusLabel(
                        receipt.syncStatus
                      )}
                    </span>
                  </div>

                  <p className="mt-1 font-medium">
                    {receipt.donorName}
                  </p>

                  {receipt.donorMobile && (
                    <p className="text-sm text-muted-foreground">
                      {receipt.donorMobile}
                    </p>
                  )}
                </div>

                {/* Amount */}

                <div className="lg:text-right">
                  <p className="text-lg font-semibold">
                    ₹
                    {receipt.amount.toFixed(
                      2
                    )}
                  </p>

                  <p className="text-sm capitalize text-muted-foreground">
                    {receipt.paymentMode.replace(
                      "_",
                      " "
                    )}
                  </p>
                </div>
              </div>

              {/* Additional details */}

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">
                    Receipt
                  </p>

                  <p className="font-medium">
                    {receiptPrefix}
                    {receipt.receiptNumber}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">
                    Created
                  </p>

                  <p className="font-medium">
                    {new Date(
                      receipt.createdAt
                    ).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">
                    Sync Attempts
                  </p>

                  <p className="font-medium">
                    {receipt.syncAttempts}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">
                    Reference
                  </p>

                  <p className="truncate font-medium">
                    {receipt.paymentReference ||
                      "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onViewReceipt(receipt)
                  }
                >
                  View Receipt
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    onPrintReceipt(receipt)
                  }
                >
                  Print Receipt
                </Button>
              </div>

              {/* Sync error */}

              {receipt.lastSyncError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-700">
                    Sync error
                  </p>

                  <p className="mt-1 text-sm text-red-600">
                    {receipt.lastSyncError}
                  </p>
                </div>
              )}

              {/* Notes */}

              {receipt.notes && (
                <div className="mt-4 rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Notes
                  </p>

                  <p className="mt-1 text-sm">
                    {receipt.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
