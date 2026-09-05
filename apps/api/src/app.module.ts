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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ScenariosModule,
    CorridorsModule,
    AssetsModule,
    MaintenanceModule,
    OperationsModule,
    OptimizationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
