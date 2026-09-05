import { AppController } from "./app.controller";

describe("AppController", () => {
  it("reports service health", () => {
    const controller = new AppController();
    expect(controller.health()).toEqual({ status: "ok", service: "railopt-api" });
  });
});
