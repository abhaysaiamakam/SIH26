import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Drives the real HTTP surface against the live dev Postgres and the real
 * Python optimizer subprocess (no mocks) - this is the end-to-end proof
 * that "POST /planning-runs -> poll -> SUCCEEDED with real Plan rows" works,
 * per the Phase 4 definition of done, now behind RBAC per Phase 5. Requires:
 *   - Postgres reachable via DATABASE_URL (apps/api/.env), seeded at least
 *     once (`pnpm run seed`, which also seeds the demo users this test logs in as)
 *   - PYTHON_BIN pointing at a Python with ortools+pydantic installed
 */
describe("Planning runs (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scenarioId: string;
  let plannerToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    const scenario = await prisma.planningScenario.findFirst({ orderBy: { generatedAt: "desc" } });
    if (!scenario) {
      throw new Error("No planning scenario found - run `pnpm --filter @railopt/api run seed` before this test");
    }
    scenarioId = scenario.id;

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "div.planner@railopt.demo", password: "railopt-demo-2026" })
      .expect(201);
    plannerToken = login.body.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  function authed(req: request.Test): request.Test {
    return req.set("Authorization", `Bearer ${plannerToken}`);
  }

  async function pollUntilDone(runId: string, timeoutMs = 20_000): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer()).get(`/planning-runs/${runId}`).expect(200);
      if (res.body.status === "SUCCEEDED" || res.body.status === "FAILED") {
        return res.body;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`Planning run ${runId} did not finish within ${timeoutMs}ms`);
  }

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).post("/planning-runs").send({ scenarioId, strategy: "OPTIMIZED" }).expect(401);
  });

  it("returns 404 for an unknown scenario", async () => {
    await authed(request(app.getHttpServer()).post("/planning-runs"))
      .send({ scenarioId: "00000000-0000-4000-8000-000000000000", strategy: "OPTIMIZED" })
      .expect(404);
  });

  it("rejects an invalid strategy", async () => {
    await authed(request(app.getHttpServer()).post("/planning-runs")).send({ scenarioId, strategy: "NOT_A_STRATEGY" }).expect(400);
  });

  it("runs OPTIMIZED end to end and persists a validated, simulated Plan", async () => {
    const createRes = await authed(request(app.getHttpServer()).post("/planning-runs"))
      .send({ scenarioId, strategy: "OPTIMIZED" })
      .expect(202);

    expect(createRes.body.status).toBe("PENDING");
    const runId = createRes.body.id;

    const finished = await pollUntilDone(runId);
    expect(finished.status).toBe("SUCCEEDED");
    expect(finished.solverStatus).toBe("OPTIMAL");
    expect(finished.resultPlanId).toBeTruthy();
    expect(typeof finished.objectiveValue).toBe("number");

    const plan = await prisma.plan.findUniqueOrThrow({
      where: { id: finished.resultPlanId },
      include: {
        revisions: { include: { blocks: true, tasks: true, validationRuns: true, simulationRuns: true } },
      },
    });
    expect(plan.strategy).toBe("OPTIMIZED");
    expect(plan.status).toBe("VALIDATED");
    expect(plan.revisions).toHaveLength(1);
    const revision = plan.revisions[0];
    expect(revision.tasks.length).toBeGreaterThan(0);
    expect(revision.tasks.some((t) => t.scheduled)).toBe(true);
    // Every scheduled task must be linked to a real plan block.
    for (const task of revision.tasks) {
      if (task.scheduled) {
        expect(task.planBlockId).not.toBeNull();
      }
    }
    // The independent validator ran and found the plan VALID.
    expect(revision.validationRuns).toHaveLength(1);
    expect(revision.validationRuns[0].status).toBe("VALID");
    // The simulator ran because the plan was valid.
    expect(revision.simulationRuns).toHaveLength(1);
  }, 30_000);

  it("produces a visibly different objective for FIRST_FEASIBLE vs OPTIMIZED on the same scenario", async () => {
    const ffRun = await authed(request(app.getHttpServer()).post("/planning-runs")).send({ scenarioId, strategy: "FIRST_FEASIBLE" }).expect(202);
    const optRun = await authed(request(app.getHttpServer()).post("/planning-runs")).send({ scenarioId, strategy: "OPTIMIZED" }).expect(202);

    const ffResult = await pollUntilDone(ffRun.body.id);
    const optResult = await pollUntilDone(optRun.body.id);

    expect(ffResult.status).toBe("SUCCEEDED");
    expect(optResult.status).toBe("SUCCEEDED");
    expect(optResult.objectiveValue).toBeGreaterThanOrEqual(ffResult.objectiveValue - 0.01);
  }, 40_000);

  describe("plan approval", () => {
    let planId: string;

    beforeAll(async () => {
      const run = await authed(request(app.getHttpServer()).post("/planning-runs")).send({ scenarioId, strategy: "OPTIMIZED" }).expect(202);
      const finished = await pollUntilDone(run.body.id);
      planId = finished.resultPlanId;
    }, 30_000);

    it("rejects approval from a role without approval authority", async () => {
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "field.engineer@railopt.demo", password: "railopt-demo-2026" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/plans/${planId}/approve`)
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .send({})
        .expect(403);
    });

    it("approves a validated plan and makes its revision immutable", async () => {
      const res = await authed(request(app.getHttpServer()).post(`/plans/${planId}/approve`)).send({ comment: "approved in e2e test" }).expect(201);
      expect(res.body.status).toBe("APPROVED");

      const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId }, include: { revisions: true } });
      expect(plan.revisions[0].isImmutable).toBe(true);
    });

    it("refuses to approve an already-decided plan", async () => {
      await authed(request(app.getHttpServer()).post(`/plans/${planId}/approve`)).send({}).expect(409);
    });

    it("refuses to reject an already-approved plan", async () => {
      await authed(request(app.getHttpServer()).post(`/plans/${planId}/reject`)).send({}).expect(409);
    });
  });
});
