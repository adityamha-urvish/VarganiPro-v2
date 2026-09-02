export interface CollectionPaymentBreakdown {
  receipt_count: number;
  total_amount: number;
  cash_amount: number;
  upi_amount: number;
  cheque_amount: number;
  bank_transfer_amount: number;
}

export interface PropertyProgressMetrics {
  total_residential_units: number;
  collected_count: number;
  pending_count: number;
  refused_count: number;
  not_visited_count: number;
  completion_percentage: number;
}

export interface TreasuryPositionMetrics {
  pending_handover_count: number;
  pending_handover_amount: number;
  treasury_cash_received: number;
  total_authorized_expenses: number;
  total_physical_cash_held: number;
  volunteers_holding_cash_count: number;
}

export interface SecretaryOverviewMetrics {
  success: boolean;
  event_id: string;
  organization_id: string;
  today: CollectionPaymentBreakdown;
  festival_total: CollectionPaymentBreakdown;
  property_progress: PropertyProgressMetrics;
  treasury: TreasuryPositionMetrics;
}

export interface VolunteerFinancialRow {
  volunteer_id: string;
  name: string;
  mobile: string;
  status: string;
  receipt_count: number;
  total_collected: number;
  cash_collected: number;
  cheque_collected: number;
  upi_collected: number;
  bank_transfer_collected: number;
  physical_collected: number;
  digital_settled: number;
  verified_handed_over: number;
  verified_expenses: number;
  outstanding_physical_held: number;
  pending_handover_count: number;
  pending_handover_amount: number;
  latest_handover_status: string;
}

export interface VolunteerLedgerSummary {
  total_volunteers: number;
  active_volunteers: number;
  total_receipt_count: number;
  grand_total_collected: number;
  total_physical_collected: number;
  total_digital_settled: number;
  total_verified_handed_over: number;
  total_verified_expenses: number;
  total_outstanding_physical_held: number;
  volunteers_holding_cash_count: number;
}

export interface VolunteerFinancialLedgerResponse {
  success: boolean;
  event_id: string;
  organization_id: string;
  summary: VolunteerLedgerSummary;
  volunteers: VolunteerFinancialRow[];
}
