import type { ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="route-transition-veil" aria-hidden="true" />
    </>
  );
}
