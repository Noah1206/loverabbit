"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";

const NAV_ITEMS = [
  {
    href: "/",
    label: "홈",
    matches: (path: string) => path === "/",
    icon: (
      <path d="M3 10.75 12 3l9 7.75v8.5A1.75 1.75 0 0 1 19.25 21h-14.5A1.75 1.75 0 0 1 3 19.25v-8.5ZM9 21v-6.5h6V21" />
    ),
  },
  {
    href: "/reading",
    label: "리딩",
    matches: (path: string) => path.startsWith("/reading") || path.startsWith("/product"),
    icon: (
      <>
        <path d="m12 2 1.45 5.05L18.5 8.5l-5.05 1.45L12 15l-1.45-5.05L5.5 8.5l5.05-1.45L12 2Z" />
        <path d="m18.5 14 .75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75L18.5 14Z" />
      </>
    ),
  },
  {
    href: "/my",
    label: "내 상담",
    matches: (path: string) => path.startsWith("/my"),
    icon: (
      <>
        <path d="M6.25 3h9.5A2.25 2.25 0 0 1 18 5.25v13.5A2.25 2.25 0 0 1 15.75 21h-9.5A2.25 2.25 0 0 1 4 18.75V5.25A2.25 2.25 0 0 1 6.25 3Z" />
        <path d="M8 8h6M8 12h6M8 16h4" />
      </>
    ),
  },
] as const;

function activeIndex(path: string): number {
  const index = NAV_ITEMS.findIndex((item) => item.matches(path));
  return index < 0 ? 0 : index;
}

export default function BottomNav() {
  const path = usePathname();
  const routeIndex = activeIndex(path);
  const [visualIndex, setVisualIndex] = useState(routeIndex);

  useEffect(() => setVisualIndex(routeIndex), [routeIndex]);

  return (
    <nav
      className="tabbar"
      aria-label="주요 메뉴"
      style={{ "--active-index": visualIndex, "--nav-count": NAV_ITEMS.length } as CSSProperties}
    >
      <span className="tabbar-indicator-slot" aria-hidden>
        <span className="tabbar-indicator" />
      </span>
      {NAV_ITEMS.map((item, index) => {
        const active = routeIndex === index;
        const visuallyActive = visualIndex === index;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={visuallyActive ? "on" : ""}
            aria-current={active ? "page" : undefined}
            onClick={() => setVisualIndex(index)}
          >
            <span className="tabbar-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
            </span>
            <span className="tabbar-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
