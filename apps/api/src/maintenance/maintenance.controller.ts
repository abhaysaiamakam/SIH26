import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { FindMaintenanceQuery } from "./dto/find-maintenance.query";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("maintenance")
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  findAll(@Query() query: FindMaintenanceQuery) {
    return this.maintenance.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.maintenance.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("FIELD_ENGINEER", "DEPARTMENT_PLANNER", "DIVISIONAL_PLANNER")
  @Post()
  create(@Body() dto: CreateMaintenanceRequestDto) {
    return this.maintenance.create(dto);
  }
}
