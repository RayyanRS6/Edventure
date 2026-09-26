import type { TestApp, Client } from './app';
import { ok } from './fixtures';

export const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n')]);
export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003000100ffa5c1d10000000049454e44ae426082', 'hex');

/** Performs the full upload flow (intent → PUT to the signed URL → complete) and returns the file id. */
export async function uploadFile(t: TestApp, client: Client, purpose: string, name: string, body: Buffer, mimeType: string) {
  const intent = await ok(client.post('/files/uploads', { purpose, fileName: name, mimeType, sizeBytes: body.length }));
  const path = new URL(intent.upload.url).pathname;
  const put = await t.app.inject({ method: 'PUT', url: path, payload: body, headers: { 'content-type': mimeType } });
  if (put.statusCode !== 200) throw new Error(`upload failed: ${put.body}`);
  const done = await ok(client.post(`/files/${intent.file.id}/complete`));
  return done.id as string;
}
