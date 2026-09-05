import { Injectable, NotFoundException } from "@nestjs/common";
import { loadCompatibilityDefaultsV1 } from "@railopt/config";
import { PrismaService } from "../prisma/prisma.service";
import { areWorkTypesCompatible } from "./compatibility-check";
import { Violation } from "./types";

const HARD_CONFLICT_TRAIN_TYPES = ["PASSENGER", "EXPRESS", "SUBURBAN"];

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Independent validator: re-derives every constraint directly from Prisma
 * state, from scratch, with no shared code with services/optimizer. Never
 * assume the optimizer is correct merely because CP-SAT returned a
 * solution - this is the check that actually decides VALID/INVALID. */
@Injectable()
export class ValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  async validateRevision(planRevisionId: string): Promise<{ status: "VALID" | "INVALID"; violations: Violation[] }> {
    const revision = await this.prisma.planRevision.findUnique({
      where: { id: planRevisionId },
      include: {
        plan: true,
        blocks: { include: { blockWindow: true } },
        tasks: { include: { maintenanceRequest: { include: { requiredResources: true } } } },
      },
    });
    if (!revision) throw new NotFoundException(`Plan revision ${planRevisionId} not found`);

    const scenarioId = revision.plan.scenarioId;
    const [trainMovements, compatibilityRules, dependencies, trackResources] = await Promise.all([
      this.prisma.trainMovement.findMany({ where: { scenarioId } }),
      this.prisma.taskCompatibilityRule.findMany(),
      this.prisma.requestDependency.findMany({
        where: {
          predecessorId: { in: revision.tasks.map((t) => t.maintenanceRequestId) },
          successorId: { in: revision.tasks.map((t) => t.maintenanceRequestId) },
        },
      }),
      this.prisma.trackResource.findMany(),
    ]);
    const capacityByResourceId = new Map(trackResources.map((r) => [r.id, r.capacity]));
    const compatibilityDefaults = loadCompatibilityDefaultsV1();

    const violations: Violation[] = [];
    const scheduledTasks = revision.tasks.filter((t) => t.scheduled && t.planBlockId);
    const taskByRequestId = new Map(scheduledTasks.map((t) => [t.maintenanceRequestId, t]));

    // 1. Task uniqueness - each maintenance request scheduled in at most one block.
    const seenRequestIds = new Set<string>();
    for (const t of scheduledTasks) {
      if (seenRequestIds.has(t.maintenanceRequestId)) {
        violations.push({
          code: "TASK_DOUBLE_BOOKED",
          severity: "CRITICAL",
          message: `Maintenance request ${t.maintenanceRequestId} is scheduled in more than one block`,
          relatedTaskIds: [t.maintenanceRequestId],
        });
      }
      seenRequestIds.add(t.maintenanceRequestId);
    }

    for (const block of revision.blocks) {
      const blockTasks = scheduledTasks.filter((t) => t.planBlockId === block.id);
      const requests = blockTasks.map((t) => t.maintenanceRequest);
      const requestIds = requests.map((r) => r.id);

      // 2. Block containment.
      if (block.startTime < block.blockWindow.startTime || block.endTime > block.blockWindow.endTime) {
        violations.push({
          code: "BLOCK_OUTSIDE_WINDOW",
          severity: "CRITICAL",
          message: `Block ${block.id} (${block.startTime.toISOString()} - ${block.endTime.toISOString()}) falls outside its window (${block.blockWindow.startTime.toISOString()} - ${block.blockWindow.endTime.toISOString()})`,
          relatedTaskIds: requestIds,
        });
      }

      // 3. Duration - block must cover the longest concurrent task.
      const requiredMinutes = Math.max(0, ...requests.map((r) => r.estimatedDurationMinutes));
      const blockMinutes = (block.endTime.getTime() - block.startTime.getTime()) / 60_000;
      if (blockMinutes < requiredMinutes) {
        violations.push({
          code: "DURATION_INSUFFICIENT",
          severity: "ERROR",
          message: `Block ${block.id} is ${blockMinutes}min but requires at least ${requiredMinutes}min`,
          relatedTaskIds: requestIds,
        });
      }

      // 5. Isolation.
      for (const r of requests) {
        if (r.requiredIsolation !== "NONE" && !block.blockWindow.allowsIsolationTypes.includes(r.requiredIsolation)) {
          violations.push({
            code: "ISOLATION_VIOLATION",
            severity: "CRITICAL",
            message: `Request ${r.requestNumber} requires ${r.requiredIsolation} isolation, not permitted by window ${block.blockWindow.id}`,
            relatedTaskIds: [r.id],
          });
        }
      }

      // 6. Power.
      for (const r of requests) {
        if (r.requiredPower !== "NONE" && !block.blockWindow.allowsPowerTypes.includes(r.requiredPower)) {
          violations.push({
            code: "POWER_VIOLATION",
            severity: "CRITICAL",
            message: `Request ${r.requestNumber} requires ${r.requiredPower} power, not permitted by window ${block.blockWindow.id}`,
            relatedTaskIds: [r.id],
          });
        }
      }

      // 7. Department permission.
      const departments = new Set(requests.map((r) => r.department));
      for (const dept of departments) {
        if (!block.blockWindow.permittedDepartments.includes(dept)) {
          violations.push({
            code: "DEPARTMENT_NOT_PERMITTED",
            severity: "ERROR",
            message: `Department ${dept} is not permitted in window ${block.blockWindow.id}`,
            relatedTaskIds: requestIds,
          });
        }
      }

      // 8. Bundle compatibility (independent re-check).
      if (requests.length > 1) {
        for (let i = 0; i < requests.length; i++) {
          for (let j = i + 1; j < requests.length; j++) {
            const compatible = areWorkTypesCompatible(requests[i], requests[j], compatibilityRules, compatibilityDefaults);
            if (!compatible) {
              violations.push({
                code: "INCOMPATIBLE_BUNDLE",
                severity: "CRITICAL",
                message: `Bundled requests ${requests[i].requestNumber} and ${requests[j].requestNumber} are not compatible work types`,
                relatedTaskIds: [requests[i].id, requests[j].id],
              });
            }
          }
        }
      }

      // 9. Operational conflict - hard-conflict trains overlapping this block.
      for (const tm of trainMovements) {
        if (tm.corridorId !== block.corridorId) continue;
        if (!HARD_CONFLICT_TRAIN_TYPES.includes(tm.trainType)) continue;
        if (overlaps(block.startTime, block.endTime, tm.scheduledStart, tm.scheduledEnd)) {
          violations.push({
            code: "OPERATIONAL_CONFLICT",
            severity: "CRITICAL",
            message: `Block ${block.id} overlaps ${tm.trainType} train ${tm.trainNumber} on the same corridor`,
            relatedTaskIds: requestIds,
          });
        }
      }
    }

