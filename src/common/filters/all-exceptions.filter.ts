import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const errorResponse: ApiErrorResponse = {
      statusCode,
      message:
        exception instanceof HttpException
          ? extractHttpExceptionMessage(exception)
          : 'Internal server error',
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(errorResponse);
  }
}

function extractHttpExceptionMessage(
  exception: HttpException,
): string | string[] {
  const exceptionResponse = exception.getResponse();

  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  const { message } = exceptionResponse as { message?: string | string[] };
  return message ?? exception.message;
}
