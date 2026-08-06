import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/app/layouts/AppLayout";
import { LoginPage } from "@/features/auth/pages/login-page";
import { DashboardPage } from "@/features/dashboard/pages/dashboard-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
    ],
  },
]);