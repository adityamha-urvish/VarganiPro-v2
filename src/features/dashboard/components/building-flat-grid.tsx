import type { CachedBuildingSummary, CachedPropertyProgress } from "@/lib/offline/offline-db";
import { Button } from "@/components/ui/button";

export interface BuildingFlatGridProps {
  building: CachedBuildingSummary;
  properties: CachedPropertyProgress[];
  loading: boolean;
  onBack: () => void;
  onSelectProperty: (property: CachedPropertyProgress) => void;
  onStartNextFlat: () => void;
}

export function BuildingFlatGrid({
  building,
  properties,
  loading,
  onBack,
  onSelectProperty,
  onStartNextFlat,
}: BuildingFlatGridProps) {
  // Compute live breakdown counts from properties
  const collectedCount = properties.filter((p) => p.status === "collected").length;
  const pendingCount = properties.filter((p) => p.status === "pending").length;
  const refusedCount = properties.filter((p) => p.status === "refused").length;
  const notVisitedCount = properties.filter((p) => p.status === "not_visited").length;
  const remainingCount = pendingCount + notVisitedCount;

  // Group properties by floor
  const floorGroups = properties.reduce<Record<string, CachedPropertyProgress[]>>((acc, prop) => {
    const floorKey = prop.floorNumber !== null && prop.floorNumber !== undefined
      ? `Floor ${prop.floorNumber}`
      : "Units";
    if (!acc[floorKey]) acc[floorKey] = [];
    acc[floorKey].push(prop);
    return acc;
  }, {});

  // Find next suggested property (first not_visited, or first pending)
  const nextProperty = properties.find((p) => p.status === "not_visited") ||
    properties.find((p) => p.status === "pending");

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------------
          TOP BAR & NAVIGATION
      -------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline py-1"
        >
          ← All Buildings
        </button>

        <div className="flex items-center gap-2">
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
          BUILDING HEADER & COUNTS MATRIX
      -------------------------------------------------------------- */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-xl font-bold text-foreground">
          🏢 {building.buildingName} {building.wing ? `(Wing ${building.wing})` : ""}
        </h2>
        {building.areaName && (
          <p className="text-xs text-muted-foreground mt-0.5">{building.areaName}</p>
        )}

        {/* 4 Status Badges */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
            <div className="font-bold text-base text-emerald-700 dark:text-emerald-400">
              {collectedCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Collected</div>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
            <div className="font-bold text-base text-amber-700 dark:text-amber-400">
              {pendingCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Pending</div>
          </div>

          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
            <div className="font-bold text-base text-rose-700 dark:text-rose-400">
              {refusedCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Refused</div>
          </div>

          <div className="rounded-lg bg-slate-500/10 border border-slate-500/20 p-2">
            <div className="font-bold text-base text-slate-700 dark:text-slate-300">
              {remainingCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Remaining</div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          FLATS GRID (FLOOR BY FLOOR)
      -------------------------------------------------------------- */}
      {loading && properties.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Loading building flats...
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No flats registered for this building yet.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(floorGroups).map(([floorLabel, floorProps]) => (
            <div key={floorLabel} className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {floorLabel} ({floorProps.length} units)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {floorProps.map((prop) => {
                  let styleClass = "border-muted bg-background text-foreground hover:border-primary/50";
                  let badgeText = "Not Visited";
                  let badgeClass = "bg-muted text-muted-foreground";

                  if (prop.status === "collected") {
                    styleClass = "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 font-semibold";
                    badgeText = `₹${prop.totalCollectedAmount} ✓`;
                    badgeClass = "bg-emerald-600 text-white font-bold";
                  } else if (prop.status === "pending") {
                    styleClass = "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 font-semibold";
                    badgeText = prop.pendingReason === "asked_to_return_later" ? "Come Later ⏰" : "Pending ⏰";
                    badgeClass = "bg-amber-600 text-white font-medium";
                  } else if (prop.status === "refused") {
                    styleClass = "border-rose-500/30 bg-rose-500/5 text-rose-950 dark:text-rose-200 opacity-75";
                    badgeText = "Refused 🚫";
                    badgeClass = "bg-rose-700 text-white font-medium";
                  }

                  return (
                    <button
                      key={prop.propertyId}
                      type="button"
                      onClick={() => onSelectProperty(prop)}
                      className={`min-h-[58px] p-3 rounded-xl border-2 text-left flex flex-col justify-between transition-all active:scale-95 cursor-pointer ${styleClass}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-base font-bold">
                          Flat {prop.unitNumber}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeClass}`}>
                          {badgeText}
                        </span>
                        {prop.ownerName && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
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
    </div>
  );
}
