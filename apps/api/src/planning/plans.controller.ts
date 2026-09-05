import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { FindPlansQuery } from "./dto/find-plans.query";
import { DecidePlanDto } from "./dto/decide-plan.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.service";

@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  findAll(@Query() query: FindPlansQuery) {
    return this.plans.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.plans.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("DIVISIONAL_PLANNER", "MANAGEMENT")
  @Post(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: DecidePlanDto) {
    return this.plans.approve(id, user.id, dto.comment);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("DIVISIONAL_PLANNER", "MANAGEMENT")
  @Post(":id/reject")
  reject(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: DecidePlanDto) {
    return this.plans.reject(id, user.id, dto.comment);
  }
}
