import { Injectable, NotFoundException } from "@nestjs/common";
import { SimulatorClientService } from "./simulator-client.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulator: SimulatorClientService,
  ) {}

  async simulateRevision(planRevisionId: string, scenarioEventId?: string) {
    const revision = await this.prisma.planRevision.findUnique({
      where: { id: planRevisionId },
      include: { plan: true, blocks: { include: { blockWindow: true } } },
    });
    if (!revision) throw new NotFoundException(`Plan revision ${planRevisionId} not found`);

    const trainMovements = await this.prisma.trainMovement.findMany({ where: { scenarioId: revision.plan.scenarioId } });

    const blockTasksByBlockId = await this.prisma.planTask.findMany({
      where: { planRevisionId, planBlockId: { not: null } },
      select: { planBlockId: true, maintenanceRequestId: true },
    });
    const taskIdsByBlockId = new Map<string, string[]>();
    for (const t of blockTasksByBlockId) {
      const list = taskIdsByBlockId.get(t.planBlockId!) ?? [];
      list.push(t.maintenanceRequestId);
      taskIdsByBlockId.set(t.planBlockId!, list);
    }

    const output = await this.simulator.run({
      planRevisionId,
      planBlocks: revision.blocks.map((b) => ({
        blockWindowId: b.blockWindowId,
        corridorId: b.corridorId,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        isBundle: b.isBundle,
        department: b.department,
        taskIds: taskIdsByBlockId.get(b.id) ?? [],
      })),
      blockWindows: revision.blocks.map((b) => ({
        id: b.blockWindow.id,
        corridorId: b.blockWindow.corridorId,
        segmentId: b.blockWindow.segmentId,
        startTime: b.blockWindow.startTime.toISOString(),
        endTime: b.blockWindow.endTime.toISOString(),
        durationMinutes: b.blockWindow.durationMinutes,
        permittedDepartments: b.blockWindow.permittedDepartments,
        allowsIsolationTypes: b.blockWindow.allowsIsolationTypes,
        allowsPowerTypes: b.blockWindow.allowsPowerTypes,
        maxConcurrentResources: b.blockWindow.maxConcurrentResources,
      })),
      trainMovements: trainMovements.map((t) => ({
        id: t.id,
        trainNumber: t.trainNumber,
        trainType: t.trainType,
        corridorId: t.corridorId,
        segmentId: t.segmentId,
        trackResourceId: t.trackResourceId,
        scheduledStart: t.scheduledStart.toISOString(),
        scheduledEnd: t.scheduledEnd.toISOString(),
        priority: t.priority,
      })),
    });

    return this.prisma.simulationRun.create({
      data: {
        planRevisionId,
        scenarioEventId,
        impactedTrainCount: output.impactedTrainCount,
        totalDelayMinutes: output.totalDelayMinutes,
        affectedMovements: output.affectedMovements as unknown as object,
        conflicts: output.conflicts as unknown as object,
        blockUtilization: output.blockUtilization as unknown as object,
        assumptions: output.assumptions as unknown as object,
      },
    });
  }
}
