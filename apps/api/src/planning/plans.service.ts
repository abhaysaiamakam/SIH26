import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { FindPlansQuery } from "./dto/find-plans.query";

const REVISION_INCLUDE = {
  blocks: true,
  tasks: { include: { maintenanceRequest: true } },
  validationRuns: { orderBy: { createdAt: "desc" as const } },
  simulationRuns: { orderBy: { createdAt: "desc" as const } },
  approvalDecisions: { include: { decidedBy: true }, orderBy: { createdAt: "desc" as const } },
};

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(query: FindPlansQuery) {
    return this.prisma.plan.findMany({
      where: { scenarioId: query.scenarioId, status: query.status },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { revisions: { orderBy: { revisionNumber: "desc" }, include: REVISION_INCLUDE } },
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  private async latestRevision(planId: string) {
    return this.prisma.planRevision.findFirstOrThrow({
      where: { planId },
      orderBy: { revisionNumber: "desc" },
    });
  }

  async approve(planId: string, decidedById: string, comment?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    if (plan.status === "APPROVED" || plan.status === "REJECTED") {
      throw new ConflictException(`Plan ${planId} has already been decided (status: ${plan.status})`);
    }
    // Only VALID plans may be approved - never call an invalid plan optimized/approved.
    if (plan.status !== "VALIDATED") {
      throw new BadRequestException(`Only a VALIDATED plan may be approved (current status: ${plan.status})`);
    }

    const revision = await this.latestRevision(planId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.planRevision.update({ where: { id: revision.id }, data: { isImmutable: true } });
      await tx.approvalDecision.create({
        data: { planRevisionId: revision.id, decidedById, decision: "APPROVED", comment },
      });
      return tx.plan.update({ where: { id: planId }, data: { status: "APPROVED" } });
    });

    await this.audit.log({
      actorUserId: decidedById,
      action: "PLAN_APPROVED",
      entityType: "Plan",
      entityId: planId,
      before: { status: plan.status },
      after: { status: "APPROVED" },
      metadata: { scenarioId: plan.scenarioId, comment },
    });

    return updated;
  }

  async reject(planId: string, decidedById: string, comment?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    if (plan.status === "APPROVED") {
      throw new ConflictException(`Plan ${planId} is already approved and immutable - it cannot be rejected`);
    }
    if (plan.status === "REJECTED") {
      throw new ConflictException(`Plan ${planId} has already been rejected`);
    }

    const revision = await this.latestRevision(planId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.approvalDecision.create({
        data: { planRevisionId: revision.id, decidedById, decision: "REJECTED", comment },
      });
      return tx.plan.update({ where: { id: planId }, data: { status: "REJECTED" } });
    });

    await this.audit.log({
      actorUserId: decidedById,
      action: "PLAN_REJECTED",
      entityType: "Plan",
      entityId: planId,
      before: { status: plan.status },
      after: { status: "REJECTED" },
      metadata: { scenarioId: plan.scenarioId, comment },
    });

    return updated;
  }
}
