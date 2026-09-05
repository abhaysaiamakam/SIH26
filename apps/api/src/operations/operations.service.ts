import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ScenariosService } from "../scenarios/scenarios.service";
import { FindBlockWindowsQuery } from "./dto/find-block-windows.query";
import { FindTrainMovementsQuery } from "./dto/find-train-movements.query";

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scenarios: ScenariosService,
  ) {}

  async findBlockWindows(query: FindBlockWindowsQuery) {
    const scenarioId = await this.scenarios.resolveScenarioId(query.scenarioId);
    const where: Prisma.BlockWindowWhereInput = { scenarioId };
    if (query.corridorId) where.corridorId = query.corridorId;

    return this.prisma.blockWindow.findMany({
      where,
      include: { corridor: true, segment: true },
      orderBy: { startTime: "asc" },
    });
  }

  async findTrainMovements(query: FindTrainMovementsQuery) {
    const scenarioId = await this.scenarios.resolveScenarioId(query.scenarioId);
    const where: Prisma.TrainMovementWhereInput = { scenarioId };
    if (query.corridorId) where.corridorId = query.corridorId;

    return this.prisma.trainMovement.findMany({
      where,
      include: { corridor: true, segment: true },
      orderBy: { scheduledStart: "asc" },
    });
  }
}
