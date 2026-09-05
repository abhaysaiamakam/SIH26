import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FindAssetsQuery } from "./dto/find-assets.query";

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: FindAssetsQuery) {
    const where: Prisma.AssetWhereInput = {};
    if (query.corridorId) where.corridorId = query.corridorId;
    if (query.criticality) where.criticality = query.criticality;

    return this.prisma.asset.findMany({
      where,
      include: { corridor: true, segment: true },
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        corridor: true,
        segment: true,
        maintenanceRequests: { orderBy: { dueDate: "asc" } },
      },
    });
    if (!asset) throw new NotFoundException(`Asset ${id} not found`);
    return asset;
  }
}
