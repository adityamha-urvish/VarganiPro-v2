import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface PendingReasonDrawerProps {
  unitNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReason: (reason: string, followUpTime?: string | null, notes?: string | null) => void;
}

export function PendingReasonDrawer({
  unitNumber,
  isOpen,
  onClose,
  onSubmitReason,
}: PendingReasonDrawerProps) {
  const [selectedReason, setSelectedReason] = useState<string>("door_locked");
  const [followUpTime, setFollowUpTime] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  if (!isOpen) return null;

  function handleSubmit() {
    onSubmitReason(selectedReason, followUpTime.trim() || null, notes.trim() || null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Mark Flat {unitNumber}
            </h3>
            <p className="text-xs text-muted-foreground">Select why collection was not completed</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {/* Quick Reason Buttons */}
        <div className="space-y-2">
          {[
            { id: "door_locked", label: "🏠 Door Locked / Not Home", desc: "Resident was not available" },
            { id: "asked_to_return_later", label: "⏰ Come Later / Return Later", desc: "Resident asked to visit later" },
            { id: "contact_not_available", label: "📱 Contact Not Available", desc: "No phone or contact info" },
            { id: "refused", label: "🚫 Refused to Contribute", desc: "Will be excluded from remaining queue" },
            { id: "other", label: "📝 Other Reason", desc: "Custom notes" },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedReason(r.id)}
              className={`w-full p-3.5 rounded-xl border-2 text-left flex flex-col transition-all cursor-pointer ${
                selectedReason === r.id
                  ? "border-primary bg-primary/10 text-foreground font-semibold"
                  : "border-muted hover:border-border text-muted-foreground"
              }`}
            >
              <span className="text-sm font-bold text-foreground">{r.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{r.desc}</span>
            </button>
          ))}
        </div>

        {/* Optional Time for "Come Later" */}
        {selectedReason === "asked_to_return_later" && (
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-foreground">Suggested Follow-Up Time (Optional):</label>
            <div className="flex flex-wrap gap-1.5">
              {["Evening after 7 PM", "Tomorrow morning", "Next weekend"].map((timeChip) => (
                <button
                  key={timeChip}
                  type="button"
                  onClick={() => setFollowUpTime(timeChip)}
                  className={`text-xs px-2.5 py-1 rounded-lg border ${
                    followUpTime === timeChip
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-muted bg-background text-foreground"
                  }`}
                >
                  {timeChip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Optional Note */}
        {selectedReason === "other" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Notes (Optional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Renovation in progress"
              className="w-full text-sm rounded-lg border border-input bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={`flex-1 font-bold ${
              selectedReason === "refused" ? "bg-rose-700 hover:bg-rose-800 text-white" : ""
            }`}
            onClick={handleSubmit}
          >
            {selectedReason === "refused" ? "Record Refusal & Next →" : "Save Pending & Next →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
