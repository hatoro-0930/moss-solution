import { createServer } from 'node:http';
import { createApp } from '../server.mjs';

export const PDF = Buffer.from('%PDF-1.7\n% test document\n');
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

// Minimal ZIP writer (stored entries) — enough for central-directory checks.
export function zip(entries, { zip64 = false } = {}) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, data = 'x', encrypted = false } of entries) {
    const nameBytes = Buffer.from(name, 'utf8'), body = Buffer.from(data);
    const flags = 0x800 | (encrypted ? 1 : 0);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(flags, 6);
    header.writeUInt32LE(body.length, 18); header.writeUInt32LE(body.length, 22); header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, body);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(flags, 8);
    record.writeUInt32LE(body.length, 20); record.writeUInt32LE(body.length, 24); record.writeUInt16LE(nameBytes.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(zip64 ? 0xffff : entries.length, 8); end.writeUInt16LE(zip64 ? 0xffff : entries.length, 10);
  end.writeUInt32LE(zip64 ? 0xffffffff : directory.length, 12); end.writeUInt32LE(zip64 ? 0xffffffff : offset, 16);
  if (!zip64) return Buffer.concat([...local, directory, end]);
  const record64 = Buffer.alloc(56), locator = Buffer.alloc(20);
  record64.writeUInt32LE(0x06064b50, 0); record64.writeBigUInt64LE(44n, 4);
  record64.writeBigUInt64LE(BigInt(entries.length), 24); record64.writeBigUInt64LE(BigInt(entries.length), 32);
  record64.writeBigUInt64LE(BigInt(directory.length), 40); record64.writeBigUInt64LE(BigInt(offset), 48);
  locator.writeUInt32LE(0x07064b50, 0); locator.writeBigUInt64LE(BigInt(offset + directory.length), 8); locator.writeUInt32LE(1, 16);
  return Buffer.concat([...local, directory, record64, locator, end]);
}

export function inquiryForm(overrides = {}, files = []) {
  const form = new FormData();
  const fields = {
    name: '김민수', company: '예시테크', email: 'minsu@example.com', service: 'both',
    message: '실내 온습도 측정 보드를 만들고 싶습니다.\r\n<script>alert(1)</script>',
    schedule: '3개월 이내', language: 'ko', moss_check: '', elapsed: '15000', key: crypto.randomUUID(),
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) if (value !== undefined) form.append(name, value);
  for (const { name, data } of files) form.append('attachments', new File([data], name));
  return form;
}

// Runs the app on a free port with a recording mailer (or the one given).
export async function withServer(fn, { mailer } = {}) {
  const sent = [];
  const app = createApp({ mailer: mailer || { configured: true, async send(mail) { sent.push(mail); return { id: 'test' }; } } });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(`${base}/api/inquiries`, { method: 'POST', body, headers })
    .then(async response => ({ status: response.status, body: await response.json() }));
  try {
    await fn({ base, post, sent });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
