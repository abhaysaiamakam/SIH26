import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { PlanningRunsService } from "./planning-runs.service";
import { CreatePlanningRunDto } from "./dto/create-planning-run.dto";

@Controller("planning-runs")
export class PlanningRunsController {
  constructor(private readonly planningRuns: PlanningRunsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: CreatePlanningRunDto) {
    return this.planningRuns.create(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.planningRuns.findOne(id);
  }
}
