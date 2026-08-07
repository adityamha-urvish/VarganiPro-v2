import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("vp_user");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <h1 className="text-xl font-bold">
            🛕 VarganiPro
          </h1>

          <button
            onClick={logout}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        {children}
      </main>
    </div>
  );
}