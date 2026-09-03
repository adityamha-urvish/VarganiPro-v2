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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* -------------------------------------------------------------
          TOP APPLICATION HEADER
      -------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Brand & Context */}
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5" title="VarganiPro">
              <span className="font-brand-marathi text-2xl font-black text-slate-900 tracking-tight">
                वर्गणी
              </span>
              <span className="font-brand-pro text-xs font-black text-amber-600 bg-amber-50 border border-amber-300/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                PRO
              </span>
              {/* Screen-reader text for accessibility and test suite compatibility */}
              <span className="sr-only">🛕 VarganiPro</span>
            </div>

            {eventName && (
              <span className="hidden md:inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-xs font-bold text-orange-800">
                {eventName}
              </span>
            )}
          </div>

          {/* Center Navigation Links (Desktop/Tablet) */}
          {onTabChange && (
            <nav className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-tab-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === item.id
                      ? "bg-white text-orange-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
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
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
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
              <span className="hidden xs:inline text-[11px]">
                {!isOnline
                  ? "Offline"
                  : pendingSyncCount > 0
                  ? `${pendingSyncCount} queued`
                  : "Online"}
              </span>
            </div>

            {/* Role Badge */}
            <span
              className={`hidden sm:inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                isAdmin
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              {isAdmin ? "👑 Secretary" : "👤 Volunteer"}
            </span>

            {userName && (
              <span className="hidden lg:inline text-xs font-medium text-muted-foreground">
                {userName}
              </span>
            )}

            <button
              type="button"
              onClick={() => void handleLogoutClick()}
              disabled={loggingOut}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------
          MAIN CONTENT CONTAINER (WITH MOBILE SAFE-BOTTOM PADDING)
      -------------------------------------------------------------- */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 pb-28 sm:pb-8">
        {children}
      </main>

      {/* -------------------------------------------------------------
          MOBILE BOTTOM NAVIGATION BAR (FIXED)
      -------------------------------------------------------------- */}
      {onTabChange && (
        <nav
          aria-label="Bottom Navigation"
          className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-lg"
        >
          <div className={`grid gap-1 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`mobile-nav-tab-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  className={`min-h-[50px] py-1 px-2 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isActive
                      ? "text-orange-600 font-bold bg-orange-50"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="text-[11px] mt-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

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