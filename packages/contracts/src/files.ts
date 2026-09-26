import { z } from 'zod';
import { id, isoDateTime } from './common';
import { fileLifecycles, filePurposes, fileScanStates } from './domain';

export const filePurpose = z.enum(filePurposes);
export type FilePurpose = z.infer<typeof filePurpose>;

/** Upload rules by purpose. Executables, HTML, SVG, archives and macro documents are never accepted. */
export const uploadRules: Record<FilePurpose, { maxBytes: number; mimeTypes: string[]; clientUpload: boolean }> = {
  profile_image: { maxBytes: 2 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png'], clientUpload: true },
  homework_attachment: { maxBytes: 20 * 1024 * 1024, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], clientUpload: true },
  submission: { maxBytes: 20 * 1024 * 1024, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], clientUpload: true },
  material: { maxBytes: 20 * 1024 * 1024, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], clientUpload: true },
  document: { maxBytes: 20 * 1024 * 1024, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], clientUpload: true },
  announcement_attachment: { maxBytes: 20 * 1024 * 1024, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], clientUpload: true },
  import: { maxBytes: 10 * 1024 * 1024, mimeTypes: ['text/csv'], clientUpload: true },
  export: { maxBytes: 200 * 1024 * 1024, mimeTypes: ['text/csv', 'application/pdf'], clientUpload: false },
  report: { maxBytes: 200 * 1024 * 1024, mimeTypes: ['application/pdf', 'text/csv'], clientUpload: false },
};

export const createUploadRequest = z.object({
  purpose: filePurpose,
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().max(100),
  sizeBytes: z.number().int().positive(),
});

export const uploadTarget = z.object({
  url: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: isoDateTime,
});

export const fileInfo = z.object({
  id,
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  purpose: filePurpose,
  scanState: z.enum(fileScanStates),
  lifecycle: z.enum(fileLifecycles),
  createdAt: isoDateTime,
});
export type FileInfo = z.infer<typeof fileInfo>;

export const createUploadResponse = z.object({ file: fileInfo, upload: uploadTarget });
export const downloadLink = z.object({ url: z.string(), expiresAt: isoDateTime });
