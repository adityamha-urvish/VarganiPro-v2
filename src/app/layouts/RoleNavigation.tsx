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
  const volunteerTabs: Array<{ id: NavigationTab; label: string; icon: string }> = [
    { id: "collection", label: "Collection", icon: "⚡" },
    { id: "history", label: "Receipts", icon: "📜" },
    { id: "handovers", label: "Handover", icon: "🤝" },
  ];

  const adminTabs: Array<{ id: NavigationTab; label: string; icon: string }> = [
    { id: "collection", label: "Collection", icon: "⚡" },
    { id: "volunteers", label: "Volunteers", icon: "👥" },
    { id: "masterData", label: "Buildings & Shops", icon: "🏢" },
    { id: "handovers", label: "Handovers", icon: "🤝" },
    { id: "history", label: "Receipts", icon: "📜" },
    { id: "more", label: "Admin & More", icon: "⚙️" },
  ];

  const tabs = isAdmin ? adminTabs : volunteerTabs;

  return (
    <>
      {/* -------------------------------------------------------------
          1. DESKTOP / TABLET TOP TAB BAR
      -------------------------------------------------------------- */}
      <div className="hidden sm:flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`nav-tab-${t.id}`}
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.id === "history" && pendingSyncCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.2 font-bold">
                    {pendingSyncCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground shrink-0">
          <span>Role:</span>
          <span
            className={`px-2 py-0.5 rounded-md font-bold ${
              isAdmin
                ? "bg-purple-100 text-purple-800"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {isAdmin ? "👑 Mandal Secretary / Admin" : "👤 Collection Volunteer"}
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. MOBILE FIXED BOTTOM NAVIGATION BAR
      -------------------------------------------------------------- */}
      <nav
        aria-label="Bottom Navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg"
      >
        <div className={`grid gap-1 ${isAdmin ? "grid-cols-6" : "grid-cols-3"}`}>
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
                    ? "text-primary font-black bg-primary/10"
                    : "text-muted-foreground hover:text-foreground font-medium"
                }`}
              >
                <div className="relative">
                  <span className="text-base leading-none">{t.icon}</span>
                  {t.id === "history" && pendingSyncCount > 0 && (
                    <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <span className="text-[10px] mt-1 font-bold truncate max-w-[54px]">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
