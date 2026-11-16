import React, { useId, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import { formatNumberId } from '@/lib/formatters';

export interface FileDropzoneProps {
  label: string;
  helperText?: string;
  acceptMimeTypes?: string[];
  maxSizeBytes?: number;
  currentFileUrl?: string | null;
  isUploading?: boolean;
  onUploadFile: (file: File) => Promise<void> | void;
  submitButtonLabel?: string;
  className?: string;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${formatNumberId(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}

export function FileDropzone({
  label,
  helperText = 'Format yang didukung: JPG, PNG, WebP (maksimal 5 MB).',
  acceptMimeTypes = ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeBytes = DEFAULT_MAX_BYTES,
  currentFileUrl,
  isUploading = false,
  onUploadFile,
  submitButtonLabel = 'Unggah Berkas ke Server',
  className = '',
}: FileDropzoneProps) {
  const inputId = useId();
  const bypassId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bypassClientCheck, setBypassClientCheck] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const validateClientSide = (file: File, bypass: boolean): string | null => {
    if (bypass) {
      return null;
    }

    if (file.size > maxSizeBytes) {
      const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      return `Ukuran berkas "${file.name}" mencapai ${formatFileSize(file.size)}, melebihi batas maksimal ${maxMb} MB. Kompres berkas terlebih dahulu, atau centang opsi "Lewati validasi klien" di bawah untuk menguji penolakan HTTP 413 dari server.`;
    }

    if (acceptMimeTypes.length > 0 && !acceptMimeTypes.includes(file.type)) {
      const allowedList = acceptMimeTypes
        .map((m) => m.replace('image/', '').replace('application/', '').toUpperCase())
        .join(', ');
      return `Tipe berkas "${file.type || 'tidak dikenal'}" tidak diizinkan oleh validasi klien. Pilih berkas berformat ${allowedList}, atau centang "Lewati validasi klien" untuk menguji penolakan HTTP 400 dari server.`;
    }

    return null;
  };

  const handleSelectFile = (file: File | null) => {
    setServerSuccess(null);
    if (!file) {
      setSelectedFile(null);
      setValidationError(null);
      return;
    }
    const err = validateClientSide(file, bypassClientCheck);
    setValidationError(err);
    setSelectedFile(file);
  };

  const handleToggleBypass = (checked: boolean) => {
    setBypassClientCheck(checked);
    if (selectedFile) {
      setValidationError(validateClientSide(selectedFile, checked));
    }
  };

  const handleSubmitUpload = async () => {
    if (!selectedFile) {
      return;
    }
    const clientErr = validateClientSide(selectedFile, bypassClientCheck);
    if (clientErr) {
      setValidationError(clientErr);
      return;
    }

    setValidationError(null);
    setServerSuccess(null);
    try {
      await onUploadFile(selectedFile);
      setServerSuccess(`Berkas "${selectedFile.name}" berhasil diverifikasi dan disimpan di server.`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unggahan ditolak oleh server. Periksa format serta ukuran berkas lalu ulangi.';
      setValidationError(message);
    }
  };

  const handleSimulateInvalidMagicBytes400 = () => {
    setBypassClientCheck(true);
    setValidationError(null);
    setServerSuccess(null);
    const fakePayload = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x54, 0x45, 0x53, 0x54]); // MZ header (.exe)
    const syntheticFile = new File([fakePayload], 'payload-berbahaya-palsu.exe', {
      type: 'application/x-msdownload',
    });
    setSelectedFile(syntheticFile);
  };

  const handleSimulateOversized413 = () => {
    setBypassClientCheck(true);
    setValidationError(null);
    setServerSuccess(null);
    const sixMegabytes = new Uint8Array(6 * 1024 * 1024);
    // Isi header JPEG agar fokus menguji batas ukuran 5 MB Multer (HTTP 413)
    sixMegabytes[0] = 0xff;
    sixMegabytes[1] = 0xd8;
    sixMegabytes[2] = 0xff;
    const syntheticFile = new File([sixMegabytes], 'faktur-resolusi-mentah-6mb.jpg', {
      type: 'image/jpeg',
    });
    setSelectedFile(syntheticFile);
  };

  const includesPdf = acceptMimeTypes.includes('application/pdf');

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-semibold text-[#0F172A]">
          {label}
        </label>
        {currentFileUrl && (
          <a
            href={currentFileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0F766E] underline hover:text-[#115E59]"
          >
            {includesPdf ? (
              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            )}
            <span>Lihat Berkas Tersimpan</span>
          </a>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const droppedFile = e.dataTransfer.files?.[0] ?? null;
          handleSelectFile(droppedFile);
        }}
        className={`rounded-xl border border-dashed p-4 transition-colors ${
          isDragging
            ? 'border-[#0F766E] bg-[#ECFDF5]'
            : 'border-[#DCE3E0] bg-[#F4F6F5] hover:border-[#94A3B8]'
        }`}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={bypassClientCheck ? undefined : acceptMimeTypes.join(',')}
          onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />

        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE3E0] bg-[#FFFFFF] text-[#0F766E]">
            <Upload className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[#0F172A]">
              Tarik dan lepaskan berkas ke area ini, atau{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-semibold text-[#0F766E] underline hover:text-[#115E59]"
              >
                pilih berkas dari perangkat
              </button>
            </p>
            <p className="text-[11px] text-[#475569]">{helperText}</p>
          </div>
        </div>

        {selectedFile && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#DCE3E0] bg-[#FFFFFF] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#0F172A]" title={selectedFile.name}>
                {selectedFile.name}
              </p>
              <p className="tabular-nums text-[11px] text-[#475569]">
                Ukuran: {formatFileSize(selectedFile.size)} · Tipe:{' '}
                {selectedFile.type || 'application/octet-stream'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSelectFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                disabled={isUploading}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3E0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#E2E8F0] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Batal Pilih</span>
              </button>
              <button
                type="button"
                onClick={handleSubmitUpload}
                disabled={isUploading || (Boolean(validationError) && !bypassClientCheck)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#115E59] disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>{isUploading ? 'Mengunggah Berkas...' : submitButtonLabel}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Opsi Bypass Validasi Klien untuk Demonstrasi Rubrik Bab 2.3.8 (HTTP 400 vs HTTP 413) */}
      <div className="rounded-xl border border-[#DCE3E0] bg-[#FFFFFF] px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={bypassId}
            className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#334155]"
          >
            <input
              id={bypassId}
              type="checkbox"
              checked={bypassClientCheck}
              onChange={(e) => handleToggleBypass(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#94A3B8] text-[#0F766E] focus:ring-[#0F766E]"
            />
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#D97706]" strokeWidth={1.75} />
            <span>
              Lewati validasi klien (Uji penolakan server HTTP 400 Magic-Bytes &amp; HTTP 413 Multer
              &gt; 5 MB)
            </span>
          </label>

          {bypassClientCheck && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleSimulateInvalidMagicBytes400}
                className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
              >
                Siapkan Berkas .EXE Palsu (Uji 400)
              </button>
              <button
                type="button"
                onClick={handleSimulateOversized413}
                className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 text-[11px] font-semibold text-[#92400E] hover:bg-[#FEF3C7]"
              >
                Siapkan Berkas 6 MB (Uji 413)
              </button>
            </div>
          )}
        </div>
      </div>

      {validationError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" strokeWidth={1.75} />
          <p className="leading-relaxed">{validationError}</p>
        </div>
      )}

      {serverSuccess && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-2.5 text-xs text-[#065F46]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" strokeWidth={1.75} />
          <p className="leading-relaxed">{serverSuccess}</p>
        </div>
      )}
    </div>
  );
}

export default FileDropzone;
