import type { CachedBuildingSummary } from "@/lib/offline/offline-db";
import { Button } from "@/components/ui/button";

export interface ContinueCollectionCardProps {
  buildings: CachedBuildingSummary[];
  loading: boolean;
  hasActiveSession?: boolean;
  onSelectBuilding: (building: CachedBuildingSummary) => void;
  onRefresh: () => void;
  onStartSession?: () => void;
}

export function ContinueCollectionCard({
  buildings,
  loading,
  hasActiveSession = true,
  onSelectBuilding,
  onRefresh,
  onStartSession,
}: ContinueCollectionCardProps) {
  if (loading && buildings.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-xs text-center space-y-2">
        <span className="text-2xl block animate-pulse">🏢</span>
        <h2 className="text-base font-bold text-slate-900 font-brand-marathi">
          इमारती लोड होत आहेत...
        </h2>
        <p className="text-xs text-slate-500">Loading building progress...</p>
      </div>
    );
  }

  if (buildings.length === 0) {
    if (!hasActiveSession) {
      return (
        <div className="rounded-2xl border bg-white p-6 shadow-xs text-center space-y-4 animate-in fade-in">
          <span className="text-4xl block">🏢</span>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 font-brand-marathi">
              इमारती आणि फ्लॅट्स
            </h2>
            <p className="text-xs text-slate-500 font-medium">Buildings & Flats</p>
          </div>
          <p className="text-xs text-slate-600 max-w-xs mx-auto">
            सत्र सुरू केल्यानंतर इमारत निवडता येईल.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            {onStartSession && (
              <Button
                type="button"
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-xs cursor-pointer"
                onClick={onStartSession}
              >
                <span>संकलन सुरू करा (Start Session)</span>
                <span className="ml-1">→</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="text-xs h-10 px-4 rounded-xl border-slate-200 cursor-pointer"
              onClick={onRefresh}
            >
              रिफ्रेश · Refresh
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border bg-white p-6 shadow-xs text-center space-y-4 animate-in fade-in">
        <span className="text-4xl block">🏢</span>
        <div className="space-y-1">
          <h2 className="text-lg font-black text-slate-900 font-brand-marathi">
            इमारती आणि फ्लॅट्स
          </h2>
          <p className="text-xs text-slate-500 font-medium">Buildings & Flats</p>
        </div>
        <p className="text-xs text-slate-600 max-w-xs mx-auto">
          या उत्सवासाठी कोणतीही इमारत सापडली नाही.
        </p>
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            className="text-xs h-10 px-4 rounded-xl border-slate-200 cursor-pointer"
            onClick={onRefresh}
          >
            रिफ्रेश · Refresh Buildings
          </Button>
        </div>
      </div>
    );
  }

  const activeBuilding =
    buildings.find((b) => b.remainingCount > 0 && b.collectedCount > 0) ||
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
        <div className="rounded-2xl border-2 border-orange-500/20 bg-gradient-to-br from-amber-500/10 via-background to-background p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-700">
              ⚡ चालू इमारत · Active
            </span>
            {activeBuilding.lastActivityAt && (
              <span className="text-xs text-muted-foreground">
                Active {new Date(activeBuilding.lastActivityAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              🏢 {activeBuilding.buildingName} {activeBuilding.wing ? `(Wing ${activeBuilding.wing})` : ""}
            </h3>
            {activeBuilding.areaName && (
              <p className="text-xs sm:text-sm text-muted-foreground">{activeBuilding.areaName}</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
              <span>प्रगती · Progress</span>
              <span>
                {Math.round((activeBuilding.collectedCount / Math.max(activeBuilding.totalUnits, 1)) * 100)}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
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
            <div className="rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20">
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {activeBuilding.collectedCount}
              </div>
              <div className="text-[11px] font-bold text-emerald-800/80">पूर्ण · Done</div>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/20">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {activeBuilding.pendingCount}
              </div>
              <div className="text-[11px] font-bold text-amber-800/80">प्रलंबित · Pending</div>
            </div>
            <div className="rounded-xl bg-slate-500/10 p-2.5 border border-slate-500/20">
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {activeBuilding.remainingCount}
              </div>
              <div className="text-[11px] font-bold text-slate-600">शिल्लक · Remaining</div>
            </div>
          </div>

          {/* Primary Action Button */}
          <Button
            size="lg"
            className="mt-5 w-full text-base font-bold h-14 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md shadow-orange-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            onClick={() => onSelectBuilding(activeBuilding)}
          >
            <span>▶ Continue {activeBuilding.buildingName}</span>
            <span className="text-base leading-none">→</span>
          </Button>
        </div>
      )}

      {allCompleted && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center shadow-xs">
          <span className="text-3xl">🎉</span>
          <h3 className="mt-2 text-lg font-bold text-emerald-800 dark:text-emerald-300 font-brand-marathi">
            सर्व इमारती पूर्ण झाल्या!
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            All assigned buildings have been collected.
          </p>
        </div>
      )}

      {/* -------------------------------------------------------------
          DIRECTORY: ALL BUILDINGS & AREAS
      -------------------------------------------------------------- */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b">
          <h4 className="font-bold text-foreground text-xs sm:text-sm uppercase tracking-wider font-brand-marathi">
            सर्व इमारती · All Buildings ({buildings.length})
          </h4>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-orange-600 hover:text-orange-700 hover:underline font-bold cursor-pointer"
          >
            रिफ्रेश · Refresh
          </button>
        </div>

        <div className="space-y-2.5">
          {buildings.map((b) => {
            const isDone = b.totalUnits > 0 && b.remainingCount === 0;
            return (
              <div
                key={b.buildingId}
                onClick={() => onSelectBuilding(b)}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-200 transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                    <span>🏢 {b.buildingName} {b.wing ? `(Wing ${b.wing})` : ""}</span>
                    {isDone && (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                        पूर्ण · DONE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {b.collectedCount} संकलित · {b.pendingCount} प्रलंबित · {b.remainingCount} शिल्लक (₹{b.totalAmountCollected})
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <span className="h-9 px-3.5 rounded-xl bg-white border border-slate-200/80 text-orange-600 font-bold text-xs flex items-center justify-center gap-1 shadow-2xs hover:bg-orange-50 transition-colors">
                    <span>उघडा · Open</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
