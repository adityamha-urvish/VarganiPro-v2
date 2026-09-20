import { supabase } from "@/supabase/client";

export type ReceiptBookStatus =
  | "available"
  | "assigned"
  | "checked_out"
  | "exhausted"
  | "closed"
  | "cancelled";

export interface ReceiptBookAdminRecord {
  receiptBookId: string;
  organizationId: string;
  eventId: string;
  bookNumber: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  currentNumber: number;
  status: ReceiptBookStatus;
  assignedVolunteerId?: string | null;
  assignedVolunteerName?: string | null;
  checkedOutSessionId?: string | null;
  checkedOutAt?: string | null;
  totalReceiptsIssued: number;
  totalAmountCollected: number;
  createdAt: string;
}

export interface CreateReceiptBookParams {
  organizationId: string;
  eventId: string;
  bookNumber: string;
  prefix?: string;
  startNumber: number;
  endNumber: number;
}

export interface CreateReceiptBookResult {
  success: boolean;
  receiptBookId: string;
  bookNumber: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  currentNumber: number;
  status: ReceiptBookStatus;
}

/**
 * Fetch all receipt books for an organization / event with live statistics.
 */
export async function fetchOrganizationReceiptBooks(
  organizationId: string,
  eventId?: string | null
): Promise<ReceiptBookAdminRecord[]> {
  const { data, error } = await supabase.rpc("get_organization_receipt_books", {
    p_organization_id: organizationId,
    p_event_id: eventId || null,
  });

  if (error) {
    console.error("fetchOrganizationReceiptBooks error:", error);
    throw new Error(error.message || "Failed to load receipt books");
  }

  return (data || []).map((row: any) => ({
    receiptBookId: row.receipt_book_id,
    organizationId: row.organization_id,
    eventId: row.event_id,
    bookNumber: row.book_number,
    prefix: row.prefix || "VP-",
    startNumber: Number(row.start_number),
    endNumber: Number(row.end_number),
    currentNumber: Number(row.current_number ?? row.start_number),
    status: row.status as ReceiptBookStatus,
    assignedVolunteerId: row.assigned_volunteer_id,
    assignedVolunteerName: row.assigned_volunteer_name,
    checkedOutSessionId: row.checked_out_session_id,
    checkedOutAt: row.checked_out_at,
    totalReceiptsIssued: Number(row.total_receipts_issued || 0),
    totalAmountCollected: Number(row.total_amount_collected || 0),
    createdAt: row.created_at,
  }));
}

/**
 * Register/create a new physical receipt book.
 * Strictly validated by database constraints & caller role.
 */
export async function createReceiptBook(
  params: CreateReceiptBookParams
): Promise<CreateReceiptBookResult> {
  const cleanBookNumber = params.bookNumber.trim();
  const cleanPrefix = (params.prefix?.trim() || "VP-").toUpperCase();
  const startNum = Number(params.startNumber);
  const endNum = Number(params.endNumber);

  if (!cleanBookNumber) {
    throw new Error("Book number or identifier is required");
  }

  if (isNaN(startNum) || startNum < 1) {
    throw new Error("Start receipt number must be a valid positive integer");
  }

  if (isNaN(endNum) || endNum <= startNum) {
    throw new Error("End receipt number must be greater than start receipt number");
  }

  const { data, error } = await supabase.rpc("create_receipt_book", {
    p_organization_id: params.organizationId,
    p_event_id: params.eventId,
    p_book_number: cleanBookNumber,
    p_prefix: cleanPrefix,
    p_start_number: startNum,
    p_end_number: endNum,
  });

  if (error) {
    console.error("createReceiptBook error:", error);
    throw new Error(error.message || "Failed to create receipt book");
  }

  return {
    success: true,
    receiptBookId: data.receipt_book_id,
    bookNumber: data.book_number,
    prefix: data.prefix,
    startNumber: data.start_number,
    endNumber: data.end_number,
    currentNumber: data.current_number,
    status: data.status,
  };
}

export interface AssignReceiptBookResult {
  success: boolean;
  receiptBookId: string;
  status: ReceiptBookStatus;
  assignedVolunteerId: string | null;
}

/**
 * Assign or unassign a receipt book to/from a volunteer.
 */
export async function assignReceiptBook(
  receiptBookId: string,
  volunteerId: string | null
): Promise<AssignReceiptBookResult> {
  const { data, error } = await supabase.rpc("assign_receipt_book", {
    p_receipt_book_id: receiptBookId,
    p_volunteer_id: volunteerId || null,
  });

  if (error) {
    console.error("assignReceiptBook error:", error);
    throw new Error(error.message || "Failed to assign receipt book");
  }

  return {
    success: true,
    receiptBookId: data.receipt_book_id || receiptBookId,
    status: data.status,
    assignedVolunteerId: data.assigned_volunteer_id,
  };
}


