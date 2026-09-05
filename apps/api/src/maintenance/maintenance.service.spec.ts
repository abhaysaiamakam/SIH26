import { NotFoundException } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    maintenanceRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      ...overrides.maintenanceRequest,
    },
    corridor: {
      findUnique: jest.fn().mockResolvedValue({ id: "c1", code: "C-01" }),
      ...overrides.corridor,
    },
  } as any;
}

describe("MaintenanceService.findAll", () => {
  it("marks a past-due, not-yet-completed request as overdue", async () => {
    const past = new Date(Date.now() - 5 * 86_400_000);
    const prisma = mockPrisma({
      maintenanceRequest: {
        findMany: jest.fn().mockResolvedValue([{ id: "r1", dueDate: past, status: "OPEN" }]),
      },
    });
    const service = new MaintenanceService(prisma);
    const result = await service.findAll({});
    expect(result[0].overdue).toBe(true);
  });

  it("does not mark a completed request as overdue even if the due date has passed", async () => {
    const past = new Date(Date.now() - 5 * 86_400_000);
    const prisma = mockPrisma({
      maintenanceRequest: {
        findMany: jest.fn().mockResolvedValue([{ id: "r1", dueDate: past, status: "COMPLETED" }]),
      },
    });
    const service = new MaintenanceService(prisma);
    const result = await service.findAll({});
    expect(result[0].overdue).toBe(false);
  });

  it("does not mark a future-due request as overdue", async () => {
    const future = new Date(Date.now() + 5 * 86_400_000);
    const prisma = mockPrisma({
      maintenanceRequest: {
        findMany: jest.fn().mockResolvedValue([{ id: "r1", dueDate: future, status: "OPEN" }]),
      },
    });
    const service = new MaintenanceService(prisma);
    const result = await service.findAll({});
    expect(result[0].overdue).toBe(false);
  });
});

describe("MaintenanceService.findOne", () => {
  it("throws NotFoundException for an unknown id", async () => {
    const prisma = mockPrisma();
    const service = new MaintenanceService(prisma);
    await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("exposes dependsOn/blockedFor from predecessor/successor links", async () => {
    const prisma = mockPrisma({
      maintenanceRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "r2",
          dueDate: new Date(Date.now() + 86_400_000),
          status: "OPEN",
          predecessorLinks: [{ predecessor: { id: "r1", requestNumber: "ENG-C-01-001" } }],
          successorLinks: [{ successor: { id: "r3", requestNumber: "ENG-C-01-003" } }],
        }),
      },
    });
    const service = new MaintenanceService(prisma);
    const result = await service.findOne("r2");
    expect(result.dependsOn.map((r) => r.id)).toEqual(["r1"]);
    expect(result.blockedFor.map((r) => r.id)).toEqual(["r3"]);
  });
});

describe("MaintenanceService.create", () => {
  it("generates a sequential request number scoped to department + corridor code", async () => {
    const createMock = jest.fn().mockResolvedValue({ id: "new" });
    const prisma = mockPrisma({
      maintenanceRequest: { count: jest.fn().mockResolvedValue(3), create: createMock },
      corridor: { findUnique: jest.fn().mockResolvedValue({ id: "c1", code: "C-02" }) },
    });
    const service = new MaintenanceService(prisma);
    await service.create({
      scenarioId: "s1",
      department: "TRD",
      assetId: "a1",
      corridorId: "c1",
      workType: "OHE_MAINTENANCE",
      description: "test",
      criticality: "MEDIUM",
      urgency: "MEDIUM",
      dueDate: new Date().toISOString(),
      estimatedDurationMinutes: 60,
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requestNumber: "TRD-C-02-004" }) }),
    );
  });
});
