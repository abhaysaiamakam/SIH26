import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type AuditAction =
  | "SCENARIO_CREATED"
  | "TASK_PRIORITIZED"
  | "OPTIMIZATION_STARTED"
  | "OPTIMIZATION_COMPLETED"
  | "PLAN_GENERATED"
  | "PLAN_VALIDATED"
  | "PLAN_APPROVED"
  | "PLAN_REJECTED"
  | "REOPTIMIZATION_STARTED"
  | "REOPTIMIZATION_COMPLETED";

export interface AuditLogInput {
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

/** Records governance/lifecycle events (see the AuditAction union, which
 * mirrors the project brief's audit event list) as AuditEvent rows. Never
 * throws - a failure to write an audit row must never break the mutation
 * it is describing. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          correlationId: input.correlationId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          before: (input.before ?? undefined) as object | undefined,
          after: (input.after ?? undefined) as object | undefined,
          metadata: (input.metadata ?? undefined) as object | undefined,
        },
      });
    } catch {
      // Audit logging is best-effort - never let it fail the caller's mutation.
    }
  }

  findAll(params: { scenarioId?: string; entityType?: string; limit?: number }) {
    return this.prisma.auditEvent.findMany({
      where: {
        entityType: params.entityType,
        ...(params.scenarioId ? { metadata: { path: ["scenarioId"], equals: params.scenarioId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 200,
    });
  }
}
