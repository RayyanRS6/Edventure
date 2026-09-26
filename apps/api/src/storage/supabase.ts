import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StorageProvider, UploadTarget } from './provider';

/**
 * Supabase Storage (private bucket). The service-role client bypasses storage RLS, so every call
 * here must be preceded by an application-level authorization check.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly kind = 'supabase' as const;
  private readonly client: SupabaseClient;

  constructor(
    url: string,
    serviceRoleKey: string,
    private readonly bucket: string,
  ) {
    this.client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private get store() {
    return this.client.storage.from(this.bucket);
  }

  async createUploadTarget(objectKey: string, mimeType: string): Promise<UploadTarget> {
    const { data, error } = await this.store.createSignedUploadUrl(objectKey);
    if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
    // Supabase signed upload URLs are valid for two hours.
    return { url: data.signedUrl, method: 'PUT', headers: { 'content-type': mimeType }, expiresAt: new Date(Date.now() + 2 * 3600 * 1000) };
  }

  async stat(objectKey: string) {
    const dir = objectKey.split('/').slice(0, -1).join('/');
    const name = objectKey.split('/').pop()!;
    const { data, error } = await this.store.list(dir, { search: name, limit: 1 });
    if (error || !data?.length) return null;
    const size = (data[0]?.metadata as { size?: number } | null)?.size;
    return typeof size === 'number' ? { size } : null;
  }

  async read(objectKey: string) {
    const { data, error } = await this.store.download(objectKey);
    if (error || !data) throw new Error(`Could not read object: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async write(objectKey: string, body: Buffer, mimeType: string) {
    const { error } = await this.store.upload(objectKey, body, { contentType: mimeType, upsert: true });
    if (error) throw new Error(`Could not write object: ${error.message}`);
  }

  async createDownloadUrl(objectKey: string, fileName: string, expiresInSeconds: number) {
    const { data, error } = await this.store.createSignedUrl(objectKey, expiresInSeconds, { download: fileName });
    if (error || !data) throw new Error(`Could not sign download: ${error?.message}`);
    return data.signedUrl;
  }

  async remove(objectKey: string) {
    await this.store.remove([objectKey]);
  }
}
