import { ValidatorService } from "./validator.service";

const NOW = new Date("2026-09-10T01:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function baseRequest(overrides: Partial<any> = {}) {
  return {
    id: "req-1",
    requestNumber: "ENG-C-01-001",
    department: "ENGINEERING",
    workType: "GENERAL_INSPECTION",
    requiredIsolation: "NONE",
    requiredPower: "NONE",
    estimatedDurationMinutes: 60,
    requiredResources: [],
    ...overrides,
  };
}

function baseWindow(overrides: Partial<any> = {}) {
  return {
    id: "win-1",
    startTime: NOW,
    endTime: new Date(NOW.getTime() + 4 * HOUR),
    permittedDepartments: ["ENGINEERING", "TRD", "S_AND_T"],
    allowsIsolationTypes: ["TRACK_ISOLATION"],
    allowsPowerTypes: ["NONE"],
    ...overrides,
  };
}

function baseBlock(overrides: Partial<any> = {}) {
  return {
    id: "block-1",
    corridorId: "c1",
    startTime: NOW,
    endTime: new Date(NOW.getTime() + HOUR),
    blockWindow: baseWindow(),
    ...overrides,
  };
}

function mockPrisma(config: {
  revision: any;
  trainMovements?: any[];
  compatibilityRules?: any[];
  dependencies?: any[];
  trackResources?: any[];
}) {
  return {
    planRevision: { findUnique: jest.fn().mockResolvedValue(config.revision) },
    trainMovement: { findMany: jest.fn().mockResolvedValue(config.trainMovements ?? []) },
    taskCompatibilityRule: { findMany: jest.fn().mockResolvedValue(config.compatibilityRules ?? []) },
    requestDependency: { findMany: jest.fn().mockResolvedValue(config.dependencies ?? []) },
    trackResource: { findMany: jest.fn().mockResolvedValue(config.trackResources ?? []) },
    validationRun: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

function makeRevision(blocks: any[], tasks: any[]) {
  return {
    id: "rev-1",
    plan: { scenarioId: "scenario-1" },
    blocks,
    tasks,
  };
}

describe("ValidatorService", () => {
  it("reports VALID for a well-formed single-task plan", async () => {
    const request = baseRequest();
    const block = baseBlock();
    const task = { maintenanceRequestId: request.id, planBlockId: block.id, scheduled: true, maintenanceRequest: request };
    const prisma = mockPrisma({ revision: makeRevision([block], [task]) });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.status).toBe("VALID");
    expect(result.violations).toEqual([]);
  });

  it("flags BLOCK_OUTSIDE_WINDOW when the block starts before its window", async () => {
    const request = baseRequest();
    const window = baseWindow({ startTime: new Date(NOW.getTime() + HOUR) }); // window starts after block
    const block = baseBlock({ blockWindow: window });
    const task = { maintenanceRequestId: request.id, planBlockId: block.id, scheduled: true, maintenanceRequest: request };
    const prisma = mockPrisma({ revision: makeRevision([block], [task]) });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.status).toBe("INVALID");
    expect(result.violations.some((v) => v.code === "BLOCK_OUTSIDE_WINDOW")).toBe(true);
  });

  it("flags ISOLATION_VIOLATION when the task's isolation isn't permitted by the window", async () => {
    const request = baseRequest({ requiredIsolation: "POWER_ISOLATION" });
    const block = baseBlock({ blockWindow: baseWindow({ allowsIsolationTypes: ["TRACK_ISOLATION"] }) });
    const task = { maintenanceRequestId: request.id, planBlockId: block.id, scheduled: true, maintenanceRequest: request };
    const prisma = mockPrisma({ revision: makeRevision([block], [task]) });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "ISOLATION_VIOLATION")).toBe(true);
  });

  it("flags DURATION_INSUFFICIENT when the block is shorter than the task needs", async () => {
    const request = baseRequest({ estimatedDurationMinutes: 300 });
    const block = baseBlock({ endTime: new Date(NOW.getTime() + HOUR) }); // only 60 min
    const task = { maintenanceRequestId: request.id, planBlockId: block.id, scheduled: true, maintenanceRequest: request };
    const prisma = mockPrisma({ revision: makeRevision([block], [task]) });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "DURATION_INSUFFICIENT")).toBe(true);
  });

  it("flags INCOMPATIBLE_BUNDLE for a hard-incompatible work-type pair sharing a block", async () => {
    const reqA = baseRequest({ id: "a", workType: "BRIDGE_INSPECTION" });
    const reqB = baseRequest({ id: "b", workType: "BALLAST_CLEANING" });
    const block = baseBlock();
    const tasks = [
      { maintenanceRequestId: "a", planBlockId: block.id, scheduled: true, maintenanceRequest: reqA },
      { maintenanceRequestId: "b", planBlockId: block.id, scheduled: true, maintenanceRequest: reqB },
    ];
    const prisma = mockPrisma({ revision: makeRevision([block], tasks) });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "INCOMPATIBLE_BUNDLE")).toBe(true);
  });

  it("flags RESOURCE_OVERLAP when two overlapping blocks over-demand the same resource", async () => {
    const reqA = baseRequest({ id: "a", requiredResources: [{ trackResourceId: "r1", quantity: 1 }] });
    const reqB = baseRequest({ id: "b", requiredResources: [{ trackResourceId: "r1", quantity: 1 }] });
    const blockA = baseBlock({ id: "block-a" });
    const blockB = baseBlock({ id: "block-b" }); // same time window - overlaps blockA
    const tasks = [
      { maintenanceRequestId: "a", planBlockId: "block-a", scheduled: true, maintenanceRequest: reqA },
      { maintenanceRequestId: "b", planBlockId: "block-b", scheduled: true, maintenanceRequest: reqB },
    ];
    const prisma = mockPrisma({
      revision: makeRevision([blockA, blockB], tasks),
      trackResources: [{ id: "r1", capacity: 1 }],
    });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "RESOURCE_OVERLAP")).toBe(true);
  });

  it("does not flag RESOURCE_OVERLAP when combined demand is within capacity", async () => {
    const reqA = baseRequest({ id: "a", requiredResources: [{ trackResourceId: "r1", quantity: 1 }] });
    const reqB = baseRequest({ id: "b", requiredResources: [{ trackResourceId: "r1", quantity: 1 }] });
    const blockA = baseBlock({ id: "block-a" });
    const blockB = baseBlock({ id: "block-b" });
    const tasks = [
      { maintenanceRequestId: "a", planBlockId: "block-a", scheduled: true, maintenanceRequest: reqA },
      { maintenanceRequestId: "b", planBlockId: "block-b", scheduled: true, maintenanceRequest: reqB },
    ];
    const prisma = mockPrisma({
      revision: makeRevision([blockA, blockB], tasks),
      trackResources: [{ id: "r1", capacity: 2 }],
    });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "RESOURCE_OVERLAP")).toBe(false);
  });

  it("flags DEPENDENCY_VIOLATION when the predecessor's block ends after the successor's starts", async () => {
    const predReq = baseRequest({ id: "pred" });
    const succReq = baseRequest({ id: "succ" });
    const predBlock = baseBlock({ id: "pred-block", startTime: NOW, endTime: new Date(NOW.getTime() + 2 * HOUR) });
    const succBlock = baseBlock({ id: "succ-block", startTime: new Date(NOW.getTime() + HOUR), endTime: new Date(NOW.getTime() + 3 * HOUR) });
    const tasks = [
      { maintenanceRequestId: "pred", planBlockId: "pred-block", scheduled: true, maintenanceRequest: predReq },
      { maintenanceRequestId: "succ", planBlockId: "succ-block", scheduled: true, maintenanceRequest: succReq },
    ];
    const prisma = mockPrisma({
      revision: makeRevision([predBlock, succBlock], tasks),
      dependencies: [{ predecessorId: "pred", successorId: "succ" }],
    });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "DEPENDENCY_VIOLATION")).toBe(true);
  });

  it("flags DEPENDENCY_VIOLATION when the successor is scheduled but the predecessor is not", async () => {
    const succReq = baseRequest({ id: "succ" });
    const succBlock = baseBlock({ id: "succ-block" });
    const tasks = [{ maintenanceRequestId: "succ", planBlockId: "succ-block", scheduled: true, maintenanceRequest: succReq }];
    const prisma = mockPrisma({
      revision: makeRevision([succBlock], tasks),
      dependencies: [{ predecessorId: "pred", successorId: "succ" }],
    });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "DEPENDENCY_VIOLATION")).toBe(true);
  });

  it("flags OPERATIONAL_CONFLICT when a hard-conflict train overlaps the block", async () => {
    const request = baseRequest();
    const block = baseBlock();
    const task = { maintenanceRequestId: request.id, planBlockId: block.id, scheduled: true, maintenanceRequest: request };
    const prisma = mockPrisma({
      revision: makeRevision([block], [task]),
      trainMovements: [
        {
          corridorId: "c1",
          trainType: "EXPRESS",
          trainNumber: "101",
          scheduledStart: NOW,
          scheduledEnd: new Date(NOW.getTime() + HOUR),
        },
      ],
    });

    const result = await new ValidatorService(prisma).validateRevision("rev-1");
    expect(result.violations.some((v) => v.code === "OPERATIONAL_CONFLICT")).toBe(true);
  });
});
