import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "@/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  initializeCollectionSession,
  type CollectionSessionContext,
} from "@/features/collection/services/collection-session.service";

import {
  createLocalReceipt,
  type CreateLocalReceiptInput,
} from "@/lib/offline/receipt-store";

import {
  getLocalReceipts,
  type LocalReceipt,
} from "@/lib/offline/offline-db";

import { syncNextReceipt } from "@/lib/offline/receipt-sync";

type PaymentMode =
  | "cash"
  | "upi"
  | "cheque"
  | "bank_transfer";

export function DashboardPage() {
  const [session, setSession] =
    useState<CollectionSessionContext | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [donorName, setDonorName] =
    useState("");

  const [donorMobile, setDonorMobile] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("cash");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  const [createdReceipt, setCreatedReceipt] =
    useState<LocalReceipt | null>(null);

  const [receiptToView, setReceiptToView] =
    useState<LocalReceipt | null>(null);

  const [createError, setCreateError] =
    useState<string | null>(null);

  const [syncMessage, setSyncMessage] =
    useState<string | null>(null);

  const [receipts, setReceipts] =
    useState<LocalReceipt[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [closingSession, setClosingSession] =
    useState(false);

  const [sessionCloseMessage, setSessionCloseMessage] =
    useState<string | null>(null);

  const [sessionCloseError, setSessionCloseError] =
    useState<string | null>(null);

  /*
   * Load all locally stored receipts
   * for the active receipt book.
   */
  async function loadReceiptHistory(
    receiptBookId: string
  ) {
    setHistoryLoading(true);

    try {
      const localReceipts =
        await getLocalReceipts(receiptBookId);

      console.log(
        "LOCAL RECEIPT HISTORY:",
        localReceipts
      );

      setReceipts(localReceipts);
    } catch (err) {
      console.error(
        "RECEIPT HISTORY ERROR:",
        err
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const issuedReceipts = receipts.filter(
    (receipt) => receipt.syncStatus === "synced"
  );

  const pendingReceipts = receipts.filter(
    (receipt) =>
      receipt.syncStatus === "pending" ||
      receipt.syncStatus === "syncing"
  );

  const conflictReceipts = receipts.filter(
    (receipt) => receipt.syncStatus === "conflict"
  );

  const totalAmount = issuedReceipts.reduce(
    (total, receipt) => total + receipt.amount,
    0
  );

  const cashAmount = issuedReceipts
    .filter((receipt) => receipt.paymentMode === "cash")
    .reduce((total, receipt) => total + receipt.amount, 0);

  const upiAmount = issuedReceipts
    .filter((receipt) => receipt.paymentMode === "upi")
    .reduce((total, receipt) => total + receipt.amount, 0);

  const chequeAmount = issuedReceipts
    .filter((receipt) => receipt.paymentMode === "cheque")
    .reduce((total, receipt) => total + receipt.amount, 0);

  const bankTransferAmount = issuedReceipts
    .filter(
      (receipt) =>
        receipt.paymentMode === "bank_transfer"
    )
    .reduce((total, receipt) => total + receipt.amount, 0);

  /*
   * Initialize collection session.
   */
  useEffect(() => {
    async function initialize() {
      try {
        console.log(
          "Initializing collection session..."
        );

        const result =
          await initializeCollectionSession();

        console.log(
          "COLLECTION SESSION:",
          result
        );

        setSession(result);

        await loadReceiptHistory(
          result.receiptBookId
        );
      } catch (err) {
        console.error(
          "COLLECTION SESSION ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to initialize collection session."
        );
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  /*
   * Create the next local receipt.
   */
  async function handleCreateReceipt(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!session) {
      setCreateError(
        "Collection session is not initialized."
      );

      return;
    }

    setCreateError(null);
    setSyncMessage(null);
    setCreating(true);

    try {
      const parsedAmount = Number(amount);

      if (
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0
      ) {
        throw new Error(
          "Amount must be greater than zero."
        );
      }

      if (!donorName.trim()) {
        throw new Error(
          "Donor name is required."
        );
      }

      const input: CreateLocalReceiptInput = {
        organizationId:
          session.organizationId,

        eventId:
          session.eventId,

        collectionSessionId:
          session.sessionId,

        receiptBookId:
          session.receiptBookId,

        volunteerId:
          session.volunteerId,

        propertyId: null,

        donorName:
          donorName.trim(),

        donorMobile:
          donorMobile.trim() || null,

        amount:
          parsedAmount,

        paymentMode,

        paymentReference:
          paymentReference.trim() || null,

        notes:
          notes.trim() || null,
      };

      /*
       * Same tested local receipt creation
       * path used for receipts #104 and #105.
       */
      const receipt =
        await createLocalReceipt(input);

      console.log(
        "LOCAL RECEIPT CREATED:",
        receipt
      );

      setCreatedReceipt(receipt);

      /*
       * Show the receipt immediately in local
       * history before attempting synchronization.
       */
      await loadReceiptHistory(
        session.receiptBookId
      );

      /*
       * Clear form for next receipt.
       */
      setDonorName("");
      setDonorMobile("");
      setAmount("");
      setPaymentMode("cash");
      setPaymentReference("");
      setNotes("");

      /*
       * Try synchronization.
       */
      try {
        const syncResult =
          await syncNextReceipt(
            session.receiptBookId
          );

        /*
         * syncNextReceipt can legitimately
         * return null when there is nothing
         * pending to synchronize.
         */
        if (!syncResult) {
          await loadReceiptHistory(
            session.receiptBookId
          );

          setSyncMessage(
            "Receipt created locally. There are no receipts currently waiting to sync."
          );

          return;
        }

        console.log(
          "SYNC RESULT:",
          syncResult
        );

        /*
         * Reload history so the UI reflects
         * the final synchronization state.
         */
        await loadReceiptHistory(
          session.receiptBookId
        );

        if (syncResult.success) {
          if (syncResult.alreadyExists) {
            setSyncMessage(
              "Receipt already existed on the server. No duplicate was created."
            );
          } else {
            setSyncMessage(
              "Receipt created and synced successfully."
            );
          }
        } else if (syncResult.conflict) {
          setSyncMessage(
            "Receipt created locally, but synchronization requires attention."
          );
        } else {
          setSyncMessage(
            "Receipt created locally and is waiting to sync."
          );
        }
      } catch (syncError) {
        console.error(
          "SYNC ERROR:",
          syncError
        );

        /*
         * The receipt is already safely stored
         * locally, so it remains available for
         * later synchronization.
         */
        await loadReceiptHistory(
          session.receiptBookId
        );

        setSyncMessage(
          "Receipt created locally. It will remain available for synchronization."
        );
      }
    } catch (err) {
      console.error(
        "CREATE RECEIPT ERROR:",
        err
      );

      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to create receipt."
      );
    } finally {
      setCreating(false);
    }
  }

  /*
   * Manually synchronize the next pending receipt.
   */
  async function handleSyncNextReceipt() {
    if (!session) {
      return;
    }

    setSyncMessage(null);

    try {
      const result =
        await syncNextReceipt(
          session.receiptBookId
        );

      /*
       * No pending receipt is a valid state.
       */
      if (!result) {
        await loadReceiptHistory(
          session.receiptBookId
        );

        setSyncMessage(
          "No pending receipts to synchronize."
        );

        return;
      }

      console.log(
        "MANUAL SYNC RESULT:",
        result
      );

      await loadReceiptHistory(
        session.receiptBookId
      );

      if (result.success) {
        setSyncMessage(
          result.alreadyExists
            ? "Receipt was already synchronized."
            : "Receipt synchronized successfully."
        );
      } else if (result.conflict) {
        setSyncMessage(
          "Receipt synchronization encountered a conflict."
        );
      } else {
        setSyncMessage(
          "No receipt was synchronized."
        );
      }
    } catch (err) {
      console.error(
        "MANUAL SYNC ERROR:",
        err
      );

      setSyncMessage(
        err instanceof Error
          ? err.message
          : "Unable to synchronize receipt."
      );
    }
  }

  async function handleCloseSession() {
    if (!session) {
      return;
    }

    if (session.sessionStatus !== "open") {
      return;
    }

    setSessionCloseMessage(null);
    setSessionCloseError(null);

    if (pendingReceipts.length > 0) {
      setSessionCloseError(
        `Cannot close session. ${pendingReceipts.length} receipt(s) are still waiting to sync.`
      );
      return;
    }

    if (conflictReceipts.length > 0) {
      setSessionCloseError(
        `Cannot close session. ${conflictReceipts.length} receipt(s) have synchronization conflicts.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Close this collection session?\n\n` +
        `Receipts: ${issuedReceipts.length}\n` +
        `Total: ₹${totalAmount.toFixed(2)}\n\n` +
        `Once completed, this session cannot be used to create more receipts.`
    );

    if (!confirmed) {
      return;
    }

    setClosingSession(true);

    try {
      const { data, error } =
        await supabase.rpc(
          "complete_collection_session",
          {
            p_collection_session_id:
              session.sessionId,
          }
        );

      console.log(
        "COMPLETE SESSION RESPONSE:",
        data
      );

      console.log(
        "COMPLETE SESSION ERROR:",
        error
      );

      if (error) {
        throw new Error(error.message);
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while completing collection session."
        );
      }

      setSession((current) =>
        current
          ? {
              ...current,
              sessionStatus: "completed",
            }
          : current
      );

      setSessionCloseMessage(
        "Collection session completed successfully."
      );
    } catch (err) {
      console.error(
        "COMPLETE SESSION ERROR:",
        err
      );

      setSessionCloseError(
        err instanceof Error
          ? err.message
          : "Unable to complete collection session."
      );
    } finally {
      setClosingSession(false);
    }
  }

 function handlePrintReceipt(receipt: LocalReceipt) {
  if (!session) {
    setCreateError(
      "Collection session is not available."
    );
    return;
  }
 
  const printWindow = window.open(
    "",
    "_blank",
    "width=800,height=900"
  );

  if (!printWindow) {
    setCreateError(
      "Unable to open the print window. Please allow pop-ups for VarganiPro and try again."
    );
    return;
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const receiptCode =
    `${session.prefix}${receipt.receiptNumber}`;

  const donorName =
    escapeHtml(receipt.donorName);

  const donorMobile =
    receipt.donorMobile
      ? escapeHtml(receipt.donorMobile)
      : "";

  const paymentMode =
    escapeHtml(
      receipt.paymentMode.replace("_", " ")
    );

  const paymentReference =
    receipt.paymentReference
      ? escapeHtml(receipt.paymentReference)
      : "";

  const notes =
    receipt.notes
      ? escapeHtml(receipt.notes)
      : "";

  const receiptDate =
    escapeHtml(
      new Date(
        receipt.createdAt
      ).toLocaleString()
    );

  const bookNumber =
    escapeHtml(session.bookNumber);

  printWindow.document.open();

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${escapeHtml(receiptCode)}</title>

        <style>
          @page {
            size: A4;
            margin: 15mm;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
          }

          .receipt {
            width: 100%;
            border: 1px solid #222;
            padding: 16mm;
          }

          .center {
            text-align: center;
          }

          .brand {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 1px;
          }

          .subtitle {
            margin: 6px 0 0;
            font-size: 14px;
            color: #555;
          }

          .number {
            margin: 20px 0;
            padding: 12px 0;
            border-top: 1px solid #222;
            border-bottom: 1px solid #222;
            text-align: center;
          }

          .number-label {
            font-size: 12px;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .number-value {
            margin-top: 5px;
            font-size: 30px;
            font-weight: 700;
          }

          .details {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }

          .details td {
            padding: 9px 0;
            vertical-align: top;
            border-bottom: 1px solid #ddd;
          }

          .details td:first-child {
            width: 40%;
            color: #666;
          }

          .details td:last-child {
            text-align: right;
            font-weight: 600;
          }

          .amount {
            font-size: 22px;
          }

          .notes {
            margin-top: 18px;
            padding-top: 12px;
            border-top: 1px solid #222;
          }

          .notes-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }

          .notes-value {
            margin-top: 6px;
            font-size: 14px;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #222;
            text-align: center;
            font-size: 11px;
            color: #666;
          }
        </style>
      </head>

      <body>
        <div class="receipt">

          <div class="center">
            <h1 class="brand">VARGANIPRO</h1>
            <p class="subtitle">
              Donation Receipt
            </p>
          </div>

          <div class="number">
            <div class="number-label">
              Receipt Number
            </div>

            <div class="number-value">
              ${escapeHtml(receiptCode)}
            </div>
          </div>

          <table class="details">
            <tbody>

              <tr>
                <td>Donor Name</td>
                <td>${donorName}</td>
              </tr>

              ${
                donorMobile
                  ? `
                    <tr>
                      <td>Mobile</td>
                      <td>${donorMobile}</td>
                    </tr>
                  `
                  : ""
              }

              <tr>
                <td>Amount</td>
                <td class="amount">
                  ₹${receipt.amount.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td>Payment Mode</td>
                <td style="text-transform: capitalize;">
                  ${paymentMode}
                </td>
              </tr>

              ${
                paymentReference
                  ? `
                    <tr>
                      <td>Payment Reference</td>
                      <td>${paymentReference}</td>
                    </tr>
                  `
                  : ""
              }

              <tr>
                <td>Date &amp; Time</td>
                <td>${receiptDate}</td>
              </tr>

              <tr>
                <td>Receipt Book</td>
                <td>${bookNumber}</td>
              </tr>

            </tbody>
          </table>

          ${
            notes
              ? `
                <div class="notes">
                  <div class="notes-label">
                    Notes
                  </div>

                  <div class="notes-value">
                    ${notes}
                  </div>
                </div>
              `
              : ""
          }

          <div class="footer">
            Thank you for your contribution.
          </div>

        </div>
      </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.focus();

  printWindow.onafterprint = () => {
    printWindow.close();
  };

  printWindow.onload = () => {
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };
}

  function getStatusLabel(
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

  function getStatusClass(
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

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-3 text-muted-foreground">
          Loading collection session...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-700">
            Unable to initialize collection
            session
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      {/* ----------------------------------------
          COLLECTION SESSION
      ----------------------------------------- */}

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
            <h2 className="text-xl font-semibold">
              Session Summary
            </h2>

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
            {session.sessionStatus === "open"
              ? "Open"
              : "Completed"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Receipts
            </p>
            <p className="mt-1 text-2xl font-bold">
              {issuedReceipts.length}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Total Collection
            </p>
            <p className="mt-1 text-2xl font-bold">
              ₹{totalAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Pending Sync
            </p>
            <p className="mt-1 text-2xl font-bold">
              {pendingReceipts.length}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Conflicts
            </p>
            <p className="mt-1 text-2xl font-bold">
              {conflictReceipts.length}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Cash
            </p>
            <p className="font-semibold">
              ₹{cashAmount.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              UPI
            </p>
            <p className="font-semibold">
              ₹{upiAmount.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Cheque
            </p>
            <p className="font-semibold">
              ₹{chequeAmount.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Bank Transfer
            </p>
            <p className="font-semibold">
              ₹{bankTransferAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {sessionCloseError && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              {sessionCloseError}
            </p>
          </div>
        )}

        {sessionCloseMessage && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-700">
              {sessionCloseMessage}
            </p>
          </div>
        )}

        {session.sessionStatus === "open" && (
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void handleCloseSession()
              }
              disabled={
                closingSession ||
                pendingReceipts.length > 0 ||
                conflictReceipts.length > 0
              }
            >
              {closingSession
                ? "Closing Session..."
                : "Close Collection Session"}
            </Button>
          </div>
        )}
      </div>

      {/* ----------------------------------------
          LAST CREATED RECEIPT
      ----------------------------------------- */}

      {createdReceipt && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">
                Receipt created
              </p>

              <p className="mt-1 text-2xl font-bold text-green-800">
                #{createdReceipt.receiptNumber}
              </p>

              <p className="mt-1 text-sm text-green-700">
                {createdReceipt.donorName} — ₹
                {createdReceipt.amount.toFixed(2)}
              </p>

              <p className="mt-2 text-xs text-green-700">
                Status:{" "}
                {getStatusLabel(
                  createdReceipt.syncStatus
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setReceiptToView(createdReceipt)
                }
              >
                View Receipt
              </Button>

              <Button
                type="button"
                onClick={() =>
                  handlePrintReceipt(createdReceipt)
                }
              >
                Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------
          SYNC MESSAGE
      ----------------------------------------- */}

      {syncMessage && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm">
            {syncMessage}
          </p>
        </div>
      )}

      {/* ----------------------------------------
          NEW RECEIPT
      ----------------------------------------- */}

      <form
        onSubmit={handleCreateReceipt}
        className="rounded-lg border bg-card p-6"
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold">
            New Receipt
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Receipt #
            {session.currentNumber}
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
                setDonorName(
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
                setDonorMobile(
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
                setAmount(
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
                setPaymentMode(
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
                setPaymentReference(
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
                setNotes(
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
              session.sessionStatus !== "open"
            }
            className="w-full"
          >
            {creating
              ? "Creating Receipt..."
              : session.sessionStatus !== "open"
                ? "Collection Session Completed"
                : `Create Receipt #${session.currentNumber}`}
          </Button>
        </div>
      </form>

      {/* ----------------------------------------
          RECEIPT HISTORY / SYNC QUEUE
      ----------------------------------------- */}

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
              onClick={() =>
                void loadReceiptHistory(
                  session.receiptBookId
                )
              }
              disabled={historyLoading}
            >
              {historyLoading
                ? "Refreshing..."
                : "Refresh"}
            </Button>

            <Button
              type="button"
              onClick={() =>
                void handleSyncNextReceipt()
              }
              disabled={
                historyLoading ||
                session.sessionStatus !== "open"
              }
            >
              Sync Next
            </Button>
          </div>
        </div>

        {historyLoading &&
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
                      {session.prefix}
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
                      setReceiptToView(receipt)
                    }
                  >
                    View Receipt
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      handlePrintReceipt(receipt)
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

      {receiptToView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt ${receiptToView.receiptNumber}`}
          onClick={() =>
            setReceiptToView(null)
          }
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
                  {session.prefix}
                  {receiptToView.receiptNumber}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handlePrintReceipt(
                      receiptToView
                    )
                  }
                >
                  Print
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setReceiptToView(null)
                  }
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
                    {session.prefix}
                    {receiptToView.receiptNumber}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between gap-6">
                  <span className="text-sm text-muted-foreground">
                    Donor Name
                  </span>
                  <span className="text-right font-medium">
                    {receiptToView.donorName}
                  </span>
                </div>

                {receiptToView.donorMobile && (
                  <div className="flex justify-between gap-6">
                    <span className="text-sm text-muted-foreground">
                      Mobile
                    </span>
                    <span className="text-right font-medium">
                      {receiptToView.donorMobile}
                    </span>
                  </div>
                )}

                <div className="flex justify-between gap-6">
                  <span className="text-sm text-muted-foreground">
                    Amount
                  </span>
                  <span className="text-right text-xl font-bold">
                    ₹{receiptToView.amount.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between gap-6">
                  <span className="text-sm text-muted-foreground">
                    Payment Mode
                  </span>
                  <span className="text-right font-medium capitalize">
                    {receiptToView.paymentMode.replace(
                      "_",
                      " "
                    )}
                  </span>
                </div>

                {receiptToView.paymentReference && (
                  <div className="flex justify-between gap-6">
                    <span className="text-sm text-muted-foreground">
                      Reference
                    </span>
                    <span className="max-w-[60%] break-words text-right font-medium">
                      {receiptToView.paymentReference}
                    </span>
                  </div>
                )}

                <div className="flex justify-between gap-6">
                  <span className="text-sm text-muted-foreground">
                    Date & Time
                  </span>
                  <span className="text-right font-medium">
                    {new Date(
                      receiptToView.createdAt
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              {receiptToView.notes && (
                <div className="mt-6 border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-1 text-sm">
                    {receiptToView.notes}
                  </p>
                </div>
              )}

              <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
                <p>
                  Receipt Book: {session.bookNumber}
                </p>
                <p className="mt-1">
                  Thank you for your contribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .receipt-print-area,
          .receipt-print-area * {
            visibility: visible !important;
          }

          .receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
