import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <h1 className="text-xl font-bold text-primary">
            VarganiPro
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  );
}