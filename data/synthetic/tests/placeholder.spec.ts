import { placeholder } from "../generator/index";

describe("synthetic data generator scaffold", () => {
  it("is wired up for Phase 2", () => {
    expect(placeholder()).toContain("Phase 2");
  });
});
