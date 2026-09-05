import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { FindMaintenanceQuery } from "./dto/find-maintenance.query";

const DEPARTMENT_PREFIX: Record<string, string> = {
  ENGINEERING: "ENG",
  TRD: "TRD",
  S_AND_T: "SNT",
};

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindMaintenanceQuery) {
    const where: Prisma.MaintenanceRequestWhereInput = {};
    if (query.scenarioId) where.scenarioId = query.scenarioId;
    if (query.department) where.department = query.department;
    if (query.corridorId) where.corridorId = query.corridorId;
    if (query.criticality) where.criticality = query.criticality;
    if (query.status) where.status = query.status;
    if (query.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ["COMPLETED", "CLOSED"] };
    }

    const requests = await this.prisma.maintenanceRequest.findMany({
      where,
      include: { asset: true, corridor: true, segment: true },
      orderBy: { dueDate: "asc" },
    });

    const now = Date.now();
    return requests.map((r) => ({
      ...r,
      overdue: r.dueDate.getTime() < now && !["COMPLETED", "CLOSED"].includes(r.status),
    }));
  }

  async findOne(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        asset: true,
        corridor: true,
        segment: true,
        requiredResources: { include: { trackResource: true } },
        predecessorLinks: { include: { predecessor: true } },
        successorLinks: { include: { successor: true } },
      },
    });
    if (!request) throw new NotFoundException(`Maintenance request ${id} not found`);

    const now = Date.now();
    return {
      ...request,
      overdue: request.dueDate.getTime() < now && !["COMPLETED", "CLOSED"].includes(request.status),
      dependsOn: request.predecessorLinks.map((l) => l.predecessor),
      blockedFor: request.successorLinks.map((l) => l.successor),
    };
  }

  async create(dto: CreateMaintenanceRequestDto) {
    const prefix = `${DEPARTMENT_PREFIX[dto.department]}-${await this.corridorCode(dto.corridorId)}`;
    const count = await this.prisma.maintenanceRequest.count({
      where: { requestNumber: { startsWith: `${prefix}-` } },
    });
    const requestNumber = `${prefix}-${String(count + 1).padStart(3, "0")}`;

    return this.prisma.maintenanceRequest.create({
      data: {
        requestNumber,
        department: dto.department,
        assetId: dto.assetId,
        corridorId: dto.corridorId,
        segmentId: dto.segmentId,
        workType: dto.workType,
        description: dto.description,
        criticality: dto.criticality,
        urgency: dto.urgency,
        dueDate: new Date(dto.dueDate),
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        requiredIsolation: dto.requiredIsolation ?? "NONE",
        requiredPower: dto.requiredPower ?? "NONE",
        scenarioId: dto.scenarioId,
        requiredResources: dto.requiredResources
          ? { create: dto.requiredResources.map((r) => ({ trackResourceId: r.trackResourceId, quantity: r.quantity })) }
          : undefined,
      },
      include: { asset: true, corridor: true, requiredResources: true },
    });
  }

  private async corridorCode(corridorId: string): Promise<string> {
    const corridor = await this.prisma.corridor.findUnique({ where: { id: corridorId } });
    if (!corridor) throw new NotFoundException(`Corridor ${corridorId} not found`);
    return corridor.code;
  }
}
