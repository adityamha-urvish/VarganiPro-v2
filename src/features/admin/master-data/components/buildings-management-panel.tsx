import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface BuildingsManagementPanelProps {
  organizationId: string;
  initialSubTab?: "buildings" | "shops";
}

export function BuildingsManagementPanel({
  organizationId,
  initialSubTab = "buildings",
}: BuildingsManagementPanelProps) {
  const [subTab, setSubTab] = useState<"buildings" | "shops">(initialSubTab);

  // Buildings state
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingRecord | null>(null);
  const [flats, setFlats] = useState<PropertyRecord[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [loadingFlats, setLoadingFlats] = useState(false);

  // Modals
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [bldName, setBldName] = useState("");
  const [bldCode, setBldCode] = useState("");
  const [bldArea, setBldArea] = useState("");
  const [bldWing, setBldWing] = useState("");
  const [submittingBuilding, setSubmittingBuilding] = useState(false);

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
        setSelectedBuilding(data[0]);
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

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldName.trim()) return;

    setSubmittingBuilding(true);
    try {
      const res = await createBuilding({
        organizationId,
        name: bldName.trim(),
        code: bldCode.trim() || undefined,
        areaName: bldArea.trim() || undefined,
        wing: bldWing.trim() || undefined,
      });

      setShowAddBuilding(false);
      setBldName("");
      setBldCode("");
      setBldArea("");
      setBldWing("");

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

  const handleCreateFlat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding || !flatUnit.trim()) return;

    setSubmittingFlat(true);
    try {
      await createResidentialFlat({
        organizationId,
        buildingId: selectedBuilding.id,
        unitNumber: flatUnit.trim(),
        floorNumber: flatFloor ? parseInt(flatFloor, 10) : undefined,
        ownerName: flatOwner.trim() || undefined,
        contactMobile: flatMobile.trim() || undefined,
      });

      setShowAddFlat(false);
      setFlatUnit("");
      setFlatFloor("");
      setFlatOwner("");
      setFlatMobile("");

      await loadFlats(selectedBuilding);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add flat");
    } finally {
      setSubmittingFlat(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
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
      alert(err instanceof Error ? err.message : "Failed to add shop");
    } finally {
      setSubmittingShop(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher: Residential Buildings vs Standalone Shops */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("buildings")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              subTab === "buildings"
                ? "bg-primary text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            🏢 Residential Buildings ({buildings.length})
          </button>

          <button
            type="button"
            onClick={() => setSubTab("shops")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              subTab === "shops"
                ? "bg-primary text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            🏪 Standalone Commercial Shops ({shops.length})
          </button>
        </div>

        {subTab === "buildings" ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddBuilding(true)}
            className="font-bold text-xs gap-1 cursor-pointer"
          >
            + Add Building
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddShop(true)}
            className="font-bold text-xs gap-1 cursor-pointer"
          >
            + Add Shop
          </Button>
        )}
      </div>

      {/* 1. BUILDINGS & RESIDENTIAL FLATS VIEW */}
      {subTab === "buildings" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left Column: Buildings Roster */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Buildings Directory
            </h3>

            {loadingBuildings ? (
              <div className="p-4 text-center text-xs text-muted-foreground bg-slate-50 rounded-xl">
                Loading buildings...
              </div>
            ) : buildings.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border rounded-xl space-y-2">
                <p className="text-2xl">🏢</p>
                <p className="text-xs font-bold text-slate-700">No buildings yet</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddBuilding(true)}
                  className="text-xs font-bold"
                >
                  + Add First Building
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {buildings.map((b) => {
                  const isSelected = selectedBuilding?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => loadFlats(b)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{b.name}</span>
                        {b.wing && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                            {b.wing}
                          </span>
                        )}
                      </div>
                      {b.areaName && (
                        <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
                          📍 {b.areaName}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 2 Columns: Flats inside Selected Building */}
          <div className="md:col-span-2 space-y-2">
            {selectedBuilding ? (
              <Card className="shadow-sm">
                <CardHeader className="py-3 px-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>🏢</span> {selectedBuilding.name} — Flats ({flats.length})
                    </CardTitle>
                    {selectedBuilding.areaName && (
                      <p className="text-[11px] text-muted-foreground">
                        Locality: {selectedBuilding.areaName}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddFlat(true)}
                    className="font-bold text-xs gap-1 cursor-pointer"
                  >
                    + Add Flat
                  </Button>
                </CardHeader>

                <CardContent className="p-4">
                  {loadingFlats ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Loading flats...
                    </div>
                  ) : flats.length === 0 ? (
                    <div className="p-6 text-center space-y-2">
                      <p className="text-2xl">🏠</p>
                      <p className="text-xs font-bold text-slate-700">No flats added in this building</p>
                      <p className="text-[11px] text-muted-foreground">
                        Add individual flats (e.g. 101, 102, 103) for volunteers to collect.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShowAddFlat(true)}
                        className="mt-1 font-bold text-xs"
                      >
                        + Add First Flat
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {flats.map((f) => (
                        <div
                          key={f.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-primary/50 transition-colors"
                        >
                          <span className="font-mono font-black text-sm text-slate-900 block">
                            Flat {f.unitNumber}
                          </span>
                          {f.ownerName && (
                            <span className="text-[11px] text-muted-foreground truncate block">
                              👤 {f.ownerName}
                            </span>
                          )}
                          {f.contactMobile && (
                            <span className="text-[10px] font-mono text-muted-foreground block">
                              📱 {f.contactMobile}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="p-12 text-center text-xs text-muted-foreground bg-slate-50 border rounded-xl">
                Select a building to view and manage its residential flats.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. STANDALONE COMMERCIAL SHOPS VIEW */}
      {subTab === "shops" && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Commercial Shops Directory ({shops.length})
            </CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddShop(true)}
              className="font-bold text-xs gap-1 cursor-pointer"
            >
              + Add Shop
            </Button>
          </CardHeader>

          <CardContent className="p-4">
            {loadingShops ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading commercial shops...
              </div>
            ) : shops.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-3xl">🏪</p>
                <p className="text-xs font-bold text-slate-700">No standalone shops added yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Add local street businesses, medicals, bakeries, and garages.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddShop(true)}
                  className="mt-2 font-bold text-xs"
                >
                  + Add First Shop
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {shops.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:shadow-xs transition-shadow"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-base">🏪</span>
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {s.shopName}
                      </span>
                    </div>
                    {s.ownerName && (
                      <p className="text-xs text-slate-600">👤 {s.ownerName}</p>
                    )}
                    {s.contactMobile && (
                      <p className="text-xs font-mono text-muted-foreground">📱 {s.contactMobile}</p>
                    )}
                    {s.locationNote && (
                      <p className="text-[11px] text-muted-foreground mt-1 italic">
                        📍 {s.locationNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Add Building */}
      {showAddBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black text-slate-900">
                🏢 Add Residential Building
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateBuilding} className="space-y-3.5">
                <div>
                  <Label htmlFor="bldName" className="text-xs font-bold text-slate-700">
                    Building Name *
                  </Label>
                  <Input
                    id="bldName"
                    placeholder="e.g. Shivam Residency"
                    value={bldName}
                    onChange={(e) => setBldName(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bldWing" className="text-xs font-bold text-slate-700">
                      Wing (Optional)
                    </Label>
                    <Input
                      id="bldWing"
                      placeholder="e.g. Wing A"
                      value={bldWing}
                      onChange={(e) => setBldWing(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bldArea" className="text-xs font-bold text-slate-700">
                      Area / Locality
                    </Label>
                    <Input
                      id="bldArea"
                      placeholder="e.g. Sector 19"
                      value={bldArea}
                      onChange={(e) => setBldArea(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={submittingBuilding}
                    className="flex-1 font-bold text-xs cursor-pointer"
                  >
                    {submittingBuilding ? "Creating..." : "Save Building 🏢"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddBuilding(false)}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Add Flat */}
      {showAddFlat && selectedBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black text-slate-900">
                🏠 Add Flat to {selectedBuilding.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateFlat} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="flatUnit" className="text-xs font-bold text-slate-700">
                      Flat / Unit # *
                    </Label>
                    <Input
                      id="flatUnit"
                      placeholder="e.g. 101"
                      value={flatUnit}
                      onChange={(e) => setFlatUnit(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="flatFloor" className="text-xs font-bold text-slate-700">
                      Floor Number
                    </Label>
                    <Input
                      id="flatFloor"
                      type="number"
                      placeholder="e.g. 1"
                      value={flatFloor}
                      onChange={(e) => setFlatFloor(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="flatOwner" className="text-xs font-bold text-slate-700">
                    Resident / Owner Name
                  </Label>
                  <Input
                    id="flatOwner"
                    placeholder="e.g. Rajesh Shah"
                    value={flatOwner}
                    onChange={(e) => setFlatOwner(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="flatMobile" className="text-xs font-bold text-slate-700">
                    Resident Mobile (Optional)
                  </Label>
                  <Input
                    id="flatMobile"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={flatMobile}
                    onChange={(e) => setFlatMobile(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={submittingFlat}
                    className="flex-1 font-bold text-xs cursor-pointer"
                  >
                    {submittingFlat ? "Adding..." : "Add Flat 🏠"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddFlat(false)}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Add Shop */}
      {showAddShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black text-slate-900">
                🏪 Add Standalone Shop
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateShop} className="space-y-3.5">
                <div>
                  <Label htmlFor="shopName" className="text-xs font-bold text-slate-700">
                    Shop / Business Name *
                  </Label>
                  <Input
                    id="shopName"
                    placeholder="e.g. Om Sai Medical"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="shopOwner" className="text-xs font-bold text-slate-700">
                      Owner / Contact Name
                    </Label>
                    <Input
                      id="shopOwner"
                      placeholder="e.g. Mahesh Patil"
                      value={shopOwner}
                      onChange={(e) => setShopOwner(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="shopMobile" className="text-xs font-bold text-slate-700">
                      Contact Mobile
                    </Label>
                    <Input
                      id="shopMobile"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="9876543210"
                      value={shopMobile}
                      onChange={(e) => setShopMobile(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="shopNote" className="text-xs font-bold text-slate-700">
                    Location Note (Optional)
                  </Label>
                  <Input
                    id="shopNote"
                    placeholder="e.g. Near Shiv Mandir, Main Market"
                    value={shopLocationNote}
                    onChange={(e) => setShopLocationNote(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={submittingShop}
                    className="flex-1 font-bold text-xs cursor-pointer"
                  >
                    {submittingShop ? "Adding..." : "Add Shop 🏪"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddShop(false)}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
