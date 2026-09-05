import { generateScenario } from "../generator/index";

describe("synthetic scenario generator", () => {
  it("is deterministic for the same seed", () => {
    const a = generateScenario(42);
    const b = generateScenario(42);
    expect(a).toEqual(b);
  });

  it("produces a different scenario for a different seed", () => {
    const a = generateScenario(42);
    const b = generateScenario(7);
    expect(a.maintenanceRequests).not.toEqual(b.maintenanceRequests);
    expect(a.assets).not.toEqual(b.assets);
  });

  it("meets the minimum scale targets from the project spec", () => {
    const s = generateScenario(42);
    expect(s.divisions.length).toBe(2);
    expect(s.corridors.length).toBe(6);
    expect(s.stations.length).toBeGreaterThanOrEqual(20);
    expect(s.assets.length).toBeGreaterThanOrEqual(30);
    expect(s.maintenanceRequests.length).toBeGreaterThanOrEqual(30);
    expect(s.blockWindows.length).toBeGreaterThanOrEqual(15);
    expect(s.trainMovements.length).toBeGreaterThanOrEqual(30);
    expect(s.scenarioEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("includes corridor C-03 (referenced by the What-If demo script)", () => {
    const s = generateScenario(42);
    expect(s.corridors.some((c) => c.code === "C-03")).toBe(true);
  });

  it("guarantees at least one overdue critical maintenance request", () => {
    const s = generateScenario(42);
    const now = new Date("2026-09-05T00:00:00.000Z").getTime();
    const overdueCritical = s.maintenanceRequests.filter(
      (r) => r.tags.includes("overdue_critical") && r.criticality === "CRITICAL" && new Date(r.dueDate).getTime() < now,
    );
    expect(overdueCritical.length).toBeGreaterThanOrEqual(1);
  });

  it("guarantees at least one dependency chain (predecessor before successor)", () => {
    const s = generateScenario(42);
    expect(s.requestDependencies.length).toBeGreaterThanOrEqual(1);
    for (const dep of s.requestDependencies) {
      const predecessor = s.maintenanceRequests.find((r) => r.id === dep.predecessorId)!;
      const successor = s.maintenanceRequests.find((r) => r.id === dep.successorId)!;
      expect(new Date(predecessor.dueDate).getTime()).toBeLessThan(new Date(successor.dueDate).getTime());
    }
  });

  it("guarantees at least one cross-department bundling opportunity", () => {
    const s = generateScenario(42);
    const bundleRequests = s.maintenanceRequests.filter((r) => r.tags.includes("bundle_opportunity"));
    expect(bundleRequests.length).toBeGreaterThanOrEqual(2);
    const departments = new Set(bundleRequests.map((r) => r.department));
    expect(departments.size).toBeGreaterThanOrEqual(2);
  });

  it("guarantees at least one incompatible work-type pair on the same corridor", () => {
    const s = generateScenario(42);
    const incompatible = s.maintenanceRequests.filter((r) => r.tags.includes("incompatible_pair"));
    expect(incompatible.length).toBeGreaterThanOrEqual(2);
  });

  it("guarantees at least one cross-corridor scarce-resource conflict", () => {
    const s = generateScenario(42);
    const conflicted = s.maintenanceRequests.filter((r) => r.tags.includes("resource_conflict"));
    expect(conflicted.length).toBeGreaterThanOrEqual(2);
    const corridorIds = new Set(conflicted.map((r) => r.corridorId));
    expect(corridorIds.size).toBeGreaterThanOrEqual(2);
  });

  it("includes explicit compatibility rules that override the heuristic defaults", () => {
    const s = generateScenario(42);
    expect(s.taskCompatibilityRules.length).toBeGreaterThanOrEqual(2);
  });

  it("produces only UUID-shaped identifiers", () => {
    const s = generateScenario(42);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const asset of s.assets) {
      expect(asset.id).toMatch(uuidRe);
    }
    for (const request of s.maintenanceRequests) {
      expect(request.id).toMatch(uuidRe);
    }
  });
});
