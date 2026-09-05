"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Command Center" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/corridors", label: "Corridors" },
  { href: "/block-planning", label: "Block Planning" },
  { href: "/optimization", label: "Optimization" },
  { href: "/what-if", label: "What-If" },
  { href: "/analytics", label: "Analytics" },
  { href: "/audit", label: "Audit" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-rail-border bg-rail-panel">
      <div className="border-b border-rail-border px-4 py-4">
        <p className="text-sm font-bold tracking-wide text-white">RAILOPT AI</p>
        <p className="text-[11px] text-slate-500">SIH26027 prototype</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "block rounded px-3 py-2 text-[13px] font-medium transition-colors",
                active ? "bg-rail-accent/15 text-rail-accent" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              {item.label.toUpperCase()}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-rail-border px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        Decision-support prototype. No control of real infrastructure. All data synthetic.
      </div>
    </aside>
  );
}
