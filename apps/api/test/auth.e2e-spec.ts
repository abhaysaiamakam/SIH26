import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Auth (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("logs in a seeded demo user and returns a bearer token with roles", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@railopt.demo", password: "railopt-demo-2026" })
      .expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.roles).toContain("ADMIN");
  });

  it("rejects a wrong password", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@railopt.demo", password: "wrong-password" })
      .expect(401);
  });

  it("rejects an unknown email", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "nobody@railopt.demo", password: "railopt-demo-2026" })
      .expect(401);
  });
});
