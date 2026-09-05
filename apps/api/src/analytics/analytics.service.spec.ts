import { AnalyticsService } from "./analytics.service";

function mockPrisma(findFirstImpl: (args: any) => any) {
  return {
    plan: {
      findFirst: jest.fn(findFirstImpl),
    },
  } as any;
}

function makePlan(strategy: string, overrides: Record<string, any> = {}) {
  return {
    id: `plan-${strategy}`,
    strategy,
    objectiveValue: 1000,
    revisions: [
      {
        revisionNumber: 1,
        tasks: [
          { scheduled: true, priorityBreakdown: { assetCriticality: 30, overdue: 5 } },
          { scheduled: true, priorityBreakdown: { assetCriticality: 10, overdue: 0 } },
          { scheduled: false, priorityBreakdown: { assetCriticality: 30, overdue: 0 } },
        ],
        blocks: [{ isBundle: true }, { isBundle: false }],
        simulationRuns: [
          {
            blockUtilization: [{ utilizationRatio: 0.5 }, { utilizationRatio: 0.7 }],
            conflicts: [],
            totalDelayMinutes: 42,
          },
        ],
        ...overrides,
      },
    ],
  };
}

describe("AnalyticsService.compareStrategies", () => {
  it("returns computed metrics only for strategies with a persisted VALIDATED/APPROVED plan", async () => {
    const prisma = mockPrisma((args: any) => {
      if (args.where.strategy === "FIRST_FEASIBLE") return Promise.resolve(makePlan("FIRST_FEASIBLE"));
      return Promise.resolve(null);
    });
    const service = new AnalyticsService(prisma);
    const results = await service.compareStrategies("scenario-1");

    expect(results).toHaveLength(1);
    expect(results[0].strategy).toBe("FIRST_FEASIBLE");
    expect(results[0].maintenanceCompletion).toEqual({ scheduled: 2, total: 3, ratio: 2 / 3 });
    expect(results[0].criticalCompletion).toBe(1);
    expect(results[0].overdueCompletion).toBe(1);
    expect(results[0].blocksUsed).toBe(2);
    expect(results[0].bundleCount).toBe(1);
    expect(results[0].averageBlockUtilization).toBeCloseTo(0.6);
    expect(results[0].totalDelayMinutes).toBe(42);
  });

  it("filters plan lookup to VALIDATED/APPROVED status only", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new AnalyticsService({ plan: { findFirst } } as any);
    await service.compareStrategies("scenario-1");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scenarioId: "scenario-1", status: { in: ["VALIDATED", "APPROVED"] } }),
      }),
    );
  });

  it("returns an empty array when no strategy has a plan yet", async () => {
    const prisma = mockPrisma(() => Promise.resolve(null));
    const service = new AnalyticsService(prisma);
    const results = await service.compareStrategies("scenario-1");
    expect(results).toEqual([]);
  });

  it("returns null averageBlockUtilization and 0 conflictCount when there is no simulation run yet", async () => {
    const plan = makePlan("OPTIMIZED", { simulationRuns: [] });
    const prisma = mockPrisma((args: any) => (args.where.strategy === "OPTIMIZED" ? Promise.resolve(plan) : Promise.resolve(null)));
    const service = new AnalyticsService(prisma);
    const results = await service.compareStrategies("scenario-1");
    expect(results).toHaveLength(1);
    expect(results[0].averageBlockUtilization).toBeNull();
    expect(results[0].conflictCount).toBe(0);
    expect(results[0].totalDelayMinutes).toBeNull();
  });
});
