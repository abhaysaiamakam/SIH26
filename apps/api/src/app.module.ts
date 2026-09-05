import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { ScenariosModule } from "./scenarios/scenarios.module";
import { CorridorsModule } from "./corridors/corridors.module";
import { AssetsModule } from "./assets/assets.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { OperationsModule } from "./operations/operations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ScenariosModule,
    CorridorsModule,
    AssetsModule,
    MaintenanceModule,
    OperationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
