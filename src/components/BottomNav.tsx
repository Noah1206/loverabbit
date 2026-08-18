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
      <path className="tabbar-home-shape" d="M3 10.75 12 3l9 7.75v8.5A1.75 1.75 0 0 1 19.25 21h-14.5A1.75 1.75 0 0 1 3 19.25v-8.5ZM9 21v-6.5h6V21" />
    ),
  },
  {
    href: "/reading",
    label: "내 사주",
    matches: (path: string) => path.startsWith("/reading") || path.startsWith("/product") || path.startsWith("/payment"),
    icon: (
      <>
        <circle cx="12" cy="10" r="6.5" />
        <path d="M7.5 17h9M6.5 21h11M8 17l-1.5 4M16 17l1.5 4" />
        <path d="M8.5 7.5c.9-1.8 2.5-2.8 4.5-2.8" />
      </>
    ),
  },
  {
    href: "/my",
    label: "내 상담",
    matches: (path: string) => path.startsWith("/my"),
    icon: (
      <>
        <path d="M4 4.5h16v12H9l-5 4v-16Z" />
      </>
    ),
  },
  {
    href: "/rewards",
    label: "보상",
    matches: (path: string) => path.startsWith("/rewards"),
    icon: (
      <>
        <path d="M3 9h18v4H3V9ZM5 13h14v8H5v-8ZM12 9v12" />
        <path d="M12 9H8.25A2.25 2.25 0 1 1 10.5 6.75C10.5 8 12 9 12 9Zm0 0h3.75A2.25 2.25 0 1 0 13.5 6.75C13.5 8 12 9 12 9Z" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "마이",
    matches: (path: string) => path.startsWith("/profile"),
    icon: (
      <>
        <circle cx="12" cy="7.5" r="4" />
        <path d="M4.5 21v-2.25A5.75 5.75 0 0 1 10.25 13h3.5a5.75 5.75 0 0 1 5.75 5.75V21h-15Z" />
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
