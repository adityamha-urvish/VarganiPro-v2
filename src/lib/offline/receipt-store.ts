import {
  createLocalReceiptAtomic,
  getBookState,
  type LocalReceipt,
} from "./offline-db";

export interface CreateLocalReceiptInput {
  receiptBookId: string;

  organizationId: string;
  eventId: string;
  collectionSessionId: string;
  volunteerId: string;

  propertyId: string | null;

  donorName: string;
  donorMobile: string | null;

  amount: number;

  paymentMode:
    | "cash"
    | "upi"
    | "cheque"
    | "bank_transfer";

  paymentReference: string | null;

  notes: string | null;
}

function createClientReceiptId(): string {
  return crypto.randomUUID();
}

export async function createLocalReceipt(
  input: CreateLocalReceiptInput
): Promise<LocalReceipt> {
  const bookState =
    await getBookState(
      input.receiptBookId
    );

  if (!bookState) {
    throw new Error(
      "Receipt book is not available offline on this device."
    );
  }

  const receiptNumber =
    bookState.nextLocalNumber;

  if (
    receiptNumber <
      bookState.startNumber ||
    receiptNumber >
      bookState.endNumber
  ) {
    throw new Error(
      "Receipt book has no more available receipt numbers."
    );
  }

  const now =
    new Date().toISOString();

  const receipt: LocalReceipt = {
    clientReceiptId:
      createClientReceiptId(),

    organizationId:
      input.organizationId,

    eventId:
      input.eventId,

    collectionSessionId:
      input.collectionSessionId,

    receiptBookId:
      input.receiptBookId,

    volunteerId:
      input.volunteerId,

    propertyId:
      input.propertyId,

    receiptNumber,

    donorName:
      input.donorName,

    donorMobile:
      input.donorMobile,

    amount:
      input.amount,

    paymentMode:
      input.paymentMode,

    paymentReference:
      input.paymentReference,

    notes:
      input.notes,

    offlineCreatedAt: now,

    syncStatus: "pending",

    syncAttempts: 0,

    lastSyncAttemptAt: null,

    lastSyncError: null,

    createdAt: now,

    updatedAt: now,
  };

  const nextBookState = {
    ...bookState,

    nextLocalNumber:
      receiptNumber + 1,

    updatedAt: now,
  };

  await createLocalReceiptAtomic(
    receipt,
    nextBookState
  );

  return receipt;
}