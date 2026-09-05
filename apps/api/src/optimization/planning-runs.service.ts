import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { StrategyType } from "@railopt/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { ScenariosService } from "../scenarios/scenarios.service";
import { ValidatorService } from "../validation/validator.service";
import { SimulationService } from "../simulation/simulation.service";
import { OptimizerClientService } from "./optimizer-client.service";
import { PlanPersistenceService } from "./plan-persistence.service";
import { buildOptimizerInput } from "./build-optimizer-input";
import { CreatePlanningRunDto } from "./dto/create-planning-run.dto";

@Injectable()
export class PlanningRunsService {
  private readonly logger = new Logger(PlanningRunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly optimizer: OptimizerClientService,
    private readonly scenarios: ScenariosService,
    private readonly validator: ValidatorService,
    private readonly simulation: SimulationService,
    private readonly persistence: PlanPersistenceService,
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

      const { plan, revision } = await this.persistence.persist(run.scenarioId, strategy, output);

      // Never assume the optimizer is correct merely because it returned a
      // result - the independent validator always re-derives VALID/INVALID
      // from scratch before the plan is presented for approval.
      const validation = await this.validator.validateRevision(revision.id);
      await this.prisma.plan.update({
        where: { id: plan.id },
        data: { status: validation.status === "VALID" ? "VALIDATED" : "INVALID" },
      });

      if (validation.status === "VALID") {
        await this.simulation.simulateRevision(revision.id);
      }

      await this.prisma.planningRun.update({
        where: { id: planningRunId },
        data: {
          status: "SUCCEEDED",
          solverStatus: output.solverStatus,
          objectiveValue: output.objectiveValue,
          candidateCount: output.diagnostics.candidateCount,
          feasibleCandidateCount: output.diagnostics.feasibleCandidateCount,
          rejectedCandidateCount: output.diagnostics.rejectedCandidateCount,
          solveTimeMs: output.diagnostics.solveTimeMs,
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
}
