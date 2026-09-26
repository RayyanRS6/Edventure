import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider, UploadTarget } from './provider';

export interface LocalToken {
  k: string; // object key
  op: 'put' | 'get';
  m?: string; // mime type
  max?: number; // max bytes
  n?: string; // download file name
  exp: number; // unix seconds
}

/**
 * Development/test storage on the local disk. Upload and download URLs point at the API itself and
 * carry an HMAC-signed, expiring token, mirroring how signed URLs behave in Supabase Storage.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly kind = 'local' as const;

  constructor(
    private readonly root: string,
    private readonly publicApiUrl: string,
    private readonly secret: string,
  ) {}

  private file(objectKey: string) {
    const resolved = path.resolve(this.root, objectKey);
    if (!resolved.startsWith(path.resolve(this.root))) throw new Error('Invalid object key');
    return resolved;
  }

  sign(token: LocalToken) {
    const body = Buffer.from(JSON.stringify(token)).toString('base64url');
    const mac = createHmac('sha256', `storage:${this.secret}`).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  verify(token: string, op: 'put' | 'get'): LocalToken | null {
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = createHmac('sha256', `storage:${this.secret}`).update(body).digest('base64url');
    if (expected.length !== mac.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString()) as LocalToken;
    if (parsed.op !== op || parsed.exp < Date.now() / 1000) return null;
    return parsed;
  }

  async createUploadTarget(objectKey: string, mimeType: string, maxBytes: number): Promise<UploadTarget> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const token = this.sign({ k: objectKey, op: 'put', m: mimeType, max: maxBytes, exp: Math.floor(expiresAt.getTime() / 1000) });
    return { url: `${this.publicApiUrl}/api/v1/files/local/${token}`, method: 'PUT', headers: { 'content-type': mimeType }, expiresAt };
  }

  async stat(objectKey: string) {
    try {
      const s = await fs.stat(this.file(objectKey));
      return { size: s.size };
    } catch {
      return null;
    }
  }

  async read(objectKey: string) {
    return fs.readFile(this.file(objectKey));
  }

  async write(objectKey: string, body: Buffer) {
    const target = this.file(objectKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  }

  async createDownloadUrl(objectKey: string, fileName: string, expiresInSeconds: number) {
    const token = this.sign({ k: objectKey, op: 'get', n: fileName, exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
    return `${this.publicApiUrl}/api/v1/files/local/${token}`;
  }

  async remove(objectKey: string) {
    await fs.rm(this.file(objectKey), { force: true });
  }
}
