import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "@/features/auth/pages/login-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
  },
]);