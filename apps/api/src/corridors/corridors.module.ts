import { Module } from "@nestjs/common";
import { CorridorsController } from "./corridors.controller";
import { CorridorsService } from "./corridors.service";

@Module({
  controllers: [CorridorsController],
  providers: [CorridorsService],
})
export class CorridorsModule {}
