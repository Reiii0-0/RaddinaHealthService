import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.originalUrl || request.url || '/';
    const timestamp = new Date().toISOString();

    if (this.isMulterError(exception)) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          errorCode: 'PAYLOAD_TOO_LARGE',
          message:
            'Pengunggahan berkas ditolak. Ukuran berkas yang dikirim melebihi batas maksimum 5 MB (5.242.880 byte). Silakan kompres gambar atau dokumen PDF Anda hingga berukuran di bawah 5 MB lalu unggah kembali.',
          timestamp,
          path,
        });
        return;
      }

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'FILE_UPLOAD_ERROR',
        message: `Pengunggahan berkas gagal diproses karena kendala format multipart (${exception.code}: ${exception.message}). Silakan periksa kembali field berkas pada formulir dan coba lagi.`,
        timestamp,
        path,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const rawResponse = exception.getResponse();

      let message = exception.message;
      let errorCode = this.mapStatusToErrorCode(status);

      let details: unknown = undefined;

      if (typeof rawResponse === 'string') {
        message = rawResponse;
      } else if (typeof rawResponse === 'object' && rawResponse !== null) {
        const resObj = rawResponse as Record<string, unknown>;
        if (Array.isArray(resObj.message)) {
          message = resObj.message.join(' ');
        } else if (typeof resObj.message === 'string') {
          message = resObj.message;
        }
        if (typeof resObj.errorCode === 'string') {
          errorCode = resObj.errorCode;
        } else if (typeof resObj.code === 'string') {
          errorCode = resObj.code;
        }
        if (resObj.details !== undefined) {
          details = resObj.details;
        }
      }

      response.status(status).json({
        statusCode: status,
        errorCode,
        message,
        ...(details !== undefined ? { details } : {}),
        timestamp,
        path,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message:
        'Permintaan gagal diproses akibat kendala internal pada server apotek (kode status 500). Data transaksi Anda tetap aman dan tidak berubah sebagian. Silakan ulangi beberapa saat lagi atau hubungi administrator teknis Raddina Health Service.',
      timestamp,
      path,
    });
  }

  private isMulterError(err: unknown): err is MulterError {
    if (err instanceof MulterError) {
      return true;
    }
    if (typeof err === 'object' && err !== null) {
      const candidate = err as { name?: string; code?: string };
      return (
        candidate.name === 'MulterError' ||
        candidate.code === 'LIMIT_FILE_SIZE'
      );
    }
    return false;
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'PAYLOAD_TOO_LARGE';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return `HTTP_${status}`;
    }
  }
}
