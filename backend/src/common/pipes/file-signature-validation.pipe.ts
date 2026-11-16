import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
} from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (5.242.880 byte)

export function createMulterDiskOptions(
  subfolder: 'medicines' | 'invoices',
): MulterOptions {
  const destinationPath = join(process.cwd(), 'uploads', subfolder);

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        try {
          fs.mkdirSync(destinationPath, { recursive: true });
          cb(null, destinationPath);
        } catch (err) {
          cb(err as Error, destinationPath);
        }
      },
      filename: (_req, file, cb) => {
        const rawExt = extname(file.originalname || '').toLowerCase();
        const safeExt = /^[.][a-z0-9]{1,8}$/.test(rawExt) ? rawExt : '.bin';
        cb(null, `${randomUUID()}${safeExt}`);
      },
    }),
    limits: {
      fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    },
  };
}

@Injectable()
export class FileSignatureValidationPipe
  implements PipeTransform<Express.Multer.File, Express.Multer.File>
{
  constructor(
    private readonly mode: 'IMAGE_ONLY' | 'IMAGE_OR_PDF' = 'IMAGE_ONLY',
  ) {}

  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      const expectedFormats =
        this.mode === 'IMAGE_OR_PDF'
          ? 'JPEG, PNG, WEBP, atau PDF'
          : 'JPEG, PNG, atau WEBP';
      throw new BadRequestException(
        `Pengunggahan berkas gagal diproses. Tidak ada berkas yang diterima pada field unggahan permintaan ini. Silakan pilih berkas berformat ${expectedFormats} dengan ukuran maksimal 5 MB lalu kirim kembali.`,
      );
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      this.cleanupFileIfOnDisk(file);
      throw new PayloadTooLargeException(
        `Pengunggahan berkas ditolak karena ukuran berkas mencapai ${file.size} byte dan melampaui batas maksimum 5 MB (${MAX_UPLOAD_FILE_SIZE_BYTES} byte). Silakan kompres berkas Anda hingga berukuran di bawah 5 MB lalu unggah kembali.`,
      );
    }

    const headerBytes = this.readHeaderBytes(file);
    if (!headerBytes || headerBytes.length < 4) {
      this.cleanupFileIfOnDisk(file);
      throw new BadRequestException(
        `Validasi tanda tangan biner gagal. Berkas yang diunggah hanya berukuran ${file.size} byte sehingga header magic bytes minimal 4 byte tidak dapat dibaca. Silakan unggah berkas utuh yang tidak rusak.`,
      );
    }

    const isJpeg =
      headerBytes[0] === 0xff &&
      headerBytes[1] === 0xd8 &&
      headerBytes[2] === 0xff;

    const isPng =
      headerBytes[0] === 0x89 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x4e &&
      headerBytes[3] === 0x47;

    const isWebp =
      headerBytes.length >= 12 &&
      headerBytes[0] === 0x52 &&
      headerBytes[1] === 0x49 &&
      headerBytes[2] === 0x46 &&
      headerBytes[3] === 0x46 &&
      headerBytes[8] === 0x57 &&
      headerBytes[9] === 0x45 &&
      headerBytes[10] === 0x42 &&
      headerBytes[11] === 0x50;

    const isPdf =
      headerBytes[0] === 0x25 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x44 &&
      headerBytes[3] === 0x46;

    const isValidSignature =
      this.mode === 'IMAGE_OR_PDF'
        ? isJpeg || isPng || isWebp || isPdf
        : isJpeg || isPng || isWebp;

    if (!isValidSignature) {
      const detectedHex = Array.from(headerBytes.subarray(0, 4))
        .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
      this.cleanupFileIfOnDisk(file);

      const allowedDesc =
        this.mode === 'IMAGE_OR_PDF'
          ? 'JPEG (FF D8 FF), PNG (89 50 4E 47), WEBP (52 49 46 46 ... 57 45 42 50), atau PDF (25 50 44 46)'
          : 'JPEG (FF D8 FF), PNG (89 50 4E 47), atau WEBP (52 49 46 46 ... 57 45 42 50)';

      throw new BadRequestException(
        `Validasi isi berkas ditolak. Berkas "${file.originalname}" memiliki magic bytes awal [${detectedHex}] dengan tipe MIME "${file.mimetype}" yang tidak sesuai dengan standar ${allowedDesc}. Silakan unggah berkas asli tanpa mengubah ekstensi berkas secara manual.`,
      );
    }

    return file;
  }

  private readHeaderBytes(file: Express.Multer.File): Buffer | null {
    if (file.buffer && file.buffer.length > 0) {
      return file.buffer.subarray(0, 12);
    }

    if (file.path && fs.existsSync(file.path)) {
      let fd: number | null = null;
      try {
        fd = fs.openSync(file.path, 'r');
        const buffer = Buffer.alloc(12);
        const bytesRead = fs.readSync(fd, buffer, 0, 12, 0);
        return buffer.subarray(0, bytesRead);
      } catch {
        return null;
      } finally {
        if (fd !== null) {
          try {
            fs.closeSync(fd);
          } catch {
            // Ignore close errors
          }
        }
      }
    }

    return null;
  }

  private cleanupFileIfOnDisk(file: Express.Multer.File): void {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // Ignore unlink errors during cleanup
      }
    }
  }
}
