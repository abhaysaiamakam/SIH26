import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CorridorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.corridor.findMany({
      include: {
        division: true,
        originStation: true,
        destinationStation: true,
        segments: { orderBy: { sequenceNumber: "asc" } },
      },
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string) {
    const corridor = await this.prisma.corridor.findUnique({
      where: { id },
      include: {
        division: true,
        originStation: true,
        destinationStation: true,
        segments: { orderBy: { sequenceNumber: "asc" } },
        trackResources: true,
      },
    });
    if (!corridor) throw new NotFoundException(`Corridor ${id} not found`);
    return corridor;
  }
}
