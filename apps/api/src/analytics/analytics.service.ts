import { Injectable } from "@nestjs/common";
import { StrategyType } from "@railopt/contracts";
import { PrismaService } from "../prisma/prisma.service";

const STRATEGIES: StrategyType[] = ["FIRST_FEASIBLE", "PRIORITY_FIRST", "OPTIMIZED"];

export interface StrategyAnalytics {
  strategy: StrategyType;
  planId: string;
  objectiveValue: number | null;
  maintenanceCompletion: { scheduled: number; total: number; ratio: number };
  criticalCompletion: number;
  overdueCompletion: number;
  blocksUsed: number;
  averageBlockUtilization: number | null;
  bundleCount: number;
  conflictCount: number;
  totalDelayMinutes: number | null;
}

/** Aggregates the most recent VALIDATED/APPROVED plan per strategy for a
 * scenario into the comparison metrics from the project brief's Analytics
 * screen. Every number here is derived from an actual persisted Plan/
 * PlanRevision/SimulationRun - never hardcoded. Results are always labeled
 * "SYNTHETIC SCENARIO RESULT" by the caller (see docs/API.md). */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async compareStrategies(scenarioId: string): Promise<StrategyAnalytics[]> {
    const results: StrategyAnalytics[] = [];

    for (const strategy of STRATEGIES) {
      const plan = await this.prisma.plan.findFirst({
        where: { scenarioId, strategy, status: { in: ["VALIDATED", "APPROVED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          revisions: {
            orderBy: { revisionNumber: "desc" },
            take: 1,
            include: { blocks: true, tasks: true, simulationRuns: { orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
      });
      if (!plan) continue;

      const revision = plan.revisions[0];
      if (!revision) continue;

      const scheduled = revision.tasks.filter((t) => t.scheduled);
      const critical = scheduled.filter((t) => {
        const breakdown = t.priorityBreakdown as { assetCriticality?: number };
        return (breakdown.assetCriticality ?? 0) >= 25; // matches the CRITICAL asset-criticality points band
      });
      const overdueScheduled = scheduled.filter((t) => {
        const breakdown = t.priorityBreakdown as { overdue?: number };
        return (breakdown.overdue ?? 0) > 0;
      });
      const bundles = revision.blocks.filter((b) => b.isBundle);
      const sim = revision.simulationRuns[0];

      results.push({
        strategy,
        planId: plan.id,
        objectiveValue: plan.objectiveValue,
        maintenanceCompletion: {
          scheduled: scheduled.length,
          total: revision.tasks.length,
          ratio: revision.tasks.length > 0 ? scheduled.length / revision.tasks.length : 0,
        },
        criticalCompletion: critical.length,
        overdueCompletion: overdueScheduled.length,
        blocksUsed: revision.blocks.length,
        averageBlockUtilization: sim && sim.blockUtilization
          ? this.averageUtilization(sim.blockUtilization as { utilizationRatio: number }[])
          : null,
        bundleCount: bundles.length,
        conflictCount: sim ? (sim.conflicts as unknown[]).length : 0,
        totalDelayMinutes: sim?.totalDelayMinutes ?? null,
      });
    }

    return results;
  }

  private averageUtilization(entries: { utilizationRatio: number }[]): number | null {
    if (entries.length === 0) return null;
    return entries.reduce((sum, e) => sum + e.utilizationRatio, 0) / entries.length;
  }
}
