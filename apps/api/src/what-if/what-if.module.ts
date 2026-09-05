import { Module } from "@nestjs/common";
import { ScenariosModule } from "../scenarios/scenarios.module";
import { OptimizationModule } from "../optimization/optimization.module";
import { ValidationModule } from "../validation/validation.module";
import { SimulationModule } from "../simulation/simulation.module";
import { WhatIfController } from "./what-if.controller";
import { WhatIfService } from "./what-if.service";

@Module({
  imports: [ScenariosModule, OptimizationModule, ValidationModule, SimulationModule],
  controllers: [WhatIfController],
  providers: [WhatIfService],
})
export class WhatIfModule {}
