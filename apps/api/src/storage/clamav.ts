import net from 'node:net';

/**
 * Minimal ClamAV (clamd) INSTREAM client. The worker runs clamd alongside it; every learning upload
 * is scanned before it becomes available to anyone else.
 */
export async function scanWithClamav(host: string, port: number, body: Buffer, timeoutMs = 60_000): Promise<'clean' | 'infected'> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error('ClamAV scan timed out'));
    });
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      const size = 64 * 1024;
      for (let i = 0; i < body.length; i += size) {
        const chunk = body.subarray(i, i + size);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        socket.write(len);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (d) => chunks.push(d));
    socket.on('error', reject);
    socket.on('end', () => {
      const reply = Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim();
      if (/OK$/.test(reply)) resolve('clean');
      else if (/FOUND$/.test(reply)) resolve('infected');
      else reject(new Error(`Unexpected ClamAV reply: ${reply}`));
    });
  });
}
