import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "@/features/auth/services/auth.service";
import { getPendingReceiptsForOwner } from "@/lib/offline/offline-db";
import { SetSecretPinModal } from "@/features/auth/components/set-secret-pin-modal";

export type NavigationTab =
  | "collection"
  | "volunteers"
  | "masterData"
  | "handovers"
  | "history"
  | "more";

export interface AppLayoutProps {
  children: ReactNode;
  activeTab?: NavigationTab;
  onTabChange?: (tab: NavigationTab) => void;
  isAdmin?: boolean;
  pendingSyncCount?: number;
  userName?: string;
  eventName?: string;
}

export function AppLayout({
  children,
  activeTab = "collection",
  onTabChange,
  isAdmin = false,
  pendingSyncCount = 0,
  userName,
  eventName = "Ganesh Utsav 2026",
}: AppLayoutProps) {
  const navigate = useNavigate();
  const [showPendingWarning, setShowPendingWarning] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mustChangePin, setMustChangePin] = useState(() => {
    try {
      const stored = localStorage.getItem("vp_user");
      if (stored) {
        const u = JSON.parse(stored);
        return Boolean(u.must_change_pin || u.mustChangePin);
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Monitor network online/offline transitions
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function handleLogoutClick() {
    try {
      const pending = await getPendingReceiptsForOwner();
      if (pending.length > 0) {
        setPendingCount(pending.length);
        setShowPendingWarning(true);
        return;
      }

      await performLogout();
    } catch (err) {
      console.error("Logout check error:", err);
      await performLogout();
    }
  }

  async function performLogout() {
    setLoggingOut(true);
    try {
      await logout();
      setShowPendingWarning(false);
      navigate("/");
    } finally {
      setLoggingOut(false);
    }
  }

  // Navigation Items
  const volunteerNavItems: Array<{ id: NavigationTab; label: string; icon: string; desc: string }> = [
    { id: "collection", label: "Collect", icon: "⚡", desc: "Collection" },
    { id: "history", label: "History", icon: "📜", desc: "Receipts" },
    { id: "handovers", label: "Handover", icon: "🤝", desc: "Session Handover" },
  ];

  const adminNavItems: Array<{ id: NavigationTab; label: string; icon: string; desc: string }> = [
    { id: "collection", label: "Collect", icon: "⚡", desc: "Collection" },
    { id: "handovers", label: "Handovers", icon: "🤝", desc: "Verification" },
    { id: "history", label: "History", icon: "📜", desc: "Receipts" },
    { id: "more", label: "More", icon: "⚙️", desc: "Admin & Settings" },
  ];

  const navItems = isAdmin ? adminNavItems : volunteerNavItems;

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#FAF5ED] flex flex-col font-sans overflow-hidden">
      {/* -------------------------------------------------------------
          TOP APPLICATION HEADER
      -------------------------------------------------------------- */}
      <header className="shrink-0 z-30 border-b border-amber-900/10 bg-[#FAF5ED]/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Brand & Context */}
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5" title="VarganiPro">
              <span className="font-brand-marathi text-2xl font-black text-slate-950 tracking-tight leading-none">
                वर्गणी
              </span>
              <span className="font-brand-pro text-[11px] font-black text-amber-700 bg-amber-500/15 border border-amber-600/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider leading-none">
                PRO
              </span>
              {/* Screen-reader text for accessibility and test suite compatibility */}
              <span className="sr-only">🛕 VarganiPro</span>
            </div>

            {eventName && (
              <span className="hidden md:inline-flex items-center rounded-full bg-amber-100/70 border border-amber-300/80 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                {eventName}
              </span>
            )}
          </div>

          {/* Center Navigation Links (Desktop/Tablet) */}
          {onTabChange && (
            <nav className="hidden sm:flex items-center gap-1 bg-white/80 p-1 rounded-xl border border-amber-900/10 shadow-2xs">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-tab-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === item.id
                      ? "bg-[#0B2530] text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/60"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}

          {/* Right Status Pill & User Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online / Offline Indicator Pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                !isOnline || pendingSyncCount > 0
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-emerald-50 border-emerald-300 text-emerald-800"
              }`}
              title={isOnline ? "Connected to server" : "Working offline"}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  !isOnline
                    ? "bg-amber-500 animate-pulse"
                    : pendingSyncCount > 0
                    ? "bg-amber-500"
                    : "bg-emerald-600"
                }`}
              />
              <span className="hidden xs:inline text-[11px] font-bold">
                {!isOnline
                  ? "Offline"
                  : pendingSyncCount > 0
                  ? `${pendingSyncCount} queued`
                  : "Online"}
              </span>
            </div>

            {/* Notification Bell with Badge */}
            <div className="relative inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/80 border border-amber-900/10 text-slate-700 hover:text-slate-950 shadow-2xs">
              <span className="text-sm">🔔</span>
              {pendingSyncCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-600 border border-white" />
              )}
            </div>

            {/* Role Badge */}
            <span
              className={`hidden sm:inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                isAdmin
                  ? "bg-purple-100 text-purple-900 border border-purple-200"
                  : "bg-amber-100/80 text-amber-900 border border-amber-200"
              }`}
            >
              {isAdmin ? "👑 Secretary" : "👤 Volunteer"}
            </span>

            {userName && (
              <span className="hidden lg:inline text-xs font-semibold text-slate-700 max-w-[120px] truncate">
                {userName}
              </span>
            )}

            <button
              type="button"
              onClick={() => void handleLogoutClick()}
              disabled={loggingOut}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Festive Toran Garland Accent Strip */}
        <div
          className="w-full h-2 bg-repeat-x opacity-75"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8' viewBox='0 0 24 8'%3E%3Cpath d='M0 0 Q6 7 12 0 Q18 7 24 0' fill='none' stroke='%23C2410C' stroke-width='1.2'/%3E%3Ccircle cx='6' cy='3.5' r='1.2' fill='%23F59E0B'/%3E%3Ccircle cx='18' cy='3.5' r='1.2' fill='%23F59E0B'/%3E%3Ccircle cx='12' cy='1' r='0.8' fill='%23B91C1C'/%3E%3C/svg%3E")`,
            backgroundSize: "24px 8px",
          }}
          aria-hidden="true"
        />
      </header>

      {/* -------------------------------------------------------------
          MAIN CONTENT CONTAINER (WITH DYNAMIC SAFE-BOTTOM PADDING & INNER SCROLL)
      -------------------------------------------------------------- */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-5 overflow-y-auto overscroll-y-contain pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
        {children}
      </main>



      {/* -------------------------------------------------------------
          PENDING RECEIPTS LOGOUT WARNING MODAL
      -------------------------------------------------------------- */}
      {showPendingWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Pending receipts found
            </h2>

            <p className="mt-3 text-sm text-slate-600">
              You have {pendingCount}{" "}
              {pendingCount === 1 ? "receipt" : "receipts"} that haven't been
              synchronized yet.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Logging out will keep these receipts safely stored on this device
              for your account. Another volunteer using this device will not be
              able to see them.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowPendingWarning(false)}
                disabled={loggingOut}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void performLogout()}
                disabled={loggingOut}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Logout & Keep Pending Receipts"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forced PIN Rotation Modal */}
      <SetSecretPinModal
        isOpen={mustChangePin}
        onSuccess={() => setMustChangePin(false)}
      />
    </div>
  );
}