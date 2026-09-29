import type { LocalReceipt } from "@/lib/offline/offline-db";

export interface ReceiptAggregates {
  issuedReceipts: LocalReceipt[];
  pendingReceipts: LocalReceipt[];
  conflictReceipts: LocalReceipt[];
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  chequeAmount: number;
  bankTransferAmount: number;
}

export function calculateReceiptAggregates(
  receipts: LocalReceipt[]
): ReceiptAggregates {
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

  return {
    issuedReceipts,
    pendingReceipts,
    conflictReceipts,
    totalAmount,
    cashAmount,
    upiAmount,
    chequeAmount,
    bankTransferAmount,
  };
}

/**
 * Checks if an ISO date string or timestamp falls on current date in Asia/Kolkata timezone.
 */
export function isTodayIST(dateStringOrIso?: string | null): boolean {
  if (!dateStringOrIso) return false;
  try {
    const d = new Date(dateStringOrIso);
    if (isNaN(d.getTime())) return false;
    const istFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const receiptDate = istFormatter.format(d);
    const todayDate = istFormatter.format(new Date());
    return receiptDate === todayDate;
  } catch {
    return false;
  }
}

export interface TodayPersonalAggregates {
  todayReceipts: LocalReceipt[];
  todayTotal: number;
  todayCash: number;
  todayUpi: number;
  todayCheque: number;
  todayBankTransfer: number;
  todayCount: number;
  pendingSyncCount: number;
}

/**
 * Calculates personal collection aggregates for today in IST (Volunteer View 1).
 * Includes both synced and pending offline receipts created on this device today,
 * strictly excluding voided or cancelled receipts.
 */
export function calculateTodayPersonalAggregates(
  receipts: LocalReceipt[]
): TodayPersonalAggregates {
  const validReceipts = receipts.filter(
    (r) => (r.status === "valid" || !r.status) && (r as any).status !== "voided" && (r as any).status !== "cancelled"
  );

  const todayReceipts = validReceipts.filter((r) =>
    isTodayIST(r.offlineCreatedAt || r.createdAt)
  );

  const todayTotal = todayReceipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const todayCash = todayReceipts
    .filter((r) => r.paymentMode === "cash")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const todayUpi = todayReceipts
    .filter((r) => r.paymentMode === "upi")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const todayCheque = todayReceipts
    .filter((r) => r.paymentMode === "cheque")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const todayBankTransfer = todayReceipts
    .filter((r) => r.paymentMode === "bank_transfer")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const pendingSyncCount = todayReceipts.filter(
    (r) => r.syncStatus === "pending" || r.syncStatus === "syncing"
  ).length;

  return {
    todayReceipts,
    todayTotal,
    todayCash,
    todayUpi,
    todayCheque,
    todayBankTransfer,
    todayCount: todayReceipts.length,
    pendingSyncCount,
  };
}
