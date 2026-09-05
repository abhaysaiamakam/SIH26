import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, Role } from "../decorators/roles.decorator";
import { AuthenticatedUser } from "../auth.service";

/** Server-side RBAC enforcement: requires the authenticated user (attached
 * by JwtAuthGuard) to hold at least one of the roles declared via @Roles().
 * ADMIN always passes, matching the brief's role list where ADMIN is the
 * superuser role. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException("Authentication required");

    if (user.roles.includes("ADMIN")) return true;
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(", ")}`);
    }
    return true;
  }
}
