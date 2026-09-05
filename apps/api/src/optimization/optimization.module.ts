import { Module } from "@nestjs/common";
import { ScenariosModule } from "../scenarios/scenarios.module";
import { PlanningRunsController } from "./planning-runs.controller";
import { PlanningRunsService } from "./planning-runs.service";
import { OptimizerClientService } from "./optimizer-client.service";

@Module({
  imports: [ScenariosModule],
  controllers: [PlanningRunsController],
  providers: [PlanningRunsService, OptimizerClientService],
  exports: [OptimizerClientService],
})
export class OptimizationModule {}
