import { Controller, Get, Param } from "@nestjs/common";
import { CorridorsService } from "./corridors.service";

@Controller("corridors")
export class CorridorsController {
  constructor(private readonly corridors: CorridorsService) {}

  @Get()
  findAll() {
    return this.corridors.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.corridors.findOne(id);
  }
}
