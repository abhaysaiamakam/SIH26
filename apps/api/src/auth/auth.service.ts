import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { UsersService } from "../users/users.service";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException("Invalid email or password");

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException("Invalid email or password");

    const roles = user.roles.map((r) => r.role);
    const payload: AuthenticatedUser = { id: user.id, email: user.email, name: user.name, roles };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: payload };
  }
}
