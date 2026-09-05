import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { WhatIfService } from "./what-if.service";
import { CreateWhatIfDto } from "./dto/create-what-if.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.service";

@Controller("what-if")
export class WhatIfController {
  constructor(private readonly whatIf: WhatIfService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("DIVISIONAL_PLANNER", "CONTROL_OPERATOR", "MANAGEMENT")
  @Post()
  run(@Body() dto: CreateWhatIfDto, @CurrentUser() user: AuthenticatedUser) {
    return this.whatIf.run(dto, user.id);
  }
}
