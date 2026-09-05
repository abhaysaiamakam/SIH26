import { Injectable } from "@nestjs/common";
import { CandidateRejectionReason, OptimizerRunOutput, StrategyType } from "@railopt/contracts";
import { PrismaService } from "../prisma/prisma.service";

/** Turns one OptimizerRunOutput into a persisted Plan -> PlanRevision ->
 * PlanBlock/PlanTask tree. Shared by PlanningRunsService (POST
 * /planning-runs) and WhatIfService (POST /what-if) so both paths persist
 * plans identically. */
@Injectable()
export class PlanPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async persist(scenarioId: string, strategy: StrategyType, output: OptimizerRunOutput) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          scenarioId,
          strategy,
          status: "DRAFT",
          objectiveValue: output.objectiveValue,
          solverStatus: output.solverStatus,
        },
      });

      const revision = await tx.planRevision.create({
        data: { planId: plan.id, revisionNumber: 1 },
      });

      const blockIdByTaskId = new Map<string, string>();
      for (const block of output.planBlocks) {
        const created = await tx.planBlock.create({
          data: {
            planRevisionId: revision.id,
            blockWindowId: block.blockWindowId,
            corridorId: block.corridorId,
            startTime: new Date(block.startTime),
            endTime: new Date(block.endTime),
            department: block.department,
            isBundle: block.isBundle,
          },
        });
        for (const taskId of block.taskIds) {
          blockIdByTaskId.set(taskId, created.id);
        }
      }

      for (const outcome of output.taskOutcomes) {
        await tx.planTask.create({
          data: {
            planRevisionId: revision.id,
            planBlockId: blockIdByTaskId.get(outcome.maintenanceRequestId) ?? null,
            maintenanceRequestId: outcome.maintenanceRequestId,
            scheduled: outcome.scheduled,
            priorityScore: outcome.priorityScore,
            priorityBreakdown: outcome.priorityBreakdown as unknown as object,
            reasons: outcome.reasons as unknown as object,
            rejectionReason: (outcome.rejectionReason as CandidateRejectionReason | null) ?? undefined,
          },
        });
      }

      return { plan, revision };
    });
  }
}
