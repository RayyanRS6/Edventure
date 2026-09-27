'use client';

import type { FilePurpose, FileInfo } from '@edventure/contracts';
import { api, ApiError } from './api';

const guessMime = (file: File) => {
  if (file.type && file.type !== 'application/vnd.ms-excel') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'csv' ? 'text/csv' : ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : file.type;
};

/**
 * Upload flow: ask the API for an upload intent, PUT the bytes to the signed URL, then ask the API
 * to verify the object (size, type, checksum) and queue the malware scan.
 */
export async function uploadFile(file: File, purpose: FilePurpose): Promise<FileInfo> {
  const mimeType = guessMime(file);
  const intent = await api.post<{ file: FileInfo; upload: { url: string; method: 'PUT'; headers: Record<string, string> } }>('/files/uploads', {
    purpose,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
  });
  // Development storage lives behind the API; route it through this origin's /api proxy.
  const target = new URL(intent.upload.url, window.location.origin);
  const url = target.pathname.startsWith('/api/v1/files/local/') ? target.pathname : intent.upload.url;
  const res = await fetch(url, { method: 'PUT', body: file, headers: intent.upload.headers });
  if (!res.ok) throw new ApiError(res.status, { code: 'bad_request', message: 'The upload failed. Please try again.' });
  return api.post<FileInfo>(`/files/${intent.file.id}/complete`);
}
