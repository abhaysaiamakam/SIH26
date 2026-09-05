import clsx from "clsx";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "critical" | "ok" | "warn";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={clsx("mt-1.5 text-2xl font-semibold tabular-nums", {
          "text-slate-100": tone === "default",
          "text-red-400": tone === "critical",
          "text-emerald-400": tone === "ok",
          "text-amber-400": tone === "warn",
        })}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
