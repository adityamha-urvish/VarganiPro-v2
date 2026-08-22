import { Button } from "@/components/ui/button";

export type AdminHandover = {
  id: string;
  organization_id: string;
  event_id: string;
  collection_session_id: string;
  volunteer_id: string;
  expected_receipt_count: number;
  expected_total_amount: number;
  expected_cash_amount: number;
  expected_upi_amount: number;
  expected_cheque_amount: number;
  expected_bank_transfer_amount: number;
  actual_cash_amount: number;
  actual_upi_amount: number;
  actual_cheque_amount: number;
  actual_bank_transfer_amount: number;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  volunteerName?: string;
};

export type AdminHandoverPanelProps = {
  handovers: AdminHandover[];
  loading: boolean;
  error: string | null;
  actionLoadingId: string | null;
  onRefresh: () => void;
  onVerifyHandover: (handoverId: string) => void;
  onRejectHandover: (handoverId: string) => void;
};

export function AdminHandoverPanel({
  handovers,
  loading,
  error,
  actionLoadingId,
  onRefresh,
  onVerifyHandover,
  onRejectHandover,
}: AdminHandoverPanelProps) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Collection Handover Verification
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review submitted handovers and verify or reject them.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && handovers.length === 0 ? (
        <div className="mt-5 text-sm text-muted-foreground">
          Loading handovers...
        </div>
      ) : handovers.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No collection handovers found.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {handovers.map((adminHandover) => {
            const actualTotal =
              Number(adminHandover.actual_cash_amount) +
              Number(adminHandover.actual_upi_amount) +
              Number(adminHandover.actual_cheque_amount) +
              Number(adminHandover.actual_bank_transfer_amount);

            const difference =
              actualTotal - Number(adminHandover.expected_total_amount);

            const submitted = adminHandover.status === "submitted";
            const actionBusy = actionLoadingId === adminHandover.id;

            return (
              <div key={adminHandover.id} className="rounded-lg border p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-semibold">
                        {adminHandover.volunteerName || "Volunteer"}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          adminHandover.status === "verified"
                            ? "bg-green-100 text-green-800"
                            : adminHandover.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : adminHandover.status === "submitted"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {adminHandover.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Handover ID: {adminHandover.id}
                    </p>
                    {adminHandover.submitted_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted:{" "}
                        {new Date(
                          adminHandover.submitted_at
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {submitted && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => onVerifyHandover(adminHandover.id)}
                        disabled={actionBusy}
                      >
                        {actionBusy ? "Processing..." : "Verify"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onRejectHandover(adminHandover.id)}
                        disabled={actionBusy}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Expected Receipts
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {adminHandover.expected_receipt_count}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Expected Total
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      ₹
                      {Number(
                        adminHandover.expected_total_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Actual Total
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      ₹{actualTotal.toFixed(2)}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-3 ${
                      Math.abs(difference) > 0.005
                        ? "border-red-200 bg-red-50"
                        : "border-green-200 bg-green-50"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground">
                      Difference
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      ₹{difference.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Expected Cash</p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.expected_cash_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actual Cash</p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.actual_cash_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expected UPI</p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.expected_upi_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actual UPI</p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.actual_upi_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Expected Cheque
                    </p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.expected_cheque_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actual Cheque</p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.actual_cheque_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Expected Bank Transfer
                    </p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.expected_bank_transfer_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Actual Bank Transfer
                    </p>
                    <p className="font-semibold">
                      ₹
                      {Number(
                        adminHandover.actual_bank_transfer_amount
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>

                {adminHandover.rejection_reason && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-medium text-red-700">
                      Rejection Reason
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                      {adminHandover.rejection_reason}
                    </p>
                  </div>
                )}

                {adminHandover.notes && (
                  <div className="mt-4 rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="mt-1 text-sm">{adminHandover.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
