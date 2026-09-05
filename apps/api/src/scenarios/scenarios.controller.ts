import { Controller, Get, Param } from "@nestjs/common";
import { ScenariosService } from "./scenarios.service";

@Controller("scenarios")
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  findAll() {
    return this.scenarios.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.scenarios.findOne(id);
  }
}
