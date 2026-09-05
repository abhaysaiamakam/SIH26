import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { FindMaintenanceQuery } from "./dto/find-maintenance.query";

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

  @Post()
  create(@Body() dto: CreateMaintenanceRequestDto) {
    return this.maintenance.create(dto);
  }
}
