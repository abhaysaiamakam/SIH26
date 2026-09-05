import { BadRequestException, Injectable } from "@nestjs/common";
import { OptimizerRunInput, OptimizerRunOutput } from "@railopt/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { ScenariosService } from "../scenarios/scenarios.service";
import { OptimizerClientService } from "../optimization/optimizer-client.service";
import { PlanPersistenceService } from "../optimization/plan-persistence.service";
import { buildOptimizerInput } from "../optimization/build-optimizer-input";
import { ValidatorService } from "../validation/validator.service";
import { SimulationService } from "../simulation/simulation.service";
import { AuditService } from "../audit/audit.service";
import { CreateWhatIfDto } from "./dto/create-what-if.dto";

const DEPARTMENT_PREFIX: Record<string, string> = { ENGINEERING: "ENG", TRD: "TRD", S_AND_T: "SNT" };

export interface RunSummary {
  planId: string;
  status: string;
  objectiveValue: number;
  solverStatus: string;
  scheduledCount: number;
  totalCount: number;
  overdueScheduledCount: number;
  blocksUsed: number;
  bundleCount: number;
  totalDelayMinutes: number | null;
}

/** Workflow: what-if event -> affected candidates re-generated -> re-
 * optimized -> re-validated -> re-simulated -> BEFORE/AFTER/DELTA. Runs
 * synchronously (the scenarios here solve in well under a second) rather
 * than through the async PlanningRun polling flow, since the caller wants
 * an immediate side-by-side comparison. */
