export type NavigationTab =
  | "collection"
  | "volunteers"
  | "masterData"
  | "handovers"
  | "history"
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
  const volunteerTabs: Array<{ id: NavigationTab; label: string; subLabel: string; icon: string }> = [
    { id: "collection", label: "Dashboard", subLabel: "Collection", icon: "🏠" },
    { id: "masterData", label: "Buildings", subLabel: "Buildings & Shops", icon: "🏢" },
    { id: "history", label: "Receipts", subLabel: "Receipts", icon: "📜" },
    { id: "handovers", label: "Handover", subLabel: "Handover", icon: "🤝" },
  ];

  const adminTabs: Array<{ id: NavigationTab; label: string; subLabel: string; icon: string }> = [
    { id: "collection", label: "Dashboard", subLabel: "Collection", icon: "🏠" },
    { id: "masterData", label: "Buildings", subLabel: "Buildings & Shops", icon: "🏢" },
    { id: "volunteers", label: "Volunteers", subLabel: "Volunteers", icon: "👥" },
    { id: "handovers", label: "Handovers", subLabel: "Handovers", icon: "🤝" },
    { id: "history", label: "Receipts", subLabel: "Receipts", icon: "📜" },
    { id: "more", label: "Reports", subLabel: "Admin & More", icon: "📊" },
  ];

  const tabs = isAdmin ? adminTabs : volunteerTabs;

  return (
    <>
      {/* -------------------------------------------------------------
          1. DESKTOP / TABLET TOP TAB BAR
      -------------------------------------------------------------- */}
      <div className="hidden sm:flex items-center justify-between pb-3 border-b border-amber-900/10">
        <div className="flex items-center gap-1.5 bg-white/90 p-1.5 rounded-2xl border border-amber-900/10 shadow-2xs flex-wrap">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`nav-tab-${t.id}`}
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
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
          2. MOBILE FIXED BOTTOM NAVIGATION BAR (UNIFIED FOR ALL USERS)
      -------------------------------------------------------------- */}
      <nav
        aria-label="Bottom Navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF5ED] border-t border-amber-900/20 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      >
        <div className={`grid gap-1 ${isAdmin ? "grid-cols-6" : "grid-cols-4"}`}>
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`mobile-nav-tab-${t.id}`}
                onClick={() => onTabChange(t.id)}
                className={`min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? "text-[#800020] font-black bg-amber-200/50"
                    : "text-slate-600 hover:text-slate-900 font-semibold"
                }`}
              >
                <div className="relative">
                  <span className="text-base leading-none">{t.icon}</span>
                  {t.id === "history" && pendingSyncCount > 0 && (
                    <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <span className="text-[10px] mt-1 font-bold truncate max-w-[56px] leading-tight">
                  {t.label}
                </span>
                <span className="sr-only">{t.subLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

