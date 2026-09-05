import { Controller, Get, Param, Query } from "@nestjs/common";
import { AssetsService } from "./assets.service";
import { FindAssetsQuery } from "./dto/find-assets.query";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  findAll(@Query() query: FindAssetsQuery) {
    return this.assets.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.assets.findOne(id);
  }
}
