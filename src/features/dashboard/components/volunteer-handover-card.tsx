import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type VolunteerHandoverData = {
  id: string;
  receiptCount: number;
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  chequeAmount: number;
  bankTransferAmount: number;
  status: string;
};

export type VolunteerHandoverCardProps = {
  handover: VolunteerHandoverData | null;
  creatingHandover: boolean;
  submittingHandover: boolean;
  actualCashAmount: string;
  actualUpiAmount: string;
  actualChequeAmount: string;
  actualBankTransferAmount: string;
  handoverNotes: string;
  handoverError: string | null;
  handoverMessage: string | null;
  onCreateHandover: () => void;
  onSubmitHandover: () => void;
  onActualCashAmountChange: (value: string) => void;
  onActualUpiAmountChange: (value: string) => void;
  onActualChequeAmountChange: (value: string) => void;
  onActualBankTransferAmountChange: (value: string) => void;
  onHandoverNotesChange: (value: string) => void;
};

export function VolunteerHandoverCard({
  handover,
  creatingHandover,
  submittingHandover,
  actualCashAmount,
  actualUpiAmount,
  actualChequeAmount,
  actualBankTransferAmount,
  handoverNotes,
  handoverError,
  handoverMessage,
  onCreateHandover,
  onSubmitHandover,
  onActualCashAmountChange,
  onActualUpiAmountChange,
  onActualChequeAmountChange,
  onActualBankTransferAmountChange,
  onHandoverNotesChange,
}: VolunteerHandoverCardProps) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Collection Handover</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the handover record from the completed collection session.
          </p>
        </div>

        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
          {handover?.status ?? "Not Created"}
        </span>
      </div>

      {!handover && (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">
            Expected collection will be calculated directly from the server receipts.
          </p>

          <div className="mt-4">
            <Button
              type="button"
              onClick={onCreateHandover}
              disabled={creatingHandover}
            >
              {creatingHandover
                ? "Creating Handover..."
                : "Create Handover"}
            </Button>
          </div>
        </div>
      )}

      {handover && (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Expected Receipts</p>
              <p className="mt-1 text-2xl font-bold">{handover.receiptCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Expected Total</p>
              <p className="mt-1 text-2xl font-bold">₹{handover.totalAmount.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Expected Cash</p>
              <p className="mt-1 text-xl font-bold">₹{handover.cashAmount.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Expected UPI</p>
              <p className="mt-1 text-xl font-bold">₹{handover.upiAmount.toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Expected Cheque</p>
              <p className="font-semibold">₹{handover.chequeAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Bank Transfer</p>
              <p className="font-semibold">₹{handover.bankTransferAmount.toFixed(2)}</p>
            </div>
            <div className="lg:col-span-2">
              <p className="text-sm text-muted-foreground">Handover ID</p>
              <p className="truncate font-mono text-xs">{handover.id}</p>
            </div>
          </div>

          {(handover.status === "pending" || handover.status === "rejected") && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-semibold">Actual Handover</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the amounts actually handed over.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ["actual-cash-amount", "Actual Cash", actualCashAmount, onActualCashAmountChange, handover.cashAmount],
                  ["actual-upi-amount", "Actual UPI", actualUpiAmount, onActualUpiAmountChange, handover.upiAmount],
                  ["actual-cheque-amount", "Actual Cheque", actualChequeAmount, onActualChequeAmountChange, handover.chequeAmount],
                  ["actual-bank-transfer-amount", "Actual Bank Transfer", actualBankTransferAmount, onActualBankTransferAmountChange, handover.bankTransferAmount],
                ].map(([id, label, value, setter, expected]) => (
                  <div key={String(id)}>
                    <label htmlFor={String(id)} className="mb-2 block text-sm font-medium">
                      {String(label)}
                    </label>
                    <Input
                      id={String(id)}
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(value)}
                      onChange={(event) =>
                        (setter as (val: string) => void)(event.target.value)
                      }
                      placeholder="0.00"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expected: ₹{Number(expected).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Actual Total</span>
                  <span className="text-xl font-bold">
                    ₹{(
                      Number(actualCashAmount || 0) +
                      Number(actualUpiAmount || 0) +
                      Number(actualChequeAmount || 0) +
                      Number(actualBankTransferAmount || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Difference</span>
                  <span className="font-semibold">
                    ₹{(
                      Number(actualCashAmount || 0) +
                      Number(actualUpiAmount || 0) +
                      Number(actualChequeAmount || 0) +
                      Number(actualBankTransferAmount || 0) -
                      handover.totalAmount
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="handover-notes" className="mb-2 block text-sm font-medium">
                  Notes
                </label>
                <textarea
                  id="handover-notes"
                  value={handoverNotes}
                  onChange={(event) => onHandoverNotesChange(event.target.value)}
                  rows={3}
                  placeholder="Optional notes about the handover"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={onSubmitHandover}
                  disabled={submittingHandover}
                >
                  {submittingHandover ? "Submitting Handover..." : "Submit Handover"}
                </Button>
              </div>
            </div>
          )}

          {handover.status === "submitted" && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="font-medium text-blue-800">
                Handover submitted and awaiting admin verification.
              </p>
            </div>
          )}

          {handover.status === "verified" && (
            <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="font-medium text-green-800">
                Handover has been verified.
              </p>
            </div>
          )}
        </div>
      )}

      {handoverError && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{handoverError}</p>
        </div>
      )}

      {handoverMessage && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">{handoverMessage}</p>
        </div>
      )}
    </div>
  );
}
