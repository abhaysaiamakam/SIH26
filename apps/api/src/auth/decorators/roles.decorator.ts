import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

export type Role = "FIELD_ENGINEER" | "DEPARTMENT_PLANNER" | "DIVISIONAL_PLANNER" | "CONTROL_OPERATOR" | "MANAGEMENT" | "ADMIN";

/** Marks an endpoint as requiring one of the given roles (ADMIN always passes - see RolesGuard). Combine with @UseGuards(JwtAuthGuard, RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
