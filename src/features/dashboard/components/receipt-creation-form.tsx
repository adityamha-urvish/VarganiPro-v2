import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PaymentMode =
  | "cash"
  | "upi"
  | "cheque"
  | "bank_transfer";

export type ReceiptCreationFormProps = {
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
  onDonorNameChange: (value: string) => void;
  onDonorMobileChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPaymentModeChange: (value: PaymentMode) => void;
  onPaymentReferenceChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ReceiptCreationForm({
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
  onDonorNameChange,
  onDonorMobileChange,
  onAmountChange,
  onPaymentModeChange,
  onPaymentReferenceChange,
  onNotesChange,
  onSubmit,
}: ReceiptCreationFormProps) {
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
            onChange={(event) =>
              onPaymentModeChange(
                event.target
                  .value as PaymentMode
              )
            }
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
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
            onChange={(event) =>
              onNotesChange(
                event.target.value
              )
            }
            placeholder="Optional notes"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
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
            sessionStatus !== "open"
          }
          className="w-full"
        >
          {creating
            ? "Creating Receipt..."
            : sessionStatus !== "open"
              ? "Collection Session Completed"
              : `Create Receipt #${currentReceiptNumber}`}
        </Button>
      </div>
    </form>
  );
}
