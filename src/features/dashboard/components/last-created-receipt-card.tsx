import { Button } from "@/components/ui/button";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import { getStatusLabel } from "./receipt-history-panel";

export type LastCreatedReceiptCardProps = {
  receipt: LocalReceipt | null;
  onViewReceipt: (receipt: LocalReceipt) => void;
  onPrintReceipt: (receipt: LocalReceipt) => void;
};

export function LastCreatedReceiptCard({
  receipt,
  onViewReceipt,
  onPrintReceipt,
}: LastCreatedReceiptCardProps) {
  if (!receipt) {
    return null;
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-green-700">
            Receipt created
          </p>

          <p className="mt-1 text-2xl font-bold text-green-800">
            #{receipt.receiptNumber}
          </p>

          <p className="mt-1 text-sm text-green-700">
            {receipt.donorName} — ₹
            {receipt.amount.toFixed(2)}
          </p>

          <p className="mt-2 text-xs text-green-700">
            Status:{" "}
            {getStatusLabel(
              receipt.syncStatus
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onViewReceipt(receipt)
            }
          >
            View Receipt
          </Button>

          <Button
            type="button"
            onClick={() =>
              onPrintReceipt(receipt)
            }
          >
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
