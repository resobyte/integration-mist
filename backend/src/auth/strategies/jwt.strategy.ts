import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../../common/interfaces/request.interface';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtPayload): Promise<JwtPayload> {
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    const isBlacklisted = await this.authService.isTokenBlacklisted(token);

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
