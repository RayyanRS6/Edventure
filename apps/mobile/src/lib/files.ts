import { File, Paths, UploadTask, UploadType } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import type { FileInfo, FilePurpose } from '@edventure/contracts';
import { api, ApiError } from './api';
import { reachableUrl } from './config';

export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Opens the system picker for one PDF or image. Returns null when cancelled. */
export async function pickDocument(): Promise<File | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ALLOWED_UPLOAD_TYPES });
  return picked.canceled ? null : picked.result;
}

function mimeOf(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
}

/**
 * Same flow as the website: ask the API for an upload intent, send the bytes to the signed URL,
 * then ask the API to verify the object and queue the malware scan.
 */
export async function uploadFile(file: File, purpose: FilePurpose): Promise<FileInfo> {
  const mimeType = mimeOf(file);
  const intent = await api.post<{ file: FileInfo; upload: { url: string; method: 'PUT'; headers: Record<string, string> } }>('/files/uploads', {
    purpose,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
  });
  const result = await new UploadTask(file, reachableUrl(intent.upload.url), {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: intent.upload.headers,
  }).uploadAsync();
  if (result.status < 200 || result.status >= 300) throw new ApiError(result.status, { code: 'bad_request', message: 'The upload failed. Please try again.' });
  return api.post<FileInfo>(`/files/${intent.file.id}/complete`);
}

/** Downloads an authorized file to the cache and opens the share/open sheet. */
export async function openFile(fileId: string, name: string) {
  const link = await api.get<{ url: string }>(`/files/${fileId}/download`);
  const target = new File(Paths.cache, `${Date.now()}-${name.replace(/[^\w.\-]+/g, '_')}`);
  try {
    const file = await File.downloadFileAsync(reachableUrl(link.url), target, { idempotent: true });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
    else await Linking.openURL(reachableUrl(link.url));
  } catch {
    await Linking.openURL(reachableUrl(link.url));
  }
}
