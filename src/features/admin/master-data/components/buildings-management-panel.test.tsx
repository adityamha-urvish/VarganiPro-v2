// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BuildingsManagementPanel } from "./buildings-management-panel";
import * as masterDataService from "../services/master-data.service";

vi.mock("../services/master-data.service", () => ({
  fetchOrganizationBuildings: vi.fn(),
  createBuilding: vi.fn(),
  fetchBuildingProperties: vi.fn(),
  createResidentialFlat: vi.fn(),
  fetchStandaloneShops: vi.fn(),
  createStandaloneShop: vi.fn(),
}));

describe("Phase 2I: BuildingsManagementPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockBuildings: masterDataService.BuildingRecord[] = [
    {
      id: "bld-1",
      organizationId: "org-1",
      name: "Shivaji Heights",
      code: "SH",
      wing: "A",
      areaName: "Shivaji Nagar",
      isActive: true,
      createdAt: "2026-09-09T08:00:00Z",
    },
    {
      id: "bld-2",
      organizationId: "org-1",
      name: "Om Residency",
      code: "OM",
      wing: null,
      areaName: "Station Road",
      isActive: true,
      createdAt: "2026-09-09T08:00:00Z",
    },
  ];

  const mockFlats: masterDataService.PropertyRecord[] = [
    {
      id: "flat-101",
      organizationId: "org-1",
      buildingId: "bld-1",
      propertyType: "residential",
      unitNumber: "101",
      flatNumber: "101",
      shopName: null,
      floorNumber: 1,
      ownerName: "Rajesh Sharma",
      contactMobile: "9820011111",
      locationNote: null,
      isActive: true,
      createdAt: "2026-09-09T08:00:00Z",
    },
    {
      id: "flat-201",
      organizationId: "org-1",
      buildingId: "bld-1",
      propertyType: "residential",
      unitNumber: "201",
      flatNumber: "201",
      shopName: null,
      floorNumber: 2,
      ownerName: "Anita Kulkarni",
      contactMobile: "9820022222",
      locationNote: null,
      isActive: true,
      createdAt: "2026-09-09T08:00:00Z",
    },
  ];

  it("renders building list and switches to building detail when clicked", async () => {
    vi.mocked(masterDataService.fetchOrganizationBuildings).mockResolvedValue(mockBuildings);
    vi.mocked(masterDataService.fetchBuildingProperties).mockResolvedValue(mockFlats);

    render(<BuildingsManagementPanel organizationId="org-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Shivaji Heights/)).toBeTruthy();
      expect(screen.getByText(/Om Residency/)).toBeTruthy();
    });

    // Click on View Flats button
    const viewFlatsButtons = screen.getAllByText(/View Flats/);
    fireEvent.click(viewFlatsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/2nd Floor/)).toBeTruthy();
      expect(screen.getByText(/1st Floor/)).toBeTruthy();
      expect(screen.getByText("Flat 101")).toBeTruthy();
      expect(screen.getByText("Flat 201")).toBeTruthy();
    });
  });

  it("creates minimal building with Name, Wing, and Area", async () => {
    vi.mocked(masterDataService.fetchOrganizationBuildings).mockResolvedValue(mockBuildings);
    vi.mocked(masterDataService.createBuilding).mockResolvedValue({ buildingId: "bld-new" });

    render(<BuildingsManagementPanel organizationId="org-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Add Building/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/Add Building/));

    const nameInput = screen.getByLabelText(/Building Name/);
    const wingInput = screen.getByLabelText(/Wing/);
    const areaInput = screen.getByLabelText(/Area \/ Landmark/);

    fireEvent.change(nameInput, { target: { value: "Gokul Dham" } });
    fireEvent.change(wingInput, { target: { value: "B" } });
    fireEvent.change(areaInput, { target: { value: "Powai" } });

    fireEvent.click(screen.getByText(/Create Building/));

    await waitFor(() => {
      expect(masterDataService.createBuilding).toHaveBeenCalledWith({
        organizationId: "org-1",
        name: "Gokul Dham",
        wing: "B",
        areaName: "Powai",
      });
    });
  });

  it("adds flat progressively and supports Add & Continue to start collection immediately", async () => {
    vi.mocked(masterDataService.fetchOrganizationBuildings).mockResolvedValue(mockBuildings);
    vi.mocked(masterDataService.fetchBuildingProperties).mockResolvedValue(mockFlats);
    vi.mocked(masterDataService.createResidentialFlat).mockResolvedValue({ propertyId: "flat-301" });

    const onStartCollection = vi.fn();

    render(
      <BuildingsManagementPanel
        organizationId="org-1"
        onStartCollection={onStartCollection}
      />
    );

    // Open building
    await waitFor(() => {
      expect(screen.getByText(/Shivaji Heights/)).toBeTruthy();
    });
    const viewFlatsButtons = screen.getAllByText(/View Flats/);
    fireEvent.click(viewFlatsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Add Flat/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/Add Flat/));

    const unitInput = screen.getByLabelText(/Flat Number/);
    fireEvent.change(unitInput, { target: { value: "301" } });

    const floorInput = screen.getByLabelText(/Floor/);
    fireEvent.change(floorInput, { target: { value: "3" } });

    const continueBtn = screen.getByText(/Add & Continue/);
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(masterDataService.createResidentialFlat).toHaveBeenCalledWith({
        organizationId: "org-1",
        buildingId: "bld-1",
        unitNumber: "301",
        floorNumber: 3,
        ownerName: undefined,
        contactMobile: undefined,
      });
      expect(onStartCollection).toHaveBeenCalled();
    });
  });

  it("warns on duplicate flat number in same building", async () => {
    vi.mocked(masterDataService.fetchOrganizationBuildings).mockResolvedValue(mockBuildings);
    vi.mocked(masterDataService.fetchBuildingProperties).mockResolvedValue(mockFlats);

    render(<BuildingsManagementPanel organizationId="org-1" />);

    // Open building
    await waitFor(() => {
      expect(screen.getByText(/Shivaji Heights/)).toBeTruthy();
    });
    const viewFlatsButtons = screen.getAllByText(/View Flats/);
    fireEvent.click(viewFlatsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Add Flat/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/Add Flat/));

    const unitInput = screen.getByLabelText(/Flat Number/);
    fireEvent.change(unitInput, { target: { value: "101" } });

    expect(screen.getByText(/already exists in this building/)).toBeTruthy();
  });

  it("handles standalone commercial shops and ad hoc general receipt trigger", async () => {
    const mockShops: masterDataService.PropertyRecord[] = [
      {
        id: "shop-1",
        organizationId: "org-1",
        buildingId: null,
        propertyType: "commercial",
        unitNumber: null,
        flatNumber: null,
        shopName: "Laxmi Kirana Store",
        floorNumber: null,
        ownerName: "Ramesh Gupta",
        contactMobile: "9820099999",
        locationNote: "Opposite Mandap",
        isActive: true,
        createdAt: "2026-09-09T08:00:00Z",
      },
    ];

    vi.mocked(masterDataService.fetchOrganizationBuildings).mockResolvedValue(mockBuildings);
    vi.mocked(masterDataService.fetchStandaloneShops).mockResolvedValue(mockShops);

    const onStartGeneralReceipt = vi.fn();

    render(
      <BuildingsManagementPanel
        organizationId="org-1"
        onStartGeneralReceipt={onStartGeneralReceipt}
      />
    );

    // Switch to Shops tab
    await waitFor(() => {
      expect(screen.getByText(/Commercial Shops/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/Commercial Shops/));

    await waitFor(() => {
      expect(screen.getByText(/Laxmi Kirana Store/)).toBeTruthy();
      expect(screen.getByText(/General Receipt/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/General Receipt/));
    expect(onStartGeneralReceipt).toHaveBeenCalled();
  });
});

