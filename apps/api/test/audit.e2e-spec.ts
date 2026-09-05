import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Audit trail (e2e)", () => {
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
    if (!scenario) throw new Error("No planning scenario found - run the seed script before this test");
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

  it("records OPTIMIZATION_STARTED, PLAN_GENERATED, PLAN_VALIDATED, and OPTIMIZATION_COMPLETED for a planning run, with the requesting user as actor", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/planning-runs")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ scenarioId, strategy: "FIRST_FEASIBLE" })
      .expect(202);
    const runId = createRes.body.id;

    let finished: any;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer()).get(`/planning-runs/${runId}`).expect(200);
      if (res.body.status === "SUCCEEDED" || res.body.status === "FAILED") {
        finished = res.body;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(finished.status).toBe("SUCCEEDED");

    const events = await prisma.auditEvent.findMany({ where: { entityId: { in: [runId, finished.resultPlanId] } } });
    const actions = events.map((e) => e.action).sort();
    expect(actions).toEqual(
      ["OPTIMIZATION_STARTED", "PLAN_GENERATED", "PLAN_VALIDATED", "OPTIMIZATION_COMPLETED"].sort(),
    );
    for (const event of events) {
      expect(event.actorUserId).toBeTruthy();
    }
  }, 30_000);

  it("exposes the audit trail via GET /audit-events filtered by scenario", async () => {
    const res = await request(app.getHttpServer()).get(`/audit-events?scenarioId=${scenarioId}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("action");
    expect(res.body[0]).toHaveProperty("createdAt");
  });

  it("records PLAN_APPROVED with before/after status on approval", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/planning-runs")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ scenarioId, strategy: "FIRST_FEASIBLE" })
      .expect(202);
    const runId = createRes.body.id;

    let finished: any;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer()).get(`/planning-runs/${runId}`).expect(200);
      if (res.body.status === "SUCCEEDED" || res.body.status === "FAILED") {
        finished = res.body;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    await request(app.getHttpServer())
      .post(`/plans/${finished.resultPlanId}/approve`)
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ comment: "e2e audit check" })
      .expect(201);

    const event = await prisma.auditEvent.findFirst({
      where: { entityId: finished.resultPlanId, action: "PLAN_APPROVED" },
    });
    expect(event).toBeTruthy();
    expect((event!.after as any).status).toBe("APPROVED");
    expect((event!.metadata as any).comment).toBe("e2e audit check");
  }, 30_000);
});
