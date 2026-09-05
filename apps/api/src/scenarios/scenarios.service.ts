import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ScenariosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.planningScenario.findMany({ orderBy: { generatedAt: "desc" } });
  }

  async findOne(id: string) {
    const scenario = await this.prisma.planningScenario.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundException(`Scenario ${id} not found`);
    return scenario;
  }

  /** Resolves an explicit scenarioId, or falls back to the most recently generated scenario. */
  async resolveScenarioId(scenarioId?: string): Promise<string> {
    if (scenarioId) {
      await this.findOne(scenarioId);
      return scenarioId;
    }
    const latest = await this.prisma.planningScenario.findFirst({ orderBy: { generatedAt: "desc" } });
    if (!latest) {
      throw new NotFoundException("No planning scenario has been generated yet - run the seed script first.");
    }
    return latest.id;
  }
}
