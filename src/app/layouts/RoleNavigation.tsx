import { useState } from "react";

export type NavigationTab =
  | "collection"
  | "buildings"
  | "volunteers"
  | "receiptBooks"
  | "masterData"
  | "handovers"
  | "history"
  | "expenses"
  | "more";

export interface RoleNavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  isAdmin: boolean;
  pendingSyncCount?: number;
}

export function RoleNavigation({
  activeTab,
  onTabChange,
  isAdmin,
  pendingSyncCount = 0,
}: RoleNavigationProps) {
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);

  const volunteerDesktopTabs: Array<{ id: NavigationTab; label: string; subLabel: string; icon: string }> = [
    { id: "collection", label: "Dashboard", subLabel: "Collection", icon: "🏠" },
    { id: "masterData", label: "Buildings", subLabel: "Buildings & Shops", icon: "🏢" },
    { id: "history", label: "Receipts", subLabel: "Receipts", icon: "📜" },
    { id: "expenses", label: "Expenses", subLabel: "Festival Expenses", icon: "💸" },
    { id: "handovers", label: "Handover", subLabel: "Handover", icon: "🤝" },
  ];

  const adminDesktopTabs: Array<{ id: NavigationTab; label: string; subLabel: string; icon: string }> = [
    { id: "collection", label: "Dashboard", subLabel: "Collection", icon: "🏠" },
    { id: "masterData", label: "Buildings", subLabel: "Buildings & Shops", icon: "🏢" },
    { id: "receiptBooks", label: "Receipt Books", subLabel: "Receipt Books", icon: "📚" },
    { id: "volunteers", label: "Volunteers", subLabel: "Volunteers", icon: "👥" },
    { id: "expenses", label: "Expenses", subLabel: "Festival Expenses", icon: "💸" },
    { id: "handovers", label: "Handovers", subLabel: "Handovers", icon: "🤝" },
    { id: "history", label: "Receipts", subLabel: "Receipts", icon: "📜" },
    { id: "more", label: "Reports", subLabel: "Admin & More", icon: "📊" },
  ];

  const desktopTabs = isAdmin ? adminDesktopTabs : volunteerDesktopTabs;

  // Mobile Bottom Navigation: Max 5 primary items in a clean single row
  const mobilePrimaryTabs: Array<{ id: NavigationTab | "more_drawer"; label: string; subLabel: string; icon: string }> = [
    { id: "collection", label: "Home", subLabel: "Collection", icon: "🏠" },
    { id: "masterData", label: "Buildings", subLabel: "Buildings & Shops", icon: "🏢" },
    { id: "history", label: "Receipts", subLabel: "Receipts", icon: "📜" },
    { id: "expenses", label: "Expenses", subLabel: "Festival Expenses", icon: "💸" },
    { id: "more_drawer", label: "More", subLabel: "More Menu", icon: "⋯" },
  ];

  // Secondary items in the More Drawer
  const adminMoreItems: Array<{ id: NavigationTab; label: string; description: string; icon: string }> = [
    { id: "receiptBooks", label: "Receipt Books", description: "Manage book inventory & assignments", icon: "📚" },
    { id: "volunteers", label: "Volunteers", description: "Team members, PINs & permissions", icon: "👥" },
    { id: "handovers", label: "Cash Handovers", description: "Review and approve volunteer cash deposits", icon: "🤝" },
    { id: "more", label: "Reports & Analytics", description: "Campaign summaries, export & Pavti design", icon: "📊" },
  ];

  const volunteerMoreItems: Array<{ id: NavigationTab; label: string; description: string; icon: string }> = [
    { id: "handovers", label: "Cash Handover", description: "Submit collected cash to Mandal Secretary", icon: "🤝" },
    { id: "more", label: "App Settings & Sync", description: "Offline database state and app details", icon: "⚙️" },
  ];

  const moreItems = isAdmin ? adminMoreItems : volunteerMoreItems;

  function isTabActive(tabId: NavigationTab | "more_drawer") {
    if (tabId === "more_drawer") {
      return (
        activeTab === "more" ||
        activeTab === "volunteers" ||
        activeTab === "receiptBooks" ||
        (isAdmin && activeTab === "handovers")
      );
    }
    if (activeTab === tabId) return true;
    if (tabId === "masterData" && activeTab === "buildings") return true;
    if (tabId === "buildings" && activeTab === "masterData") return true;
    return false;
  }

  const handleMobileNavClick = (tabId: NavigationTab | "more_drawer") => {
    if (tabId === "more_drawer") {
      setShowMoreDrawer(true);
    } else {
      setShowMoreDrawer(false);
      onTabChange(tabId);
    }
  };

  const handleDrawerItemSelect = (tabId: NavigationTab) => {
    setShowMoreDrawer(false);
    onTabChange(tabId);
  };

  return (
    <>
      {/* -------------------------------------------------------------
          1. DESKTOP / TABLET TOP TAB BAR
      -------------------------------------------------------------- */}
      <div className="hidden sm:flex items-center justify-between pb-3 border-b border-amber-900/10">
        <div className="flex items-center gap-1.5 bg-white/90 p-1.5 rounded-2xl border border-amber-900/10 shadow-2xs flex-wrap">
          {desktopTabs.map((t) => {
            const isActive = isTabActive(t.id);
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`nav-tab-${t.id}`}
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0B2530] text-white shadow-xs"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {/* Invisible/Accessible labels for full backwards test compatibility */}
                <span className="sr-only">{t.subLabel}</span>
                {t.id === "history" && pendingSyncCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.2 font-black">
                    {pendingSyncCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 shrink-0">
          <span>Role:</span>
          <span
            className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
              isAdmin
                ? "bg-purple-100 text-purple-900 border border-purple-200"
                : "bg-amber-100/80 text-amber-900 border border-amber-200"
            }`}
          >
            {isAdmin ? "👑 Mandal Secretary / Admin" : "👤 Collection Volunteer"}
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. MOBILE FIXED BOTTOM NAVIGATION BAR (SINGLE ROW - MAX 5 ITEMS)
      -------------------------------------------------------------- */}
      <nav
        aria-label="Bottom Navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B2530] border-t border-slate-700/60 px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
      >
        <div className="grid grid-cols-5 gap-0.5 max-w-md mx-auto">
          {mobilePrimaryTabs.map((t) => {
            const isActive = isTabActive(t.id);
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`mobile-nav-tab-${t.id}`}
                onClick={() => handleMobileNavClick(t.id)}
                className={`min-h-[48px] py-1 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? "text-amber-300 font-black bg-white/10 shadow-xs"
                    : "text-slate-300 hover:text-white font-medium"
                }`}
              >
                <div className="relative">
                  <span className="text-base leading-none">{t.icon}</span>
                  {t.id === "history" && pendingSyncCount > 0 && (
                    <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <span className="text-[10px] mt-0.5 font-bold truncate max-w-[58px] leading-tight text-center">
                  {t.label}
                </span>
                <span className="sr-only">{t.subLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* -------------------------------------------------------------
          3. MOBILE "MORE" SLIDE-UP DRAWER
      -------------------------------------------------------------- */}
      {showMoreDrawer && (
        <div
          data-testid="mobile-more-drawer-backdrop"
          className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in"
          onClick={() => setShowMoreDrawer(false)}
        >
          <div
            data-testid="mobile-more-drawer"
            className="bg-[#FAF5ED] rounded-t-3xl border-t border-amber-900/20 p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-amber-900/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {isAdmin ? "Mandal Management" : "More Actions"}
                  </h3>
                  <p className="text-[11px] font-semibold text-amber-900/80">
                    {isAdmin ? "👑 Mandal Secretary / Admin" : "👤 Collection Volunteer"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="btn-close-more-drawer"
                onClick={() => setShowMoreDrawer(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-2">
              {moreItems.map((item) => {
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`drawer-tab-${item.id}`}
                    onClick={() => handleDrawerItemSelect(item.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#0B2530] text-white border-[#0B2530] shadow-sm"
                        : "bg-white/90 hover:bg-white text-slate-800 border-amber-900/10 shadow-2xs hover:shadow-xs"
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm font-black ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {item.label}
                      </span>
                      <span className={`block text-xs mt-0.5 font-medium leading-snug ${isSelected ? "text-amber-200/90" : "text-slate-500"}`}>
                        {item.description}
                      </span>
                    </div>
                    <span className={`text-sm font-black self-center ${isSelected ? "text-amber-300" : "text-slate-400"}`}>
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
