import { NotFoundException } from "@nestjs/common";
import { ScenariosService } from "./scenarios.service";

function mockPrisma(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    planningScenario: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      ...overrides,
    },
  } as any;
}

describe("ScenariosService.resolveScenarioId", () => {
  it("returns the given scenarioId when it exists", async () => {
    const prisma = mockPrisma({ findUnique: jest.fn().mockResolvedValue({ id: "s1" }) });
    const service = new ScenariosService(prisma);
    await expect(service.resolveScenarioId("s1")).resolves.toBe("s1");
  });

  it("throws when the given scenarioId does not exist", async () => {
    const prisma = mockPrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const service = new ScenariosService(prisma);
    await expect(service.resolveScenarioId("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("falls back to the most recently generated scenario when none is given", async () => {
    const prisma = mockPrisma({ findFirst: jest.fn().mockResolvedValue({ id: "latest" }) });
    const service = new ScenariosService(prisma);
    await expect(service.resolveScenarioId(undefined)).resolves.toBe("latest");
  });

  it("throws when no scenario has ever been generated", async () => {
    const prisma = mockPrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const service = new ScenariosService(prisma);
    await expect(service.resolveScenarioId(undefined)).rejects.toBeInstanceOf(NotFoundException);
  });
});