    // 4. Resource overlap - across every pair of blocks in the revision.
    for (let i = 0; i < revision.blocks.length; i++) {
      for (let j = i + 1; j < revision.blocks.length; j++) {
        const a = revision.blocks[i];
        const b = revision.blocks[j];
        if (!overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

        const demandA = this.resourceDemand(scheduledTasks.filter((t) => t.planBlockId === a.id));
        const demandB = this.resourceDemand(scheduledTasks.filter((t) => t.planBlockId === b.id));
        for (const [resourceId, qtyA] of demandA.entries()) {
          const qtyB = demandB.get(resourceId);
          if (qtyB === undefined) continue;
          const capacity = capacityByResourceId.get(resourceId) ?? 1;
          if (qtyA + qtyB > capacity) {
            violations.push({
              code: "RESOURCE_OVERLAP",
              severity: "CRITICAL",
              message: `Blocks ${a.id} and ${b.id} both require resource ${resourceId} (combined demand ${qtyA + qtyB} exceeds capacity ${capacity}) during an overlapping time window`,
              relatedTaskIds: [],
            });
          }
        }
      }
    }

    // 10. Dependencies - predecessor must be scheduled and end before the successor starts.
    for (const dep of dependencies) {
      const successorTask = taskByRequestId.get(dep.successorId);
      if (!successorTask) continue; // successor not scheduled - nothing to violate
      const predecessorTask = taskByRequestId.get(dep.predecessorId);
      if (!predecessorTask) {
        violations.push({
          code: "DEPENDENCY_VIOLATION",
          severity: "CRITICAL",
          message: `Successor ${dep.successorId} is scheduled but its predecessor ${dep.predecessorId} is not`,
          relatedTaskIds: [dep.predecessorId, dep.successorId],
        });
        continue;
      }
      const predecessorBlock = revision.blocks.find((b) => b.id === predecessorTask.planBlockId);
      const successorBlock = revision.blocks.find((b) => b.id === successorTask.planBlockId);
      if (predecessorBlock && successorBlock && predecessorBlock.endTime > successorBlock.startTime) {
        violations.push({
          code: "DEPENDENCY_VIOLATION",
          severity: "CRITICAL",
          message: `Predecessor ${dep.predecessorId} ends after successor ${dep.successorId} starts`,
          relatedTaskIds: [dep.predecessorId, dep.successorId],
        });
      }
    }

    const status = violations.length === 0 ? "VALID" : "INVALID";

    await this.prisma.validationRun.create({
      data: {
        planRevisionId,
        status,
        violations: violations as unknown as object,
      },
    });

    return { status, violations };
  }

  private resourceDemand(tasks: { maintenanceRequest: { requiredResources: { trackResourceId: string; quantity: number }[] } }[]) {
    const demand = new Map<string, number>();
    for (const t of tasks) {
      for (const r of t.maintenanceRequest.requiredResources) {
        demand.set(r.trackResourceId, (demand.get(r.trackResourceId) ?? 0) + r.quantity);
      }
    }
    return demand;
  }
}
