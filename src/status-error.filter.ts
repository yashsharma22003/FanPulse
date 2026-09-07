import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class StatusErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res
        .status(exception.getStatus())
        .json(typeof body === 'string' ? { statusCode: exception.getStatus(), message: body } : body);
      return;
    }
    const err = exception as Error & { status?: number; shortMessage?: string };
    const status = err.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      err.message ||
      err.shortMessage ||
      'Internal server error';
    res.status(status >= 400 && status < 600 ? status : HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: status >= 400 && status < 600 ? status : HttpStatus.INTERNAL_SERVER_ERROR,
      message,
    });
  }
}
