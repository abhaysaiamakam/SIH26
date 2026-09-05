import { Module } from "@nestjs/common";
import { SimulationService } from "./simulation.service";
import { SimulatorClientService } from "./simulator-client.service";

@Module({
  providers: [SimulationService, SimulatorClientService],
  exports: [SimulationService],
})
export class SimulationModule {}
