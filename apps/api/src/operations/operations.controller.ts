import { Controller, Get, Query } from "@nestjs/common";
import { OperationsService } from "./operations.service";
import { FindBlockWindowsQuery } from "./dto/find-block-windows.query";
import { FindTrainMovementsQuery } from "./dto/find-train-movements.query";

@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get("block-windows")
  findBlockWindows(@Query() query: FindBlockWindowsQuery) {
    return this.operations.findBlockWindows(query);
  }

  @Get("train-movements")
  findTrainMovements(@Query() query: FindTrainMovementsQuery) {
    return this.operations.findTrainMovements(query);
  }
}