@Injectable()
export class WhatIfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scenarios: ScenariosService,
    private readonly optimizer: OptimizerClientService,
    private readonly persistence: PlanPersistenceService,
    private readonly validator: ValidatorService,
    private readonly simulation: SimulationService,
    private readonly audit: AuditService,
  ) {}

  async run(dto: CreateWhatIfDto, actorUserId?: string) {
    await this.scenarios.findOne(dto.scenarioId);
    const strategy = dto.strategy ?? "OPTIMIZED";

    await this.audit.log({
      actorUserId,
      action: "REOPTIMIZATION_STARTED",
      entityType: "PlanningScenario",
      entityId: dto.scenarioId,
      metadata: { eventType: dto.eventType, strategy, payload: dto.payload },
    });

    const baseInput = await buildOptimizerInput(this.prisma, dto.scenarioId, strategy);
    const before = await this.runAndPersist(dto.scenarioId, strategy, baseInput);

    const afterInput = await this.applyEvent(dto.scenarioId, dto.eventType, dto.payload, baseInput);
    const after = await this.runAndPersist(dto.scenarioId, strategy, afterInput);

    const event = await this.prisma.scenarioEvent.create({
      data: {
        scenarioId: dto.scenarioId,
        eventType: dto.eventType,
        source: "WHAT_IF",
        payload: dto.payload as object,
        appliedAt: new Date(),
      },
    });

    await this.audit.log({
      actorUserId,
      action: "REOPTIMIZATION_COMPLETED",
      entityType: "PlanningScenario",
      entityId: dto.scenarioId,
      metadata: {
        eventType: dto.eventType,
        strategy,
        scenarioEventId: event.id,
        objectiveDelta: after.objectiveValue - before.objectiveValue,
      },
    });

    return {
      scenarioEventId: event.id,
      eventType: dto.eventType,
      strategy,
      before,
      after,
      delta: {
        objectiveValue: after.objectiveValue - before.objectiveValue,
        scheduledCount: after.scheduledCount - before.scheduledCount,
        overdueScheduledCount: after.overdueScheduledCount - before.overdueScheduledCount,
        bundleCount: after.bundleCount - before.bundleCount,
        blocksUsed: after.blocksUsed - before.blocksUsed,
        totalDelayMinutes:
          after.totalDelayMinutes !== null && before.totalDelayMinutes !== null
            ? after.totalDelayMinutes - before.totalDelayMinutes
            : null,
      },
    };
  }

  private async runAndPersist(scenarioId: string, strategy: OptimizerRunInput["strategy"], input: OptimizerRunInput): Promise<RunSummary> {
    const output: OptimizerRunOutput = await this.optimizer.run(input);
    const { plan, revision } = await this.persistence.persist(scenarioId, strategy, output);

    const validation = await this.validator.validateRevision(revision.id);
    const status = validation.status === "VALID" ? "VALIDATED" : "INVALID";
    await this.prisma.plan.update({ where: { id: plan.id }, data: { status } });

    let totalDelayMinutes: number | null = null;
    if (validation.status === "VALID") {
      const simRun = await this.simulation.simulateRevision(revision.id);
      totalDelayMinutes = simRun.totalDelayMinutes;
    }

    const overdueNow = new Date(input.options.asOf);
    const overdueScheduledCount = output.taskOutcomes.filter((t) => {
      if (!t.scheduled) return false;
      const request = input.maintenanceRequests.find((r) => r.id === t.maintenanceRequestId);
      return request ? new Date(request.dueDate) < overdueNow : false;
    }).length;

    return {
      planId: plan.id,
      status,
      objectiveValue: output.objectiveValue,
      solverStatus: output.solverStatus,
      scheduledCount: output.taskOutcomes.filter((t) => t.scheduled).length,
      totalCount: output.taskOutcomes.length,
      overdueScheduledCount,
      blocksUsed: output.planBlocks.length,
      bundleCount: output.planBlocks.filter((b) => b.isBundle).length,
      totalDelayMinutes,
    };
  }

  private async applyEvent(
    scenarioId: string,
    eventType: CreateWhatIfDto["eventType"],
    payload: Record<string, unknown>,
    baseInput: OptimizerRunInput,
  ): Promise<OptimizerRunInput> {
    switch (eventType) {
      case "CORRIDOR_UNAVAILABLE": {
        const corridorId = this.requireString(payload, "corridorId");
        return { ...baseInput, blockWindows: baseInput.blockWindows.filter((w) => w.corridorId !== corridorId) };
      }

      case "BLOCK_WINDOW_SHORTENED": {
        const blockWindowId = this.requireString(payload, "blockWindowId");
        const newDurationMinutes = this.requireNumber(payload, "newDurationMinutes");
        return {
          ...baseInput,
          blockWindows: baseInput.blockWindows.map((w) => {
            if (w.id !== blockWindowId) return w;
            const endTime = new Date(new Date(w.startTime).getTime() + newDurationMinutes * 60_000).toISOString();
            return { ...w, durationMinutes: newDurationMinutes, endTime };
          }),
        };
      }

      case "TASK_BECOMES_OVERDUE": {
        const maintenanceRequestId = this.requireString(payload, "maintenanceRequestId");
        const overdueDate = new Date(new Date(baseInput.options.asOf).getTime() - 3 * 86_400_000).toISOString();
        return {
          ...baseInput,
          maintenanceRequests: baseInput.maintenanceRequests.map((r) =>
            r.id === maintenanceRequestId ? { ...r, dueDate: overdueDate } : r,
          ),
        };
      }

      case "NEW_CRITICAL_REQUEST": {
        const assetId = this.requireString(payload, "assetId");
        const corridorId = this.requireString(payload, "corridorId");
        const department = this.requireString(payload, "department") as "ENGINEERING" | "TRD" | "S_AND_T";
        const workType = this.requireString(payload, "workType");
        const estimatedDurationMinutes = this.requireNumber(payload, "estimatedDurationMinutes");
        const dueInDays = typeof payload.dueInDays === "number" ? payload.dueInDays : 3;
        const description = typeof payload.description === "string" ? payload.description : `Newly reported critical ${workType} request`;

        const prefix = `${DEPARTMENT_PREFIX[department]}-WHATIF`;
        const count = await this.prisma.maintenanceRequest.count({ where: { requestNumber: { startsWith: `${prefix}-` } } });

        await this.prisma.maintenanceRequest.create({
          data: {
            requestNumber: `${prefix}-${String(count + 1).padStart(3, "0")}`,
            department,
            assetId,
            corridorId,
            workType: workType as never,
            description,
            criticality: "CRITICAL",
            urgency: "CRITICAL",
            dueDate: new Date(Date.now() + dueInDays * 86_400_000),
            estimatedDurationMinutes,
            scenarioId,
          },
        });
        return buildOptimizerInput(this.prisma, scenarioId, baseInput.strategy);
      }

      case "ADDITIONAL_TRAIN_MOVEMENT": {
        const corridorId = this.requireString(payload, "corridorId");
        const trainType = this.requireString(payload, "trainType") as "PASSENGER" | "EXPRESS" | "GOODS" | "SUBURBAN";
        const scheduledStart = this.requireString(payload, "scheduledStart");
        const scheduledEnd = this.requireString(payload, "scheduledEnd");
        const priority = typeof payload.priority === "number" ? payload.priority : 5;
        const trainNumber = typeof payload.trainNumber === "string" ? payload.trainNumber : `WHATIF-${Date.now()}`;

        await this.prisma.trainMovement.create({
          data: {
            trainNumber,
            trainType,
            corridorId,
            scheduledStart: new Date(scheduledStart),
            scheduledEnd: new Date(scheduledEnd),
            priority,
            scenarioId,
          },
        });
        return buildOptimizerInput(this.prisma, scenarioId, baseInput.strategy);
      }

      default:
        throw new BadRequestException(`Unknown what-if event type: ${eventType}`);
    }
  }

  private requireString(payload: Record<string, unknown>, key: string): string {
    const value = payload[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new BadRequestException(`what-if payload.${key} must be a non-empty string`);
    }
    return value;
  }

  private requireNumber(payload: Record<string, unknown>, key: string): number {
    const value = payload[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new BadRequestException(`what-if payload.${key} must be a number`);
    }
    return value;
  }
}
