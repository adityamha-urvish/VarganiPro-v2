import { useState, useEffect, useCallback } from "react";
import type { NavigationTab } from "@/app/layouts/RoleNavigation";

export interface DashboardNavigationState {
  tab: NavigationTab;
  mode: "collect" | null;
  buildingId: string | null;
  flatId: string | null;
}

export function parseNavigationState(search: string): DashboardNavigationState {
  const params = new URLSearchParams(search);
  const rawTab = params.get("tab");
  let tab: NavigationTab = "collection";
  if (
    rawTab === "collection" ||
    rawTab === "buildings" ||
    rawTab === "masterData" ||
    rawTab === "volunteers" ||
    rawTab === "handovers" ||
    rawTab === "history" ||
    rawTab === "more"
  ) {
    tab = rawTab as NavigationTab;
  }

  const rawMode = params.get("mode");
  const mode = rawMode === "collect" ? "collect" : null;

  const buildingId = params.get("buildingId") || null;
  const flatId = params.get("flatId") || null;

  return {
    tab,
    mode,
    buildingId,
    flatId,
  };
}

export function buildNavigationQueryString(state: Partial<DashboardNavigationState>): string {
  const params = new URLSearchParams();

  if (state.tab && state.tab !== "collection") {
    params.set("tab", state.tab);
  }
  if (state.mode === "collect") {
    params.set("mode", "collect");
  }
  if (state.buildingId) {
    params.set("buildingId", state.buildingId);
  }
  if (state.flatId) {
    params.set("flatId", state.flatId);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useDashboardNavigation() {
  const [navState, setNavState] = useState<DashboardNavigationState>(() => {
    if (typeof window !== "undefined") {
      return parseNavigationState(window.location.search);
    }
    return {
      tab: "collection",
      mode: null,
      buildingId: null,
      flatId: null,
    };
  });

  // Listen for browser / Android back and forward button navigation (popstate)
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handlePopState() {
      setNavState(parseNavigationState(window.location.search));
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState({}, "", window.location.pathname || "/dashboard");
      }
    };
  }, []);

  const updateUrlAndState = useCallback(
    (nextState: DashboardNavigationState, replace = false) => {
      if (typeof window !== "undefined") {
        const pathname = window.location.pathname || "/dashboard";
        const qs = buildNavigationQueryString(nextState);
        const newUrl = `${pathname}${qs}`;

        if (replace) {
          window.history.replaceState({}, "", newUrl);
        } else {
          window.history.pushState({}, "", newUrl);
        }
      }
      setNavState(nextState);
    },
    []
  );

  const setTab = useCallback(
    (newTab: NavigationTab, replace = false) => {
      const next: DashboardNavigationState = {
        tab: newTab,
        mode: null,
        buildingId: null,
        flatId: null,
      };
      updateUrlAndState(next, replace);
    },
    [updateUrlAndState]
  );

  const openCollectMode = useCallback(
    (buildingId?: string | null) => {
      const next: DashboardNavigationState = {
        tab: "collection",
        mode: "collect",
        buildingId: buildingId || null,
        flatId: null,
      };
      updateUrlAndState(next);
    },
    [updateUrlAndState]
  );

  const selectBuildingId = useCallback(
    (buildingId: string | null) => {
      setNavState((current) => {
        const next: DashboardNavigationState = {
          ...current,
          buildingId,
          flatId: null, // Selecting or clearing building resets flat
        };
        if (typeof window !== "undefined") {
          const pathname = window.location.pathname || "/dashboard";
          const qs = buildNavigationQueryString(next);
          window.history.pushState({}, "", `${pathname}${qs}`);
        }
        return next;
      });
    },
    []
  );

  const selectFlatId = useCallback(
    (flatId: string | null) => {
      setNavState((current) => {
        const next: DashboardNavigationState = {
          ...current,
          flatId,
        };
        if (typeof window !== "undefined") {
          const pathname = window.location.pathname || "/dashboard";
          const qs = buildNavigationQueryString(next);
          window.history.pushState({}, "", `${pathname}${qs}`);
        }
        return next;
      });
    },
    []
  );

  const resetToHome = useCallback(() => {
    const next: DashboardNavigationState = {
      tab: "collection",
      mode: null,
      buildingId: null,
      flatId: null,
    };
    updateUrlAndState(next);
  }, [updateUrlAndState]);

  const goBack = useCallback(() => {
    if (navState.flatId) {
      selectFlatId(null);
    } else if (navState.buildingId) {
      selectBuildingId(null);
    } else if (navState.mode === "collect") {
      resetToHome();
    } else if (navState.tab !== "collection") {
      resetToHome();
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  }, [navState, selectFlatId, selectBuildingId, resetToHome]);

  return {
    tab: navState.tab,
    mode: navState.mode,
    buildingId: navState.buildingId,
    flatId: navState.flatId,
    setTab,
    openCollectMode,
    selectBuildingId,
    selectFlatId,
    resetToHome,
    goBack,
  };
}
