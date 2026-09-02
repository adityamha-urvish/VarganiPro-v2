import {
  allocateAndCreateLocalReceiptAtomic,
  getAuthenticatedUserId,
  type LocalReceipt,
} from "./offline-db";

export interface CreateLocalReceiptInput {
  receiptBookId: string;

  organizationId: string;
  eventId: string;
  collectionSessionId: string;
  volunteerId: string;
  ownerUserId?: string | null;

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

let allocationLock: Promise<unknown> = Promise.resolve();

export async function createLocalReceipt(
  input: CreateLocalReceiptInput
): Promise<LocalReceipt> {
  const ownerUserId =
    input.ownerUserId ??
    (await getAuthenticatedUserId()) ??
    null;

  const previousLock = allocationLock;
  let currentResolve: () => void;
  allocationLock = new Promise<void>((resolve) => {
    currentResolve = resolve;
  });

  try {
    await previousLock;
    return await allocateAndCreateLocalReceiptAtomic({
      ...input,
      ownerUserId,
    });
  } finally {
    currentResolve!();
  }
}