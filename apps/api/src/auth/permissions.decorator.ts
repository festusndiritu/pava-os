import { SetMetadata } from '@nestjs/common';
import { Module } from '../../generated/prisma/client.js';

export const PERMISSIONS_KEY = 'permissions';

// Route/controller is accessible if the user has ANY of the listed modules.
// ADMIN always passes (see PermissionsGuard) — this decorator is for STAFF
// gating, e.g. @Permissions(Module.POS).
export const Permissions = (...modules: Module[]) => SetMetadata(PERMISSIONS_KEY, modules);
