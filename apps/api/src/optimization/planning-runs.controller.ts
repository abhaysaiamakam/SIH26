import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { PlanningRunsService } from "./planning-runs.service";
import { CreatePlanningRunDto } from "./dto/create-planning-run.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("planning-runs")
export class PlanningRunsController {
  constructor(private readonly planningRuns: PlanningRunsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("DIVISIONAL_PLANNER", "CONTROL_OPERATOR", "MANAGEMENT")
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
