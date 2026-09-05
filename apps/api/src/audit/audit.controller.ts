import { Controller, Get, Query } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { FindAuditEventsQuery } from "./dto/find-audit-events.query";

@Controller("audit-events")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  findAll(@Query() query: FindAuditEventsQuery) {
    return this.audit.findAll(query);
  }
}
