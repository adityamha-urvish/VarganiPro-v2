import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchOrganizationBuildings,
  createBuilding,
  fetchBuildingProperties,
  createResidentialFlat,
  fetchStandaloneShops,
  createStandaloneShop,
  type BuildingRecord,
  type PropertyRecord,
} from "../services/master-data.service";

export interface BuildingsManagementPanelProps {
  organizationId: string;
  initialSubTab?: "buildings" | "shops";
  onStartCollection?: (building: BuildingRecord, flat?: PropertyRecord) => void;
  onStartGeneralReceipt?: () => void;
}

export function BuildingsManagementPanel({
  organizationId,
  initialSubTab = "buildings",
  onStartCollection,
  onStartGeneralReceipt,
}: BuildingsManagementPanelProps) {
  const [subTab, setSubTab] = useState<"buildings" | "shops">(initialSubTab);

  // Buildings & Flats state
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingRecord | null>(null);
  const [flats, setFlats] = useState<PropertyRecord[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [loadingFlats, setLoadingFlats] = useState(false);

  // Completed buildings local tracking
  const [completedBuildingIds, setCompletedBuildingIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filterMode, setFilterMode] = useState<"all" | "in_progress" | "pending" | "not_started" | "completed">("all");

  // Minimal Building Creation Modal
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [bldName, setBldName] = useState("");
  const [bldWing, setBldWing] = useState("");
  const [bldArea, setBldArea] = useState("");
  const [submittingBuilding, setSubmittingBuilding] = useState(false);

  // Progressive Add Flat Modal
  const [showAddFlat, setShowAddFlat] = useState(false);
  const [flatUnit, setFlatUnit] = useState("");
  const [flatFloor, setFlatFloor] = useState("");
  const [flatOwner, setFlatOwner] = useState("");
  const [flatMobile, setFlatMobile] = useState("");
  const [submittingFlat, setSubmittingFlat] = useState(false);

  // Shops state
  const [shops, setShops] = useState<PropertyRecord[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [showAddShop, setShowAddShop] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopOwner, setShopOwner] = useState("");
  const [shopMobile, setShopMobile] = useState("");
  const [shopLocationNote, setShopLocationNote] = useState("");
  const [submittingShop, setSubmittingShop] = useState(false);

  const loadBuildings = async () => {
    if (!organizationId) return;
    setLoadingBuildings(true);
    try {
      const data = await fetchOrganizationBuildings(organizationId);
      setBuildings(data);
      if (data.length > 0 && !selectedBuilding) {
        // preserve selected
      }
    } catch (err) {
      console.error("Error loading buildings:", err);
    } finally {
      setLoadingBuildings(false);
    }
  };

  const loadFlats = async (bld: BuildingRecord) => {
    setSelectedBuilding(bld);
    setLoadingFlats(true);
    try {
      const data = await fetchBuildingProperties(bld.id);
      setFlats(data);
    } catch (err) {
      console.error("Error loading flats:", err);
    } finally {
      setLoadingFlats(false);
    }
  };

  const loadShops = async () => {
    if (!organizationId) return;
    setLoadingShops(true);
    try {
      const data = await fetchStandaloneShops(organizationId);
      setShops(data);
    } catch (err) {
      console.error("Error loading shops:", err);
    } finally {
      setLoadingShops(false);
    }
  };

  useEffect(() => {
    void loadBuildings();
  }, [organizationId]);

  useEffect(() => {
    if (selectedBuilding) {
      void loadFlats(selectedBuilding);
    }
  }, [selectedBuilding?.id]);

  useEffect(() => {
    if (subTab === "shops") {
      void loadShops();
    }
  }, [subTab, organizationId]);

  // Handle Minimal Building Creation (No Bulk Generation)
  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldName.trim()) return;

    setSubmittingBuilding(true);
    try {
      const res = await createBuilding({
        organizationId,
        name: bldName.trim(),
        areaName: bldArea.trim() || undefined,
        wing: bldWing.trim() || undefined,
      });

      setShowAddBuilding(false);
      setBldName("");
      setBldWing("");
      setBldArea("");

      const updated = await fetchOrganizationBuildings(organizationId);
      setBuildings(updated);
      const created = updated.find((b) => b.id === res.buildingId);
      if (created) {
        setSelectedBuilding(created);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create building");
    } finally {
      setSubmittingBuilding(false);
    }
  };

  // Handle Progressive Add Flat (and Add & Continue)
  const handleCreateFlat = async (shouldContinueToCollect: boolean) => {
    if (!selectedBuilding || !flatUnit.trim()) return;

    setSubmittingFlat(true);
    try {
      const res = await createResidentialFlat({
        organizationId,
        buildingId: selectedBuilding.id,
        unitNumber: flatUnit.trim(),
        floorNumber: flatFloor ? parseInt(flatFloor, 10) : undefined,
        ownerName: flatOwner.trim() || undefined,
        contactMobile: flatMobile.trim() || undefined,
      });

      const newFlat: PropertyRecord = {
        id: res.propertyId,
        organizationId,
        buildingId: selectedBuilding.id,
        propertyType: "residential",
        unitNumber: flatUnit.trim(),
        flatNumber: flatUnit.trim(),
        floorNumber: flatFloor ? parseInt(flatFloor, 10) : undefined,
        ownerName: flatOwner.trim() || undefined,
        contactMobile: flatMobile.trim() || undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      setShowAddFlat(false);
      setFlatUnit("");
      setFlatFloor("");
      setFlatOwner("");
      setFlatMobile("");

      await loadFlats(selectedBuilding);

      if (shouldContinueToCollect && onStartCollection) {
        onStartCollection(selectedBuilding, newFlat);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add flat");
    } finally {
      setSubmittingFlat(false);
    }
  };

  // Toggle explicit building completion
  const handleToggleComplete = (buildingId: string) => {
    setCompletedBuildingIds((prev) => {
      const next = new Set(prev);
      if (next.has(buildingId)) {
        next.delete(buildingId);
      } else {
        next.add(buildingId);
      }
      return next;
    });
  };

  // Floor grouping helper
  const floorGroups = flats.reduce<Record<string, PropertyRecord[]>>((acc, flat) => {
    const floorKey = flat.floorNumber !== null && flat.floorNumber !== undefined
      ? `${flat.floorNumber === 0 ? "Ground" : `${flat.floorNumber}${getOrdinal(flat.floorNumber)}`} Floor`
      : "Floor Not Specified";
    if (!acc[floorKey]) acc[floorKey] = [];
    acc[floorKey].push(flat);
    return acc;
  }, {});

  function getOrdinal(n: number) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  // Filtered buildings list
  const filteredBuildings = buildings.filter((b) => {
    const isComplete = completedBuildingIds.has(b.id);
    if (filterMode === "completed") return isComplete;
    if (filterMode === "not_started") return !isComplete;
    return true;
  });

  return (
    <div className="space-y-4 w-full box-border">
      
      {/* -------------------------------------------------------------
          1. TOP NAVIGATION & GENERAL AD HOC RECEIPT ACTION
      -------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSubTab("buildings");
              setSelectedBuilding(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "buildings"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            🏢 Residential Buildings (इमारती)
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab("shops");
              setSelectedBuilding(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "shops"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            🏪 Commercial Shops (दुकाने)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onStartGeneralReceipt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartGeneralReceipt}
              className="text-xs font-bold border-amber-300 text-amber-900 hover:bg-amber-50 h-8"
            >
              ⚡ + General Receipt (मंडप पावती)
            </Button>
          )}

          {subTab === "buildings" && !selectedBuilding && (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddBuilding(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-8 cursor-pointer"
            >
              ➕ Add Building (इमारत जोडा)
            </Button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. RESIDENTIAL BUILDINGS VIEW
      -------------------------------------------------------------- */}
      {subTab === "buildings" && (
        <>
          {/* Detail View for Selected Building */}
          {selectedBuilding ? (
            <div className="space-y-4 animate-in fade-in" data-testid="building-detail-view">
              
              {/* Top Bar with Back Button and Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedBuilding(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  ← Back to All Buildings (सर्व इमारती)
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleComplete(selectedBuilding.id)}
                    className={`text-xs font-bold h-8 ${
                      completedBuildingIds.has(selectedBuilding.id)
                        ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                        : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {completedBuildingIds.has(selectedBuilding.id)
                      ? "✓ Building Complete (पूर्ण)"
                      : "Mark Building Complete (पूर्ण करा)"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddFlat(true)}
                    className="border-slate-300 text-slate-800 font-bold text-xs h-8 cursor-pointer"
                  >
                    ➕ Add Flat (फ्लॅट जोडा)
                  </Button>

                  {onStartCollection && flats.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onStartCollection(selectedBuilding, flats[0])}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-8 cursor-pointer"
                    >
                      ⚡ Start Collection →
                    </Button>
                  )}
                </div>
              </div>

              {/* Building Header Hero Card */}
              <div className="rounded-2xl bg-gradient-to-br from-[#081E26] via-[#0B2530] to-[#0F2D38] border border-teal-900/40 text-white p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-white">
                        🏢 {selectedBuilding.name} {selectedBuilding.wing ? `(Wing ${selectedBuilding.wing})` : ""}
                      </h3>
                      {completedBuildingIds.has(selectedBuilding.id) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          DISCOVERY IN PROGRESS
                        </span>
                      )}
                    </div>
                    {selectedBuilding.areaName && (
                      <p className="text-xs text-slate-300 mt-0.5">{selectedBuilding.areaName}</p>
                    )}
                  </div>

                  {/* Honest Discovery Metrics Badge */}
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Flats Recorded
                    </div>
                    <div className="text-xl font-black text-amber-300 font-mono">
                      {flats.length} {flats.length === 1 ? "Unit" : "Units"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floor by Floor Grouped Grid */}
              {loadingFlats ? (
                <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
                  Loading flats for {selectedBuilding.name}...
                </div>
              ) : flats.length === 0 ? (
                <div className="rounded-2xl border bg-card p-8 text-center space-y-3 shadow-xs">
                  <span className="text-3xl">🚪</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">No flats recorded yet</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Add discovered flats as volunteers visit door-to-door.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddFlat(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-8"
                  >
                    ➕ Add First Flat
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(floorGroups).map(([floorLabel, floorFlats]) => (
                    <div key={floorLabel} className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {floorLabel} ({floorFlats.length} {floorFlats.length === 1 ? "flat" : "flats"})
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {floorFlats.map((flat) => (
                          <div
                            key={flat.id}
                            onClick={() => onStartCollection && onStartCollection(selectedBuilding, flat)}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex flex-col justify-between min-h-[64px]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-extrabold text-slate-900">
                                Flat {flat.unitNumber}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Recorded
                              </span>
                            </div>

                            {flat.ownerName ? (
                              <div className="text-[11px] text-slate-600 truncate mt-1">
                                👤 {flat.ownerName}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 mt-1">Resident not recorded</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          ) : (
            /* Building List Overview */
            <div className="space-y-4 animate-in fade-in" data-testid="building-list-view">
              
              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    filterMode === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Buildings ({buildings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("completed")}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    filterMode === "completed"
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Completed ({completedBuildingIds.size})
                </button>
              </div>

              {/* Building Cards Grid */}
              {loadingBuildings ? (
                <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
                  Loading residential buildings...
                </div>
              ) : filteredBuildings.length === 0 ? (
                <div className="rounded-2xl border bg-card p-8 text-center space-y-3 shadow-xs">
                  <span className="text-3xl">🏢</span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">No buildings found</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Add your mandal's residential buildings to begin progressive door-to-door collection.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddBuilding(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-8"
                  >
                    ➕ Add First Building
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredBuildings.map((bld) => {
                    const isCompleted = completedBuildingIds.has(bld.id);
                    return (
                      <div
                        key={bld.id}
                        className="rounded-2xl border bg-card p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-extrabold text-slate-900">
                                {bld.name} {bld.wing ? `(Wing ${bld.wing})` : ""}
                              </h4>
                              {bld.areaName && (
                                <p className="text-xs text-muted-foreground">{bld.areaName}</p>
                              )}
                            </div>

                            {isCompleted ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                COMPLETE
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                ACTIVE
                              </span>
                            )}
                          </div>

                          <div className="pt-2 text-xs text-slate-600 flex items-center justify-between border-t">
                            <span>Status:</span>
                            <span className="font-semibold text-slate-800">
                              {isCompleted ? "Collection Closed" : "Open for Collection"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void loadFlats(bld)}
                            className="flex-1 h-8 text-xs font-bold border-slate-200 hover:bg-slate-50"
                          >
                            View Flats →
                          </Button>

                          {onStartCollection && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onStartCollection(bld)}
                              className="flex-1 h-8 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white"
                            >
                              ⚡ Collect
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </>
      )}

      {/* -------------------------------------------------------------
          3. STANDALONE SHOPS VIEW
      -------------------------------------------------------------- */}
      {subTab === "shops" && (
        <div className="space-y-4 animate-in fade-in" data-testid="shops-view">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Commercial Properties ({shops.length})
            </h3>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddShop(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-8 cursor-pointer"
            >
              ➕ Add Shop (दुकान जोडा)
            </Button>
          </div>

          {loadingShops ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Loading shops...
            </div>
          ) : shops.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center space-y-3 shadow-xs">
              <span className="text-3xl">🏪</span>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">No shops registered</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Add market shops and commercial establishments in the mandal area.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shops.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border bg-card p-3.5 shadow-xs space-y-1.5"
                >
                  <h4 className="text-sm font-bold text-slate-900">
                    🏪 {s.shopName}
                  </h4>
                  {s.ownerName && (
                    <p className="text-xs text-slate-600">👤 {s.ownerName}</p>
                  )}
                  {s.contactMobile && (
                    <p className="text-xs text-slate-500">📞 {s.contactMobile}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: MINIMAL ADD BUILDING
      -------------------------------------------------------------- */}
      {showAddBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-card border p-5 sm:p-6 shadow-xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-base font-extrabold text-foreground">
                  Add Building (इमारत जोडा)
                </h3>
                <p className="text-xs text-muted-foreground">Minimal setup — discover flats progressively</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBuilding(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBuilding} className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="bld-name-input" className="text-xs font-bold">Building Name (इमारतीचे नाव) *</Label>
                <Input
                  id="bld-name-input"
                  required
                  placeholder="e.g. Shree Krupa Heights"
                  value={bldName}
                  onChange={(e) => setBldName(e.target.value)}
                  className="text-xs h-9"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="bld-wing-input" className="text-xs font-bold">Wing (विंग) (Optional)</Label>
                  <Input
                    id="bld-wing-input"
                    placeholder="e.g. A"
                    value={bldWing}
                    onChange={(e) => setBldWing(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="bld-area-input" className="text-xs font-bold">Area / Landmark (Optional)</Label>
                  <Input
                    id="bld-area-input"
                    placeholder="e.g. Sector 28"
                    value={bldArea}
                    onChange={(e) => setBldArea(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddBuilding(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingBuilding || !bldName.trim()}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-9"
                >
                  {submittingBuilding ? "Saving..." : "Create Building (तयार करा)"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: PROGRESSIVE ADD FLAT (+ ADD & CONTINUE)
      -------------------------------------------------------------- */}
      {showAddFlat && selectedBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-card border p-5 sm:p-6 shadow-xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-base font-extrabold text-foreground">
                  Add Flat in {selectedBuilding.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedBuilding.wing ? `Wing ${selectedBuilding.wing} • ` : ""}Door-to-door discovery
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFlat(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {(() => {
              const isDuplicate = flatUnit.trim() && flats.some((f) => (f.unitNumber || f.flatNumber || "").toLowerCase() === flatUnit.trim().toLowerCase());
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (isDuplicate) return;
                    void handleCreateFlat(false);
                  }}
                  className="space-y-3.5"
                >
                  {isDuplicate && (
                    <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200 font-semibold">
                      ⚠️ Flat {flatUnit.trim()} already exists in this building.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="flat-unit-input" className="text-xs font-bold">Flat Number (फ्लॅट क्रमांक) *</Label>
                      <Input
                        id="flat-unit-input"
                        required
                        placeholder="e.g. 402"
                        value={flatUnit}
                        onChange={(e) => setFlatUnit(e.target.value)}
                        className="text-xs h-9 font-bold"
                        autoFocus
                      />
                    </div>

                <div className="space-y-1">
                  <Label htmlFor="flat-floor-input" className="text-xs font-bold">Floor Number (मजला) (Optional)</Label>
                  <Input
                    id="flat-floor-input"
                    type="number"
                    placeholder="e.g. 4"
                    value={flatFloor}
                    onChange={(e) => setFlatFloor(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="flat-owner-input" className="text-xs font-bold">Resident / Owner Name (Optional)</Label>
                <Input
                  id="flat-owner-input"
                  placeholder="e.g. Rajesh Patil"
                  value={flatOwner}
                  onChange={(e) => setFlatOwner(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="flat-mobile-input" className="text-xs font-bold">Contact Mobile (Optional)</Label>
                <Input
                  id="flat-mobile-input"
                  type="tel"
                  placeholder="e.g. 9820112233"
                  value={flatMobile}
                  onChange={(e) => setFlatMobile(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddFlat(false)}
                  className="text-xs h-9 w-full sm:w-auto"
                >
                  Cancel
                </Button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="submit"
                    disabled={submittingFlat || !flatUnit.trim()}
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 font-bold flex-1 sm:flex-none border-slate-300"
                  >
                    Add Flat
                  </Button>

                  <Button
                    type="button"
                    disabled={submittingFlat || !flatUnit.trim()}
                    onClick={() => void handleCreateFlat(true)}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-9 flex-1 sm:flex-none"
                  >
                    ⚡ Add & Continue →
                  </Button>
                  </div>
                </div>
              </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: ADD SHOP
      -------------------------------------------------------------- */}
      {showAddShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-card border p-5 sm:p-6 shadow-xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-base font-extrabold text-foreground">
                Add Commercial Shop (दुकान जोडा)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddShop(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!shopName.trim()) return;
                setSubmittingShop(true);
                try {
                  await createStandaloneShop({
                    organizationId,
                    shopName: shopName.trim(),
                    ownerName: shopOwner.trim() || undefined,
                    contactMobile: shopMobile.trim() || undefined,
                    locationNote: shopLocationNote.trim() || undefined,
                  });
                  setShowAddShop(false);
                  setShopName("");
                  setShopOwner("");
                  setShopMobile("");
                  setShopLocationNote("");
                  await loadShops();
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : "Failed to create shop");
                } finally {
                  setSubmittingShop(false);
                }
              }}
              className="space-y-3.5"
            >
              <div className="space-y-1">
                <Label className="text-xs font-bold">Shop Name (दुकानाचे नाव) *</Label>
                <Input
                  required
                  placeholder="e.g. Om Sai Medicals"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="text-xs h-9"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Owner / Contact Person (Optional)</Label>
                <Input
                  placeholder="e.g. Suresh Shah"
                  value={shopOwner}
                  onChange={(e) => setShopOwner(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Contact Mobile (Optional)</Label>
                <Input
                  type="tel"
                  placeholder="e.g. 9820556677"
                  value={shopMobile}
                  onChange={(e) => setShopMobile(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddShop(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingShop || !shopName.trim()}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-9"
                >
                  {submittingShop ? "Saving..." : "Create Shop"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
