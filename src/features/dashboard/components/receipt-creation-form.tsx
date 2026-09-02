import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { CachedPropertyProgress } from "@/lib/offline/offline-db";

export type PaymentMode =
  | "cash"
  | "upi"
  | "cheque"
  | "bank_transfer";

export type ReceiptCreationFormProps = {
  propertyId?: string | null;
  properties?: CachedPropertyProgress[];
  donorName: string;
  donorMobile: string;
  amount: string;
  paymentMode: PaymentMode;
  paymentReference: string;
  notes: string;
  creating: boolean;
  createError: string | null;
  sessionStatus: string;
  currentReceiptNumber: number;
  startNumber?: number;
  endNumber?: number;
  onNavigateToCloseSession?: () => void;
  onPropertyIdChange?: (value: string | null) => void;
  onDonorNameChange: (value: string) => void;
  onDonorMobileChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPaymentModeChange: (value: PaymentMode) => void;
  onPaymentReferenceChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ReceiptCreationForm({
  propertyId,
  properties,
  donorName,
  donorMobile,
  amount,
  paymentMode,
  paymentReference,
  notes,
  creating,
  createError,
  sessionStatus,
  currentReceiptNumber,
  startNumber,
  endNumber,
  onNavigateToCloseSession,
  onPropertyIdChange,
  onDonorNameChange,
  onDonorMobileChange,
  onAmountChange,
  onPaymentModeChange,
  onPaymentReferenceChange,
  onNotesChange,
  onSubmit,
}: ReceiptCreationFormProps) {
  const isExhausted = endNumber !== undefined && currentReceiptNumber > endNumber;
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border bg-card p-6"
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold">
          New Receipt
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Receipt #
          {currentReceiptNumber}
        </p>
      </div>

      <div className="space-y-5">
        {/* Exhausted Receipt Book Banner */}
        {isExhausted && (
          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" role="img" aria-label="Book completed">📕</span>
              <div>
                <h3 className="text-base font-black text-amber-950 dark:text-amber-100">
                  पावती पुस्तक पूर्ण झाले
                </h3>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Receipt Book Completed
                </p>
              </div>
            </div>

            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1.5 border-t border-amber-500/20 pt-2.5">
              <p className="font-semibold text-sm">
                पावती क्रमांक #{startNumber ?? "—"}–#{endNumber ?? "—"} पर्यंत सर्व पावत्या वापरल्या आहेत.
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                All receipts in this book have been issued. Please close this collection session and complete the handover before starting with another receipt book.
              </p>
            </div>

            {onNavigateToCloseSession && (
              <Button
                type="button"
                variant="default"
                onClick={onNavigateToCloseSession}
                className="w-full h-11 rounded-xl text-xs font-bold shadow-xs cursor-pointer bg-amber-600 hover:bg-amber-700 text-white mt-2"
              >
                संकलन बंद करा / Close Collection →
              </Button>
            )}
          </div>
        )}

        {/* Optional Property / Flat Linkage */}
        {properties && properties.length > 0 && (
          <div>
            <label
              htmlFor="propertyId"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Link to Flat / Property (Optional)
            </label>

            <select
              id="propertyId"
              value={propertyId || ""}
              disabled={isExhausted || creating}
              onChange={(event) =>
                onPropertyIdChange?.(event.target.value || null)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">-- General / Non-Property Donation --</option>
              {properties.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  Flat {p.unitNumber} {p.ownerName ? `(${p.ownerName})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Donor name */}

        <div>
          <label
            htmlFor="donorName"
            className="mb-2 block text-sm font-medium"
          >
            Donor Name *
          </label>

          <Input
            id="donorName"
            value={donorName}
            disabled={isExhausted || creating}
            onChange={(event) =>
              onDonorNameChange(
                event.target.value
              )
            }
            placeholder="Enter donor name"
            required
          />
        </div>

        {/* Mobile */}

        <div>
          <label
            htmlFor="donorMobile"
            className="mb-2 block text-sm font-medium"
          >
            Mobile
          </label>

          <Input
            id="donorMobile"
            type="tel"
            value={donorMobile}
            disabled={isExhausted || creating}
            onChange={(event) =>
              onDonorMobileChange(
                event.target.value
              )
            }
            placeholder="Enter mobile number"
          />
        </div>

        {/* Amount */}

        <div>
          <label
            htmlFor="amount"
            className="mb-2 block text-sm font-medium"
          >
            Amount *
          </label>

          <Input
            id="amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            disabled={isExhausted || creating}
            onChange={(event) =>
              onAmountChange(
                event.target.value
              )
            }
            placeholder="Enter amount"
            required
          />
        </div>

        {/* Payment mode */}

        <div>
          <label
            htmlFor="paymentMode"
            className="mb-2 block text-sm font-medium"
          >
            Payment Mode *
          </label>

          <select
            id="paymentMode"
            value={paymentMode}
            disabled={isExhausted || creating}
            onChange={(event) =>
              onPaymentModeChange(
                event.target
                  .value as PaymentMode
              )
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="cash">
              Cash
            </option>

            <option value="upi">
              UPI
            </option>

            <option value="cheque">
              Cheque
            </option>

            <option value="bank_transfer">
              Bank Transfer
            </option>
          </select>
        </div>

        {/* Payment reference */}

        <div>
          <label
            htmlFor="paymentReference"
            className="mb-2 block text-sm font-medium"
          >
            Payment Reference
          </label>

          <Input
            id="paymentReference"
            value={paymentReference}
            disabled={isExhausted || creating}
            onChange={(event) =>
              onPaymentReferenceChange(
                event.target.value
              )
            }
            placeholder="UPI ID / cheque number / reference"
          />
        </div>

        {/* Notes */}

        <div>
          <label
            htmlFor="notes"
            className="mb-2 block text-sm font-medium"
          >
            Notes
          </label>

          <textarea
            id="notes"
            value={notes}
            disabled={isExhausted || creating}
            onChange={(event) =>
              onNotesChange(
                event.target.value
              )
            }
            placeholder="Optional notes"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50"
          />
        </div>

        {/* Error */}

        {createError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              {createError}
            </p>
          </div>
        )}

        {/* Submit */}

        <Button
          type="submit"
          disabled={
            creating ||
            sessionStatus !== "open" ||
            isExhausted
          }
          className="w-full"
        >
          {creating
            ? "Creating Receipt..."
            : isExhausted
              ? "📕 पावती पुस्तक पूर्ण झाले (Book Completed)"
              : sessionStatus !== "open"
                ? "Collection Session Completed"
                : `Create Receipt #${currentReceiptNumber}`}
        </Button>
      </div>
    </form>
  );
}
