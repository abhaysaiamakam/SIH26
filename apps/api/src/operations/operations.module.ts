import { Module } from "@nestjs/common";
import { ScenariosModule } from "../scenarios/scenarios.module";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";

@Module({
  imports: [ScenariosModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
