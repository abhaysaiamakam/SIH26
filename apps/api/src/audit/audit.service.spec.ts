import { AuditService } from "./audit.service";

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    auditEvent: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides,
    },
  } as any;
}

describe("AuditService.log", () => {
  it("writes an AuditEvent row with the given fields", async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new AuditService(mockPrisma({ create }));
    await service.log({
      actorUserId: "user-1",
      action: "PLAN_APPROVED",
      entityType: "Plan",
      entityId: "plan-1",
      metadata: { comment: "looks good" },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "user-1",
        action: "PLAN_APPROVED",
        entityType: "Plan",
        entityId: "plan-1",
        metadata: { comment: "looks good" },
      }),
    });
  });

  it("never throws even if the write fails", async () => {
    const create = jest.fn().mockRejectedValue(new Error("db down"));
    const service = new AuditService(mockPrisma({ create }));
    await expect(
      service.log({ action: "PLAN_APPROVED", entityType: "Plan", entityId: "plan-1" }),
    ).resolves.toBeUndefined();
  });
});

describe("AuditService.findAll", () => {
  it("filters by scenarioId via a JSON metadata path filter", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AuditService(mockPrisma({ findMany }));
    await service.findAll({ scenarioId: "scenario-1" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ metadata: { path: ["scenarioId"], equals: "scenario-1" } }),
      }),
    );
  });
});
