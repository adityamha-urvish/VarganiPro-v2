import { Button } from "@/components/ui/button";
import type { LocalReceipt } from "@/lib/offline/offline-db";

type ReceiptPreviewDialogProps = {
  receipt: LocalReceipt | null;
  receiptPrefix: string;
  bookNumber: string;
  onClose: () => void;
  onPrint: (receipt: LocalReceipt) => void;
};

export function ReceiptPreviewDialog({
  receipt,
  receiptPrefix,
  bookNumber,
  onClose,
  onPrint,
}: ReceiptPreviewDialogProps) {
  if (!receipt) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Receipt ${receipt.receiptNumber}`}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-background shadow-xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold">
              Receipt Details
            </h2>
            <p className="text-sm text-muted-foreground">
              {receiptPrefix}
              {receipt.receiptNumber}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onPrint(
                  receipt
                )
              }
            >
              Print
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

        <div
          id="receipt-print-area"
          className="receipt-print-area p-8"
        >
          <div className="text-center">
            <p className="text-2xl font-bold">
              VARGANIPRO
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Donation Receipt
            </p>

            <div className="mt-6 border-y py-4">
              <p className="text-sm text-muted-foreground">
                Receipt Number
              </p>

              <p className="mt-1 text-3xl font-bold">
                {receiptPrefix}
                {receipt.receiptNumber}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex justify-between gap-6">
              <span className="text-sm text-muted-foreground">
                Donor Name
              </span>
              <span className="text-right font-medium">
                {receipt.donorName}
              </span>
            </div>

            {receipt.donorMobile && (
              <div className="flex justify-between gap-6">
                <span className="text-sm text-muted-foreground">
                  Mobile
                </span>
                <span className="text-right font-medium">
                  {receipt.donorMobile}
                </span>
              </div>
            )}

            <div className="flex justify-between gap-6">
              <span className="text-sm text-muted-foreground">
                Amount
              </span>
              <span className="text-right text-xl font-bold">
                ₹{receipt.amount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between gap-6">
              <span className="text-sm text-muted-foreground">
                Payment Mode
              </span>
              <span className="text-right font-medium capitalize">
                {receipt.paymentMode.replace(
                  "_",
                  " "
                )}
              </span>
            </div>

            {receipt.paymentReference && (
              <div className="flex justify-between gap-6">
                <span className="text-sm text-muted-foreground">
                  Reference
                </span>
                <span className="max-w-[60%] break-words text-right font-medium">
                  {receipt.paymentReference}
                </span>
              </div>
            )}

            <div className="flex justify-between gap-6">
              <span className="text-sm text-muted-foreground">
                Date & Time
              </span>
              <span className="text-right font-medium">
                {new Date(
                  receipt.createdAt
                ).toLocaleString()}
              </span>
            </div>
          </div>

          {receipt.notes && (
            <div className="mt-6 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Notes
              </p>
              <p className="mt-1 text-sm">
                {receipt.notes}
              </p>
            </div>
          )}

          <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
            <p>
              Receipt Book: {bookNumber}
            </p>
            <p className="mt-1">
              Thank you for your contribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
