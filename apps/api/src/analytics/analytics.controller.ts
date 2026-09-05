import { Controller, Get, Query } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { AnalyticsService } from "./analytics.service";

class AnalyticsQuery {
  @IsUUID()
  scenarioId!: string;
}

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  async compare(@Query() query: AnalyticsQuery) {
    const strategies = await this.analytics.compareStrategies(query.scenarioId);
    return {
      scenarioId: query.scenarioId,
      label: "SYNTHETIC SCENARIO RESULT",
      strategies,
    };
  }
}
