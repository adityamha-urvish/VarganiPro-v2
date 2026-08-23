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
