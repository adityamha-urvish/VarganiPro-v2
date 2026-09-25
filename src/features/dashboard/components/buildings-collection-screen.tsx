import { useState } from "react";
import type { CachedBuildingSummary } from "@/lib/offline/offline-db";
import type { PropertyRecord } from "@/features/admin/master-data/services/master-data.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BuildingsCollectionScreenProps {
  buildings: CachedBuildingSummary[];
  loading: boolean;
  eventCode?: string;
  onSelectBuilding: (building: CachedBuildingSummary) => void;
  onOpenCollect: (building: CachedBuildingSummary) => void;
  onViewFlats: (building: CachedBuildingSummary) => void;
  onRefresh?: () => void;
  onStartCollection?: () => void;
  onAddBuilding?: (name: string, wing?: string) => Promise<unknown> | void;
  shops?: PropertyRecord[];
  loadingShops?: boolean;
  onSelectShop?: (shop: PropertyRecord) => void;
  onAddShop?: (input: { shopName: string; ownerName?: string; contactMobile?: string }) => Promise<unknown>;
  isAdmin?: boolean;
}

export function BuildingsCollectionScreen({
  buildings,
  loading,
  eventCode = "GU-26",
  onSelectBuilding,
  onOpenCollect,
  onViewFlats,
  onRefresh,
  onStartCollection,
  onAddBuilding,
  shops = [],
  loadingShops = false,
  onSelectShop,
  onAddShop,
  isAdmin: _isAdmin = false,
}: BuildingsCollectionScreenProps) {
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<"residential" | "commercial">("residential");

  // Add Building Modal State


  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingWing, setNewBuildingWing] = useState("");
  const [submittingBuilding, setSubmittingBuilding] = useState(false);
  const [addBuildingError, setAddBuildingError] = useState<string | null>(null);

  // Add Shop Modal State
  const [showAddShop, setShowAddShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopOwner, setNewShopOwner] = useState("");
  const [newShopMobile, setNewShopMobile] = useState("");
  const [submittingShop, setSubmittingShop] = useState(false);
  const [addShopError, setAddShopError] = useState<string | null>(null);

  // Pastel theme cycle for cards matching reference
  const pastelStyles = [
    {
      cardBg: "bg-[#E9F6ED]",
      border: "border-[#C8E6D0]",
      badgeBg: "bg-emerald-100 text-emerald-800",
      progressBg: "bg-emerald-500",
      titleColor: "text-emerald-950",
    },
    {
      cardBg: "bg-[#E8F2FA]",
      border: "border-[#C5DFF2]",
      badgeBg: "bg-sky-100 text-sky-800",
      progressBg: "bg-sky-500",
      titleColor: "text-sky-950",
    },
    {
      cardBg: "bg-[#FEF5E7]",
      border: "border-[#FCE2B8]",
      badgeBg: "bg-amber-100 text-amber-900",
      progressBg: "bg-amber-500",
      titleColor: "text-amber-950",
    },
  ];

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuildingName.trim() || !onAddBuilding) return;
    setSubmittingBuilding(true);
    setAddBuildingError(null);
    try {
      await onAddBuilding(newBuildingName.trim(), newBuildingWing.trim() || undefined);
      setShowAddBuilding(false);
      setNewBuildingName("");
      setNewBuildingWing("");
    } catch (err: any) {
      setAddBuildingError(err.message || "Failed to add building");
    } finally {
      setSubmittingBuilding(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim() || !onAddShop) return;
    setSubmittingShop(true);
    setAddShopError(null);
    try {
      await onAddShop({
        shopName: newShopName.trim(),
        ownerName: newShopOwner.trim() || undefined,
        contactMobile: newShopMobile.trim() || undefined,
      });
      setShowAddShop(false);
      setNewShopName("");
      setNewShopOwner("");
      setNewShopMobile("");
    } catch (err: any) {
      setAddShopError(err.message || "Failed to add shop");
    } finally {
      setSubmittingShop(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 sm:space-y-5 px-1 sm:px-0 py-1 sm:py-2 animate-in fade-in select-none">
      {/* -------------------------------------------------------------
          1. HEADER: BUILDING / SHOP COLLECTION + DIYA
      -------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{propertyTypeFilter === "commercial" ? "🏪" : "🪔"}</span>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#800020] tracking-tight">
              {propertyTypeFilter === "commercial" ? "Commercial Shops" : "Building Collection"}
            </h1>
            <p className="text-xs font-semibold text-slate-500">
              {propertyTypeFilter === "commercial" ? "Shops & Establishments" : "Buildings List"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="h-8 w-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-950 flex items-center justify-center text-xs font-bold cursor-pointer shadow-2xs"
              title="रीफ्रेश करा / Refresh"
            >
              ↻
            </button>
          )}

          {propertyTypeFilter === "residential" && onAddBuilding && (
            <button
              type="button"
              data-testid="volunteer-add-building-btn"
              onClick={() => setShowAddBuilding(true)}
              className="text-xs font-bold bg-[#800020] text-white px-2.5 py-1.5 rounded-xl hover:bg-[#6b001a] transition-colors cursor-pointer"
            >
              + Add
            </button>
          )}

          {propertyTypeFilter === "commercial" && onAddShop && (
            <button
              type="button"
              data-testid="volunteer-add-shop-btn"
              onClick={() => setShowAddShop(true)}
              className="text-xs font-bold bg-[#800020] text-white px-2.5 py-1.5 rounded-xl hover:bg-[#6b001a] transition-colors cursor-pointer"
            >
              + Add Shop
            </button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. SEGMENTED FILTER: RESIDENTIAL / COMMERCIAL
      -------------------------------------------------------------- */}
      <div className="flex items-center gap-2 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          data-testid="filter-residential"
          onClick={() => setPropertyTypeFilter("residential")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            propertyTypeFilter === "residential"
              ? "bg-[#0B2530] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🏢</span>
          <span>Residential ({buildings.length})</span>
        </button>

        <button
          type="button"
          data-testid="filter-commercial"
          onClick={() => setPropertyTypeFilter("commercial")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            propertyTypeFilter === "commercial"
              ? "bg-[#0B2530] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🏪</span>
          <span>Commercial ({shops.length})</span>
        </button>
      </div>

      {/* -------------------------------------------------------------
          3. LIST VIEW: BUILDINGS OR COMMERCIAL SHOPS
      -------------------------------------------------------------- */}
      {propertyTypeFilter === "commercial" ? (
        loadingShops && shops.length === 0 ? (
          <div className="p-8 text-center text-xs font-medium text-slate-500 animate-pulse bg-white rounded-3xl border border-slate-200">
            Loading commercial shops...
          </div>
        ) : shops.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 text-center space-y-3 shadow-2xs">
            <span className="text-3xl block">🏪</span>
            <h3 className="text-base font-bold text-slate-900">No Commercial Shops</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add market shops and commercial establishments in the mandal area.
            </p>
            {onAddShop && (
              <div className="pt-2">
                <Button
                  type="button"
                  data-testid="btn-add-shop-empty-state"
                  onClick={() => setShowAddShop(true)}
                  className="bg-[#800020] hover:bg-[#6b001a] text-white text-xs font-bold rounded-xl px-4 h-9"
                >
                  ➕ Add Shop (दुकान जोडा)
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {shops.map((shop, idx) => {
              const style = pastelStyles[idx % pastelStyles.length];
              return (
                <div
                  key={shop.id}
                  data-testid={`volunteer-shop-card-${shop.id}`}
                  className={`rounded-3xl border ${style.border} ${style.cardBg} p-4 sm:p-5 shadow-xs space-y-3 transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className={`text-base font-black ${style.titleColor}`}>
                        🏪 {shop.shopName}
                      </h3>
                      <div className="text-xs font-semibold text-slate-600 mt-1 space-y-0.5">
                        {shop.ownerName && <p>👤 {shop.ownerName}</p>}
                        {shop.contactMobile && <p>📞 {shop.contactMobile}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-slate-700">
                      Commercial
                    </span>
                  </div>

                  <div className="pt-1">
                    {onSelectShop && (
                      <button
                        type="button"
                        data-testid={`btn-collect-shop-${shop.id}`}
                        onClick={() => onSelectShop(shop)}
                        className="w-full h-10 rounded-xl bg-[#E56345] hover:bg-[#D45336] text-white text-xs font-black tracking-wide shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>⚡ collect receipt (पावती फाडा)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loading && buildings.length === 0 ? (
        <div className="p-8 text-center text-xs font-medium text-slate-500 animate-pulse bg-white rounded-3xl border border-slate-200">
          Loading buildings...
        </div>
      ) : buildings.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center space-y-3 shadow-2xs">
          <span className="text-3xl block">🏢</span>
          <h3 className="text-base font-bold text-slate-900">No Buildings Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No residential buildings are available for this event yet.
          </p>
          {onAddBuilding && (
            <div className="pt-2">
              <Button
                type="button"
                data-testid="btn-add-building-empty-state"
                onClick={() => setShowAddBuilding(true)}
                className="bg-[#800020] hover:bg-[#6b001a] text-white text-xs font-bold rounded-xl px-4 h-9"
              >
                ➕ Add Building (इमारत जोडा)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {buildings.map((bld: any, idx) => {
            const style = pastelStyles[idx % pastelStyles.length];
            const collected = bld.collectedCount ?? bld.collectedUnits ?? 0;
            const totalUnits =
              bld.totalUnits && bld.totalUnits > 0
                ? bld.totalUnits
                : Math.max(
                    1,
                    collected +
                      (bld.pendingCount || bld.pendingUnits || 0) +
                      (bld.notVisitedCount || bld.unvisitedUnits || 0)
                  );
            const progressPct =
              bld.completionPercentage ??
              (Math.min(100, Math.round((collected / totalUnits) * 100)) || 0);

            return (
              <div
                key={bld.buildingId}
                className={`rounded-3xl border ${style.border} ${style.cardBg} p-4 sm:p-5 shadow-xs space-y-3 transition-all hover:shadow-sm`}
              >
                {/* Title & Stats */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className={`text-base font-black ${style.titleColor}`}>
                      {bld.buildingName} {bld.wing ? `· Wing ${bld.wing}` : ""}
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      {collected} / {totalUnits} Flats Collected
                    </p>
                  </div>
                  {progressPct === 100 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                      ✓ Complete
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badgeBg}`}>
                      {progressPct}% Done
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden border border-black/5">
                  <div
                    className={`${style.progressBg} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    data-testid={`btn-view-flats-${bld.buildingId}`}
                    onClick={() => {
                      onSelectBuilding(bld);
                      onViewFlats(bld);
                    }}
                    className="flex-1 h-9 rounded-xl border border-slate-300/90 bg-white/90 hover:bg-white text-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>view flats</span>
                    <span>→</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`btn-collect-${bld.buildingId}`}
                    onClick={() => {
                      onSelectBuilding(bld);
                      onOpenCollect(bld);
                    }}
                    className="flex-1 h-9 rounded-xl bg-[#E56345] hover:bg-[#D45336] text-white text-xs font-black tracking-wide shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>⚡ collect</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------
          4. BOTTOM CTA: START COLLECTION
      -------------------------------------------------------------- */}
      {onStartCollection && (
        <div className="pt-2">
          <button
            type="button"
            data-testid="buildings-cta-start-collection"
            onClick={onStartCollection}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#800020] via-[#A82400] to-[#E05300] hover:from-[#6B001B] hover:to-[#C74900] text-white font-extrabold text-base tracking-tight shadow-lg shadow-orange-950/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>⚡</span>
            <span className="font-brand-marathi font-black">
              Start Collection for {eventCode}
            </span>
            <span className="text-lg leading-none">→</span>
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------
          ADD BUILDING MODAL
      -------------------------------------------------------------- */}
      {showAddBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white border p-5 shadow-2xl space-y-4 animate-in zoom-in-95 text-left">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-base font-bold text-slate-900">
                🏢 Add Building (इमारत जोडा)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBuilding(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {addBuildingError && (
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                {addBuildingError}
              </div>
            )}

            <form onSubmit={handleCreateBuilding} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="building-name" className="text-xs font-bold text-slate-700">
                  Building Name *
                </Label>
                <Input
                  id="building-name"
                  data-testid="input-building-name"
                  placeholder="उदा. गोकुळधाम, साई निवास"
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  className="h-10 text-sm rounded-xl"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="building-wing" className="text-xs font-bold text-slate-700">
                  Wing (पर्यायी)
                </Label>
                <Input
                  id="building-wing"
                  data-testid="input-building-wing"
                  placeholder="उदा. A, B, 1"
                  value={newBuildingWing}
                  onChange={(e) => setNewBuildingWing(e.target.value)}
                  className="h-10 text-sm rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddBuilding(false)}
                  className="flex-1 h-10 rounded-xl text-xs"
                >
                  रद्द करा (Cancel)
                </Button>
                <Button
                  type="submit"
                  disabled={submittingBuilding || !newBuildingName.trim()}
                  data-testid="btn-submit-building"
                  className="flex-1 h-10 rounded-xl text-xs font-bold bg-[#800020] hover:bg-[#6b001a] text-white"
                >
                  {submittingBuilding ? "जोडत आहे..." : "जतन करा (Save)"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          ADD SHOP MODAL
      -------------------------------------------------------------- */}
      {showAddShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white border p-5 shadow-2xl space-y-4 animate-in zoom-in-95 text-left">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-base font-bold text-slate-900">
                🏪 Add Commercial Shop (दुकान जोडा)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddShop(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {addShopError && (
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                {addShopError}
              </div>
            )}

            <form onSubmit={handleCreateShop} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="shop-name" className="text-xs font-bold text-slate-700">
                  Shop Name (दुकानाचे नाव) *
                </Label>
                <Input
                  id="shop-name"
                  data-testid="input-shop-name"
                  placeholder="उदा. साई मेडिकल, गणेश किराणा"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="h-10 text-sm rounded-xl"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop-owner" className="text-xs font-bold text-slate-700">
                  Owner Name (दुकानदाराचे नाव)
                </Label>
                <Input
                  id="shop-owner"
                  data-testid="input-shop-owner"
                  placeholder="उदा. सुरेश पाटील"
                  value={newShopOwner}
                  onChange={(e) => setNewShopOwner(e.target.value)}
                  className="h-10 text-sm rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop-mobile" className="text-xs font-bold text-slate-700">
                  Mobile Number (मोबाईल)
                </Label>
                <Input
                  id="shop-mobile"
                  data-testid="input-shop-mobile"
                  type="tel"
                  placeholder="10 अंकी मोबाईल क्रमांक"
                  value={newShopMobile}
                  onChange={(e) => setNewShopMobile(e.target.value)}
                  className="h-10 text-sm rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddShop(false)}
                  className="flex-1 h-10 rounded-xl text-xs"
                >
                  रद्द करा (Cancel)
                </Button>
                <Button
                  type="submit"
                  disabled={submittingShop || !newShopName.trim()}
                  data-testid="btn-submit-shop"
                  className="flex-1 h-10 rounded-xl text-xs font-bold bg-[#800020] hover:bg-[#6b001a] text-white"
                >
                  {submittingShop ? "जोडत आहे..." : "जतन करा (Save)"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
