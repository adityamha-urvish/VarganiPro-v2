import { createBrowserRouter, Navigate } from "react-router-dom";

import { LoginPage } from "@/features/auth/pages/login-page";
import { DashboardPage } from "@/features/dashboard/pages/dashboard-page";
import { AppLayout } from "@/app/layouts/AppLayout";

function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = localStorage.getItem("vp_user");

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppLayout>
          <DashboardPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
]);