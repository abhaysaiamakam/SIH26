import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CandidateRejectionReason, StrategyType } from "@railopt/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { ScenariosService } from "../scenarios/scenarios.service";
import { OptimizerClientService } from "./optimizer-client.service";
import { buildOptimizerInput } from "./build-optimizer-input";
import { CreatePlanningRunDto } from "./dto/create-planning-run.dto";

@Injectable()
export class PlanningRunsService {
  private readonly logger = new Logger(PlanningRunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly optimizer: OptimizerClientService,
    private readonly scenarios: ScenariosService,
  ) {}

  async create(dto: CreatePlanningRunDto) {
    await this.scenarios.findOne(dto.scenarioId); // 404s early if the scenario doesn't exist
    const input = await buildOptimizerInput(this.prisma, dto.scenarioId, dto.strategy);
    const run = await this.prisma.planningRun.create({
      data: {
        scenarioId: dto.scenarioId,
        strategy: dto.strategy,
        status: "PENDING",
        inputSnapshot: input as unknown as object,
      },
    });

    // Fire-and-forget: the request returns immediately with the run id;
    // the client polls GET /planning-runs/:id. Errors are caught inside
    // executeRun and reflected only in the PlanningRun row - they must
    // never crash this request or the process.
    this.executeRun(run.id, dto.strategy).catch((err) => {
      this.logger.error(`Unhandled error running planning run ${run.id}: ${err}`);
    });

    return run;
  }

  findOne(id: string) {
    return this.prisma.planningRun
      .findUniqueOrThrow({ where: { id }, include: { resultPlan: true } })
      .catch(() => {
        throw new NotFoundException(`Planning run ${id} not found`);
      });
  }

  private async executeRun(planningRunId: string, strategy: StrategyType) {
    const run = await this.prisma.planningRun.findUnique({ where: { id: planningRunId } });
    if (!run) return;

    await this.prisma.planningRun.update({
      where: { id: planningRunId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      const input = await buildOptimizerInput(this.prisma, run.scenarioId, strategy);
      const output = await this.optimizer.run(input);

      const plan = await this.persistPlan(run.scenarioId, strategy, output);

      await this.prisma.planningRun.update({
        where: { id: planningRunId },
        data: {
          status: "SUCCEEDED",
          solverStatus: output.solverStatus,
          objectiveValue: output.objectiveValue,
          resultPlanId: plan.id,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Planning run ${planningRunId} failed: ${err}`);
      await this.prisma.planningRun.update({
        where: { id: planningRunId },
        data: {
          status: "FAILED",
          errorMessage: (err as Error).message,
          finishedAt: new Date(),
        },
      });
    }
  }

  private async persistPlan(scenarioId: string, strategy: StrategyType, output: Awaited<ReturnType<OptimizerClientService["run"]>>) {
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

      return plan;
    });
  }
}
