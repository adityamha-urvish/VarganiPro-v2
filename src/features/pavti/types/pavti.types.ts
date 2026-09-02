export type FestivalType = "ganpati" | "navratri" | "other";

export interface PavtiTemplateConfig {
  festivalType: FestivalType;
  mandalName: string;
  eventName: string;
  yearText?: string | null;
  secretaryName?: string | null;
  secretaryDesignation?: string;
}

export interface PavtiReceiptData {
  receiptNumber: number;
  receiptPrefix?: string;
  donorName: string;
  amount: number;
  paymentMode: "cash" | "upi" | "cheque" | "bank_transfer" | string;
  paymentReference?: string | null;
  createdAt: string; // ISO date or formatted
  buildingName?: string | null;
  buildingWing?: string | null;
  unitNumber?: string | null;
  propertyType?: "residential" | "commercial" | string | null;
  notes?: string | null;
}
