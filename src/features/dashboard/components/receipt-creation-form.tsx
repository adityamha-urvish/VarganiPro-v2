import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type {
  CachedBuildingSummary,
  CachedPropertyProgress,
} from "@/lib/offline/offline-db";

export type PaymentMode =
  | "cash"
  | "upi"
  | "cheque"
  | "bank_transfer";

export type ReceiptCreationFormProps = {
  propertyId?: string | null;
  properties?: CachedPropertyProgress[];
  buildings?: CachedBuildingSummary[];
  selectedBuildingId?: string | null;
  onBuildingIdChange?: (value: string | null) => void;
  onAddBuilding?: (name: string, wing?: string) => Promise<string | void>;
  onAddProperty?: (input: {
    unitNumber: string;
    floorNumber?: number | null;
    ownerName?: string;
    contactMobile?: string;
  }) => Promise<string | void>;
  donorName: string;
  donorMobile: string;
  amount: string;
  paymentMode: PaymentMode;
  paymentReference: string;
  notes: string;
  creating: boolean;
  createError: string | null;
  sessionStatus: string;
  currentReceiptNumber: number;
  startNumber?: number;
  endNumber?: number;
  onNavigateToCloseSession?: () => void;
  onPropertyIdChange?: (value: string | null) => void;
  onDonorNameChange: (value: string) => void;
  onDonorMobileChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPaymentModeChange: (value: PaymentMode) => void;
  onPaymentReferenceChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ReceiptCreationForm({
  propertyId,
  properties,
  buildings,
  selectedBuildingId,
  onBuildingIdChange,
  onAddBuilding,
  onAddProperty,
  donorName,
  donorMobile,
  amount,
  paymentMode,
  paymentReference,
  notes,
  creating,
  createError,
  sessionStatus,
  currentReceiptNumber,
  startNumber,
  endNumber,
  onNavigateToCloseSession,
  onPropertyIdChange,
  onDonorNameChange,
  onDonorMobileChange,
  onAmountChange,
  onPaymentModeChange,
  onPaymentReferenceChange,
  onNotesChange,
  onSubmit,
}: ReceiptCreationFormProps) {
  const isExhausted = endNumber !== undefined && currentReceiptNumber > endNumber;

  // Inline Building Add State
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingWing, setNewBuildingWing] = useState("");
  const [addingBuilding, setAddingBuilding] = useState(false);
  const [buildingAddError, setBuildingAddError] = useState<string | null>(null);

  // Inline Flat Add State
  const [showAddFlat, setShowAddFlat] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState("");
  const [newFloorNumber, setNewFloorNumber] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newContactMobile, setNewContactMobile] = useState("");
  const [addingFlat, setAddingFlat] = useState(false);
  const [flatAddError, setFlatAddError] = useState<string | null>(null);

  async function handleSaveNewBuilding() {
    if (!newBuildingName.trim()) return;
    setAddingBuilding(true);
    setBuildingAddError(null);
    try {
      const createdId = await onAddBuilding?.(newBuildingName.trim(), newBuildingWing.trim() || undefined);
      if (createdId && typeof createdId === "string") {
        onBuildingIdChange?.(createdId);
      }
      setNewBuildingName("");
      setNewBuildingWing("");
      setShowAddBuilding(false);
    } catch (err) {
      setBuildingAddError(err instanceof Error ? err.message : "Failed to add building");
    } finally {
      setAddingBuilding(false);
    }
  }

  async function handleSaveNewFlat() {
    if (!newUnitNumber.trim()) return;
    setAddingFlat(true);
    setFlatAddError(null);
    try {
      const createdId = await onAddProperty?.({
        unitNumber: newUnitNumber.trim(),
        floorNumber: newFloorNumber ? parseInt(newFloorNumber, 10) : null,
        ownerName: newOwnerName.trim() || undefined,
        contactMobile: newContactMobile.trim() || undefined,
      });
      if (createdId && typeof createdId === "string") {
        onPropertyIdChange?.(createdId);
        if (newOwnerName.trim() && !donorName) {
          onDonorNameChange?.(newOwnerName.trim());
        }
        if (newContactMobile.trim() && !donorMobile) {
          onDonorMobileChange?.(newContactMobile.trim());
        }
      }
      setNewUnitNumber("");
      setNewFloorNumber("");
      setNewOwnerName("");
      setNewContactMobile("");
      setShowAddFlat(false);
    } catch (err) {
      setFlatAddError(err instanceof Error ? err.message : "Failed to add flat");
    } finally {
      setAddingFlat(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border bg-card p-6"
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold">
          New Receipt
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Receipt #
          {currentReceiptNumber}
        </p>
      </div>

      <div className="space-y-5">
        {/* Exhausted Receipt Book Banner */}
        {isExhausted && (
          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" role="img" aria-label="Book completed">📕</span>
              <div>
                <h3 className="text-base font-black text-amber-950 dark:text-amber-100">
                  पावती पुस्तक पूर्ण झाले
                </h3>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Receipt Book Completed
                </p>
              </div>
            </div>

            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1.5 border-t border-amber-500/20 pt-2.5">
              <p className="font-semibold text-sm">
                पावती क्रमांक #{startNumber ?? "—"}–#{endNumber ?? "—"} पर्यंत सर्व पावत्या वापरल्या आहेत.
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                All receipts in this book have been issued. Please close this collection session and complete the handover before starting with another receipt book.
              </p>
            </div>

            {onNavigateToCloseSession && (
              <Button
                type="button"
                variant="default"
                onClick={onNavigateToCloseSession}
                className="w-full h-11 rounded-xl text-xs font-bold shadow-xs cursor-pointer bg-amber-600 hover:bg-amber-700 text-white mt-2"
              >
                संकलन बंद करा / Close Collection →
              </Button>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            1. BUILDING SELECTOR & INLINE ADD
        -------------------------------------------------------------- */}
        {buildings && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="buildingSelect"
                className="block text-sm font-medium text-foreground"
              >
                🏢 Building / Apartment (इमारत)
              </label>
              {onAddBuilding && !showAddBuilding && (
                <button
                  type="button"
                  onClick={() => setShowAddBuilding(true)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                >
                  ＋ Add Building
                </button>
              )}
            </div>

            <select
              id="buildingSelect"
              value={selectedBuildingId || ""}
              disabled={isExhausted || creating}
              onChange={(event) => {
                const bId = event.target.value || null;
                onBuildingIdChange?.(bId);
                if (!bId) {
                  onPropertyIdChange?.(null);
                }
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">-- No Building (General Donation / इतर वर्गणी) --</option>
              {buildings.map((b) => (
                <option key={b.buildingId} value={b.buildingId}>
                  {b.buildingName}{b.wing ? ` (Wing ${b.wing})` : ""}
                </option>
              ))}
            </select>

            {/* Inline Add Building Box */}
            {showAddBuilding && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">🏢 नवीन इमारत जोडा (Add New Building)</span>
                  <button
                    type="button"
                    onClick={() => setShowAddBuilding(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    ✕ Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="text"
                    placeholder="Building Name (e.g. Gokul Dham)"
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                  <Input
                    type="text"
                    placeholder="Wing (Optional, e.g. A)"
                    value={newBuildingWing}
                    onChange={(e) => setNewBuildingWing(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                {buildingAddError && (
                  <p className="text-[11px] text-red-600 font-medium">{buildingAddError}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddBuilding(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={addingBuilding || !newBuildingName.trim()}
                    onClick={() => void handleSaveNewBuilding()}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    {addingBuilding ? "Adding..." : "Save & Select Building"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            2. FLAT / PROPERTY SELECTOR & INLINE ADD
        -------------------------------------------------------------- */}
        {(properties || selectedBuildingId) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="propertyId"
                className="block text-sm font-medium text-foreground"
              >
                🚪 Flat / Property (सदनिका क्रमांक)
              </label>
              {onAddProperty && selectedBuildingId && !showAddFlat && (
                <button
                  type="button"
                  onClick={() => setShowAddFlat(true)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                >
                  ＋ Add Flat
                </button>
              )}
            </div>

            <select
              id="propertyId"
              value={propertyId || ""}
              disabled={isExhausted || creating}
              onChange={(event) => {
                const newPId = event.target.value || null;
                onPropertyIdChange?.(newPId);
                if (newPId && properties) {
                  const foundProp = properties.find((p) => p.propertyId === newPId);
                  if (foundProp) {
                    if (foundProp.ownerName && !donorName) {
                      onDonorNameChange?.(foundProp.ownerName);
                    }
                    if (foundProp.contactMobile && !donorMobile) {
                      onDonorMobileChange?.(foundProp.contactMobile);
                    }
                  }
                }
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">-- General / Non-Property Donation --</option>
              {(properties || []).map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  Flat {p.unitNumber} {p.ownerName ? `(${p.ownerName})` : ""} {p.status === "collected" ? "✓" : ""}
                </option>
              ))}
            </select>

            {/* Inline Add Flat Box */}
            {showAddFlat && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">🚪 नवीन सदनिका जोडा (Add New Flat)</span>
                  <button
                    type="button"
                    onClick={() => setShowAddFlat(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    ✕ Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="text"
                    placeholder="Flat Number (e.g. 101)"
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                  <Input
                    type="number"
                    placeholder="Floor (Optional, e.g. 1)"
                    value={newFloorNumber}
                    onChange={(e) => setNewFloorNumber(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                  <Input
                    type="text"
                    placeholder="Owner / Resident Name (Optional)"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                  <Input
                    type="tel"
                    placeholder="Mobile (Optional, 10-digit)"
                    value={newContactMobile}
                    onChange={(e) => setNewContactMobile(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                {flatAddError && (
                  <p className="text-[11px] text-red-600 font-medium">{flatAddError}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddFlat(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={addingFlat || !newUnitNumber.trim()}
                    onClick={() => void handleSaveNewFlat()}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    {addingFlat ? "Adding..." : "Save & Select Flat"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

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
            disabled={isExhausted || creating}
            onChange={(event) =>
              onDonorNameChange(
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
            disabled={isExhausted || creating}
            onChange={(event) =>
              onDonorMobileChange(
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
            disabled={isExhausted || creating}
            onChange={(event) =>
              onAmountChange(
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
            disabled={isExhausted || creating}
            onChange={(event) =>
              onPaymentModeChange(
                event.target
                  .value as PaymentMode
              )
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring disabled:opacity-50"
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
            disabled={isExhausted || creating}
            onChange={(event) =>
              onPaymentReferenceChange(
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
            disabled={isExhausted || creating}
            onChange={(event) =>
              onNotesChange(
                event.target.value
              )
            }
            placeholder="Optional notes"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50"
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
            sessionStatus !== "open" ||
            isExhausted
          }
          className="w-full"
        >
          {creating
            ? "Creating Receipt..."
            : isExhausted
              ? "📕 पावती पुस्तक पूर्ण झाले (Book Completed)"
              : sessionStatus !== "open"
                ? "Collection Session Completed"
                : `Create Receipt #${currentReceiptNumber}`}
        </Button>
      </div>
    </form>
  );
}
