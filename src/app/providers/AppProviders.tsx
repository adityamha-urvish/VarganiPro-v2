import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AppProviders({ children }: Props) {
  return <>{children}</>;
}