import type { CachedBuildingSummary } from "@/lib/offline/offline-db";
import { Button } from "@/components/ui/button";

export interface ContinueCollectionCardProps {
  buildings: CachedBuildingSummary[];
  loading: boolean;
  onSelectBuilding: (building: CachedBuildingSummary) => void;
  onRefresh: () => void;
}

export function ContinueCollectionCard({
  buildings,
  loading,
  onSelectBuilding,
  onRefresh,
}: ContinueCollectionCardProps) {
  if (loading && buildings.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Continue Collection</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading building progress...</p>
      </div>
    );
  }

  if (buildings.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Continue Collection</h2>
        <p className="mt-2 text-sm text-muted-foreground">No buildings found for this event.</p>
        <Button variant="outline" className="mt-4" onClick={onRefresh}>
          Refresh Buildings
        </Button>
      </div>
    );
  }

  const activeBuilding = buildings.find((b) => b.remainingCount > 0 && b.collectedCount > 0) ||
    buildings.find((b) => b.remainingCount > 0) ||
    buildings[0];

  const allCompleted =
    buildings.length > 0 &&
    buildings.every((b) => b.totalUnits > 0 && b.remainingCount === 0);

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------------
          TOP HERO: ACTIVE IN-PROGRESS BUILDING ("CONTINUE COLLECTION")
      -------------------------------------------------------------- */}
      {activeBuilding && !allCompleted && (
        <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-amber-500/10 via-background to-background p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              ⚡ ACTIVE IN-PROGRESS
            </span>
            {activeBuilding.lastActivityAt && (
              <span className="text-xs text-muted-foreground">
                Active {new Date(activeBuilding.lastActivityAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-foreground">
              🏢 {activeBuilding.buildingName} {activeBuilding.wing ? `(Wing ${activeBuilding.wing})` : ""}
            </h3>
            {activeBuilding.areaName && (
              <p className="text-sm text-muted-foreground">{activeBuilding.areaName}</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1.5">
              <span>Progress</span>
              <span>
                {Math.round((activeBuilding.collectedCount / Math.max(activeBuilding.totalUnits, 1)) * 100)}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
              <div
                className="bg-emerald-600 transition-all duration-300"
                style={{
                  width: `${(activeBuilding.collectedCount / Math.max(activeBuilding.totalUnits, 1)) * 100}%`,
                }}
              />
              <div
                className="bg-amber-500 transition-all duration-300"
                style={{
                  width: `${(activeBuilding.pendingCount / Math.max(activeBuilding.totalUnits, 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Counts Matrix */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/20">
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {activeBuilding.collectedCount}
              </div>
              <div className="text-xs text-muted-foreground">Collected</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {activeBuilding.pendingCount}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="rounded-lg bg-slate-500/10 p-2.5 border border-slate-500/20">
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {activeBuilding.remainingCount}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
          </div>

          {/* Primary Action Button */}
          <Button
            size="lg"
            className="mt-5 w-full text-base font-semibold h-13 rounded-xl shadow"
            onClick={() => onSelectBuilding(activeBuilding)}
          >
            ▶ Continue {activeBuilding.buildingName} →
          </Button>
        </div>
      )}

      {allCompleted && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center shadow-sm">
          <span className="text-3xl">🎉</span>
          <h3 className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-300">
            All Buildings Completed!
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            All assigned buildings have been collected.
          </p>
        </div>
      )}

      {/* -------------------------------------------------------------
          DIRECTORY: ALL BUILDINGS & AREAS
      -------------------------------------------------------------- */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b">
          <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">
            All Buildings ({buildings.length})
          </h4>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-primary hover:underline font-medium"
          >
            Refresh
          </button>
        </div>

        <div className="divide-y mt-1">
          {buildings.map((b) => {
            const isDone = b.totalUnits > 0 && b.remainingCount === 0;
            return (
              <div
                key={b.buildingId}
                onClick={() => onSelectBuilding(b)}
                className="py-3.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>🏢 {b.buildingName} {b.wing ? `(${b.wing})` : ""}</span>
                    {isDone && (
                      <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5">
                        DONE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {b.collectedCount} collected • {b.pendingCount} pending • {b.remainingCount} left (₹{b.totalAmountCollected})
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">Open →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
