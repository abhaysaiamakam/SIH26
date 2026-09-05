import { Module } from "@nestjs/common";
import { ScenariosModule } from "../scenarios/scenarios.module";
import { ValidationModule } from "../validation/validation.module";
import { SimulationModule } from "../simulation/simulation.module";
import { AuditModule } from "../audit/audit.module";
import { PlanningRunsController } from "./planning-runs.controller";
import { PlanningRunsService } from "./planning-runs.service";
import { OptimizerClientService } from "./optimizer-client.service";
import { PlanPersistenceService } from "./plan-persistence.service";

@Module({
  imports: [ScenariosModule, ValidationModule, SimulationModule, AuditModule],
  controllers: [PlanningRunsController],
  providers: [PlanningRunsService, OptimizerClientService, PlanPersistenceService],
  exports: [OptimizerClientService, PlanPersistenceService],
})
export class OptimizationModule {}
