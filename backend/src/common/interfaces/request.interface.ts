import { Request } from 'express';
import { Role } from './role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
