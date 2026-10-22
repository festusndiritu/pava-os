import { SetMetadata } from '@nestjs/common';
import { Module } from '../../generated/prisma/client.js';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...modules: Module[]) => SetMetadata(PERMISSIONS_KEY, modules);
