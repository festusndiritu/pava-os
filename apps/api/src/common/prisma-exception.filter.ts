import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Turns the handful of Prisma errors a user can actually cause into the
 * status codes they deserve, instead of a bare 500 "Internal server error":
 *
 *  - P2002 unique constraint  → 409 (a duplicate name, SKU, prefix, ...)
 *  - P2003 foreign key        → 409 (still referenced by other records)
 *  - P2025 record not found   → 404
 *
 * Services should still check the obvious cases themselves and raise a
 * specific message ("A brand named X already exists"); this is the safety net
 * for the ones they don't, and for races between two requests.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong on our side. Please try again.';
    let error = 'Internal Server Error';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'That already exists — check for a duplicate.';
        error = 'Conflict';
        break;
      case 'P2003':
        status = HttpStatus.CONFLICT;
        message = 'This is still in use by other records, so it can’t be removed or changed that way.';
        error = 'Conflict';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'That record no longer exists.';
        error = 'Not Found';
        break;
    }

    res.status(status).json({ statusCode: status, message, error });
  }
}
