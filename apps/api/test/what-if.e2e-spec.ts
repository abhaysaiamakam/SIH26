import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("What-if (e2e)", () => {
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

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer())
      .post("/what-if")
      .send({ scenarioId, eventType: "CORRIDOR_UNAVAILABLE", payload: {} })
      .expect(401);
  });

  it("computes a BEFORE/AFTER/DELTA comparison when corridor C-03 becomes unavailable", async () => {
    const corridor = await prisma.corridor.findFirstOrThrow({ where: { code: "C-03" } });

    const res = await request(app.getHttpServer())
      .post("/what-if")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({
        scenarioId,
        eventType: "CORRIDOR_UNAVAILABLE",
        strategy: "OPTIMIZED",
        payload: { corridorId: corridor.id },
      })
      .expect(201);

    expect(res.body.before.status).toBe("VALIDATED");
    expect(res.body.after.status).toBe("VALIDATED");
    // Making a corridor unavailable can only reduce (or leave equal) what
    // gets scheduled on the network as a whole - it never increases blocks used.
    expect(res.body.after.blocksUsed).toBeLessThanOrEqual(res.body.before.blocksUsed);
    expect(res.body.delta.blocksUsed).toBeLessThanOrEqual(0);

    const event = await prisma.scenarioEvent.findUniqueOrThrow({ where: { id: res.body.scenarioEventId } });
    expect(event.source).toBe("WHAT_IF");
    expect(event.eventType).toBe("CORRIDOR_UNAVAILABLE");
    expect(event.appliedAt).not.toBeNull();
  }, 30_000);

  it("adding a new critical request persists it and reflects it in the after-plan candidate pool", async () => {
    const asset = await prisma.asset.findFirstOrThrow({});
    const before = await prisma.maintenanceRequest.count({ where: { scenarioId } });

    const res = await request(app.getHttpServer())
      .post("/what-if")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({
        scenarioId,
        eventType: "NEW_CRITICAL_REQUEST",
        strategy: "FIRST_FEASIBLE",
        payload: {
          assetId: asset.id,
          corridorId: asset.corridorId,
          department: "ENGINEERING",
          workType: "GENERAL_INSPECTION",
          estimatedDurationMinutes: 60,
          dueInDays: 2,
        },
      })
      .expect(201);

    expect(res.body.after.totalCount).toBe(res.body.before.totalCount + 1);
    const after = await prisma.maintenanceRequest.count({ where: { scenarioId } });
    expect(after).toBe(before + 1);
  }, 30_000);
});
