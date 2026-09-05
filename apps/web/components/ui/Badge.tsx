import clsx from "clsx";

type Tone = "neutral" | "ok" | "warn" | "critical" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  ok: "bg-emerald-900/30 text-emerald-400 border-emerald-700/50",
  warn: "bg-amber-900/30 text-amber-400 border-amber-700/50",
  critical: "bg-red-900/30 text-red-400 border-red-700/50",
  accent: "bg-blue-900/30 text-blue-400 border-blue-700/50",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none", TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}

const CRITICALITY_TONE: Record<string, Tone> = { LOW: "neutral", MEDIUM: "accent", HIGH: "warn", CRITICAL: "critical" };
export function CriticalityBadge({ value }: { value: string }) {
  return <Badge tone={CRITICALITY_TONE[value] ?? "neutral"}>{value}</Badge>;
}

const DEPARTMENT_TONE: Record<string, Tone> = { ENGINEERING: "accent", TRD: "warn", S_AND_T: "ok" };
export function DepartmentBadge({ value }: { value: string }) {
  return <Badge tone={DEPARTMENT_TONE[value] ?? "neutral"}>{value.replace("_AND_", "&")}</Badge>;
}

const STATUS_TONE: Record<string, Tone> = {
  OPEN: "neutral",
  VERIFIED: "accent",
  PRIORITIZED: "accent",
  BLOCK_REQUESTED: "warn",
  SCHEDULED: "ok",
  IN_PROGRESS: "ok",
  COMPLETED: "ok",
  CLOSED: "neutral",
  DRAFT: "neutral",
  VALIDATED: "ok",
  INVALID: "critical",
  APPROVED: "ok",
  REJECTED: "critical",
  SUPERSEDED: "neutral",
  PENDING: "neutral",
  RUNNING: "accent",
  SUCCEEDED: "ok",
  FAILED: "critical",
};
export function StatusBadge({ value }: { value: string }) {
  return <Badge tone={STATUS_TONE[value] ?? "neutral"}>{value.replace(/_/g, " ")}</Badge>;
}
