import { useState } from "react";
import type { CachedBuildingSummary, CachedPropertyProgress } from "@/lib/offline/offline-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BuildingFlatGridProps {
  building: CachedBuildingSummary;
  properties: CachedPropertyProgress[];
  loading: boolean;
  onBack: () => void;
  onSelectProperty: (property: CachedPropertyProgress) => void;
  onStartNextFlat?: () => void;
  onAddProperty?: (input: {
    unitNumber: string;
    floorNumber?: number | null;
    ownerName?: string;
    contactMobile?: string;
  }) => Promise<CachedPropertyProgress | null | void>;
  isCompleted?: boolean;
  onToggleComplete?: (buildingId: string, isCompleted: boolean) => void;
}

export function BuildingFlatGrid({
  building,
  properties,
  loading,
  onBack,
  onSelectProperty,
  onStartNextFlat,
  onAddProperty,
  isCompleted = false,
  onToggleComplete,
}: BuildingFlatGridProps) {
  const [filterMode, setFilterMode] = useState<"all" | "collected" | "pending" | "refused" | "not_visited">("all");
  const [showAddFlat, setShowAddFlat] = useState(false);
  const [unitNumber, setUnitNumber] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [submittingFlat, setSubmittingFlat] = useState(false);

  // Compute live breakdown counts from properties
  const totalRecorded = properties.length;
  const collectedCount = properties.filter((p) => p.status === "collected").length;
  const pendingCount = properties.filter((p) => p.status === "pending").length;
  const refusedCount = properties.filter((p) => p.status === "refused").length;
  const notVisitedCount = properties.filter((p) => p.status === "not_visited").length;
  const totalCollectedAmount = properties.reduce((sum, p) => sum + (p.totalCollectedAmount || 0), 0);

  // Filter properties
  const filteredProperties = properties.filter((p) => {
    if (filterMode === "all") return true;
    return p.status === filterMode;
  });

  // Group properties by floor
  // Separate floors with numbers and unassigned
  const floorMap: Record<string, { floorNum: number | null; label: string; props: CachedPropertyProgress[] }> = {};

  for (const prop of filteredProperties) {
    const fNum = prop.floorNumber !== null && prop.floorNumber !== undefined ? prop.floorNumber : null;
    const key = fNum !== null ? `floor_${fNum}` : "floor_unassigned";
    const label = fNum !== null ? (fNum === 0 ? "Ground Floor" : `Floor ${fNum}`) : "Floor Not Specified";

    if (!floorMap[key]) {
      floorMap[key] = {
        floorNum: fNum,
        label,
        props: [],
      };
    }
    floorMap[key].props.push(prop);
  }

  // Sort floors: highest floor down to Ground floor (0), then unassigned at end
  const sortedFloorGroups = Object.values(floorMap).sort((a, b) => {
    if (a.floorNum === null) return 1;
    if (b.floorNum === null) return -1;
    return b.floorNum - a.floorNum;
  });

  // Find next suggested property (first not_visited, or first pending)
  const nextProperty = properties.find((p) => p.status === "not_visited") ||
    properties.find((p) => p.status === "pending");

  // Duplicate check for modal
  const trimmedUnit = unitNumber.trim();
  const existingDuplicate = trimmedUnit
    ? properties.find((p) => p.unitNumber.toLowerCase() === trimmedUnit.toLowerCase())
    : null;

  const handleCreateFlat = async (mode: "save" | "continue") => {
    if (!trimmedUnit || !onAddProperty) return;
    setSubmittingFlat(true);
    try {
      const parsedFloor = floorNumber.trim() ? parseInt(floorNumber.trim(), 10) : null;
      const createdProp = await onAddProperty({
        unitNumber: trimmedUnit,
        floorNumber: Number.isFinite(parsedFloor) ? parsedFloor : null,
        ownerName: ownerName.trim() || undefined,
        contactMobile: contactMobile.trim() || undefined,
      });

      setShowAddFlat(false);
      setUnitNumber("");
      setFloorNumber("");
      setOwnerName("");
      setContactMobile("");

      if (mode === "continue" && createdProp) {
        onSelectProperty(createdProp);
      }
    } catch (err) {
      console.error("Error creating flat:", err);
    } finally {
      setSubmittingFlat(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------------
          TOP BAR & NAVIGATION
      -------------------------------------------------------------- */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline py-1"
        >
          ← All Buildings
        </button>

        <div className="flex items-center gap-2">
          {onAddProperty && (
            <Button
              size="sm"
              variant="outline"
              className="font-semibold text-xs h-8 px-3 border-dashed border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => setShowAddFlat(true)}
            >
              + Add Flat
            </Button>
          )}

          {onStartNextFlat && nextProperty && (
            <Button
              size="sm"
              className="font-semibold text-xs h-8 px-3"
              onClick={onStartNextFlat}
            >
              ⚡ Next: Flat {nextProperty.unitNumber} →
            </Button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          BUILDING HEADER & HONEST COUNTS MATRIX
      -------------------------------------------------------------- */}
      <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">
                🏢 {building.buildingName} {building.wing ? `(Wing ${building.wing})` : ""}
              </h2>
              {isCompleted ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                  ✓ Building Completed
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  Active Collection
                </span>
              )}
            </div>
            {building.areaName && (
              <p className="text-xs text-muted-foreground mt-0.5">{building.areaName}</p>
            )}
          </div>

          {onToggleComplete && (
            <Button
              size="sm"
              variant={isCompleted ? "outline" : "secondary"}
              className="text-xs h-8 px-2.5 shrink-0"
              onClick={() => onToggleComplete(building.buildingId, !isCompleted)}
            >
              {isCompleted ? "Reopen Building" : "✓ Mark Complete"}
            </Button>
          )}
        </div>

        {/* Honest Breakdown Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted/40 border p-2 col-span-2 sm:col-span-1">
            <div className="font-bold text-base text-foreground">
              {totalRecorded}
            </div>
            <div className="text-[11px] text-muted-foreground">Flats Recorded</div>
          </div>

          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
            <div className="font-bold text-base text-emerald-700 dark:text-emerald-400">
              {collectedCount}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Collected</div>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
            <div className="font-bold text-base text-amber-700 dark:text-amber-400">
              {pendingCount}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400">Pending</div>
          </div>

          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
            <div className="font-bold text-base text-rose-700 dark:text-rose-400">
              {refusedCount}
            </div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400">Refused</div>
          </div>

          <div className="rounded-lg bg-slate-500/10 border border-slate-500/20 p-2 col-span-2 sm:col-span-1">
            <div className="font-bold text-base text-slate-800 dark:text-slate-200">
              ₹{totalCollectedAmount.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-muted-foreground">Total Raised</div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
              filterMode === "all"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted/70 text-muted-foreground hover:bg-muted"
            }`}
          >
            All ({totalRecorded})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("collected")}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
              filterMode === "collected"
                ? "bg-emerald-600 text-white font-semibold"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
            }`}
          >
            Collected ({collectedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("pending")}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
              filterMode === "pending"
                ? "bg-amber-600 text-white font-semibold"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("refused")}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
              filterMode === "refused"
                ? "bg-rose-600 text-white font-semibold"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
            }`}
          >
            Refused ({refusedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("not_visited")}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
              filterMode === "not_visited"
                ? "bg-slate-700 text-white font-semibold"
                : "bg-slate-500/10 text-slate-700 dark:text-slate-300 hover:bg-slate-500/20"
            }`}
          >
            Not Visited ({notVisitedCount})
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          FLATS GRID (FLOOR BY FLOOR)
      -------------------------------------------------------------- */}
      {loading && properties.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading building flats...
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center space-y-3">
          <div className="text-3xl">🚪</div>
          <h3 className="text-base font-bold text-foreground">No Flats Recorded Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Record flats progressively as your team knocks on doors. No bulk generation or template setup needed.
          </p>
          {onAddProperty && (
            <Button
              size="sm"
              onClick={() => setShowAddFlat(true)}
              className="mt-2 font-semibold text-xs"
            >
              + Add First Flat
            </Button>
          )}
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No flats match the selected filter.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedFloorGroups.map((group) => (
            <div key={group.label} className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {group.props.length} {group.props.length === 1 ? "Flat" : "Flats"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {group.props.map((prop) => {
                  let styleClass = "border-muted/80 bg-background text-foreground hover:border-primary/50 hover:bg-muted/30";
                  let badgeText = "Not Visited";
                  let badgeClass = "bg-muted text-muted-foreground";

                  if (prop.status === "collected") {
                    styleClass = "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 font-semibold hover:bg-emerald-500/15";
                    badgeText = `₹${prop.totalCollectedAmount} ✓`;
                    badgeClass = "bg-emerald-600 text-white font-bold";
                  } else if (prop.status === "pending") {
                    styleClass = "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 font-semibold hover:bg-amber-500/15";
                    badgeText = prop.pendingReason === "asked_to_return_later" ? "Come Later ⏰" : "Pending ⏰";
                    badgeClass = "bg-amber-600 text-white font-medium";
                  } else if (prop.status === "refused") {
                    styleClass = "border-rose-500/30 bg-rose-500/5 text-rose-950 dark:text-rose-200 opacity-80 hover:bg-rose-500/10";
                    badgeText = "Refused 🚫";
                    badgeClass = "bg-rose-700 text-white font-medium";
                  }

                  return (
                    <button
                      key={prop.propertyId}
                      type="button"
                      onClick={() => onSelectProperty(prop)}
                      className={`min-h-[64px] p-3 rounded-xl border-2 text-left flex flex-col justify-between transition-all active:scale-[0.98] cursor-pointer shadow-xs ${styleClass}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-base font-bold tracking-tight">
                          Flat {prop.unitNumber}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-1 w-full">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${badgeClass}`}>
                          {badgeText}
                        </span>
                        {prop.ownerName && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[85px] text-right font-normal">
                            {prop.ownerName}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: PROGRESSIVE ADD FLAT
      -------------------------------------------------------------- */}
      {showAddFlat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  + Add Flat to {building.buildingName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Record new flat discovered at door
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFlat(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-left">
              <div className="space-y-1">
                <Label htmlFor="prog-flat-unit" className="text-xs font-semibold">
                  Flat / Unit Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prog-flat-unit"
                  placeholder="e.g. 401, 102, Shop 1"
                  value={unitNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUnitNumber(val);
                    // Auto-suggest floor if numeric
                    const numMatch = val.match(/^(\d+)/);
                    if (numMatch && !floorNumber) {
                      const num = parseInt(numMatch[1], 10);
                      if (num >= 100) {
                        setFloorNumber(String(Math.floor(num / 100)));
                      }
                    }
                  }}
                  className="font-medium"
                  autoFocus
                />
              </div>

              {existingDuplicate && (
                <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                  ⚠️ <strong>Flat {existingDuplicate.unitNumber}</strong> is already recorded in this building.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="prog-flat-floor" className="text-xs font-medium text-muted-foreground">
                    Floor (Optional)
                  </Label>
                  <Input
                    id="prog-flat-floor"
                    type="number"
                    placeholder="e.g. 4"
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="prog-flat-mobile" className="text-xs font-medium text-muted-foreground">
                    Mobile (Optional)
                  </Label>
                  <Input
                    id="prog-flat-mobile"
                    type="tel"
                    placeholder="10-digit mobile"
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="prog-flat-owner" className="text-xs font-medium text-muted-foreground">
                  Resident / Owner Name (Optional)
                </Label>
                <Input
                  id="prog-flat-owner"
                  placeholder="e.g. Rajesh Sharma"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-3 border-t flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddFlat(false)}
                disabled={submittingFlat}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleCreateFlat("save")}
                disabled={!trimmedUnit || submittingFlat || !!existingDuplicate}
              >
                Add Flat
              </Button>
              <Button
                type="button"
                size="sm"
                className="font-bold bg-primary hover:bg-primary/90"
                onClick={() => void handleCreateFlat("continue")}
                disabled={!trimmedUnit || submittingFlat || !!existingDuplicate}
              >
                ⚡ Add & Continue →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
