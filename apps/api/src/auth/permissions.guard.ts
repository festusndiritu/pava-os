import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator.js';
import { Module, Role } from '../../generated/prisma/client.js';

// Backend-authoritative module gating.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Module[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (user.role === Role.ADMIN) return true;

    const granted: string[] = user.permissions || [];
    const ok = required.some((m) => granted.includes(m));
    if (!ok) {
      throw new ForbiddenException('You do not have access to this module');
    }
    return true;
  }
}
