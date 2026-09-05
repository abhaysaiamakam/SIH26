import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { ScenariosModule } from "./scenarios/scenarios.module";
import { CorridorsModule } from "./corridors/corridors.module";
import { AssetsModule } from "./assets/assets.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { OperationsModule } from "./operations/operations.module";
import { OptimizationModule } from "./optimization/optimization.module";
import { ValidationModule } from "./validation/validation.module";
import { SimulationModule } from "./simulation/simulation.module";
import { PlanningModule } from "./planning/planning.module";
import { WhatIfModule } from "./what-if/what-if.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ScenariosModule,
    CorridorsModule,
    AssetsModule,
    MaintenanceModule,
    OperationsModule,
    OptimizationModule,
    ValidationModule,
    SimulationModule,
    PlanningModule,
    WhatIfModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
