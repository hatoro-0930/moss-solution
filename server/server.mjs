// moss solution inquiry API.
// POST /api/inquiries validates the form, renders email/render-inquiry.mjs and sends it to the
// company mailbox with the files attached. Nothing is stored; logs carry no inquiry content.
// In production nginx serves dist/ and proxies /api/ here. STATIC_DIR serves the site too (local use).
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { LIMITS } from '../dist/file-policy.js';
import { renderInquiry } from '../email/render-inquiry.mjs';
import { InquiryError, readInquiry } from './inquiry.mjs';
import { createMailer } from './mailer.mjs';

const MAX_BODY = LIMITS.total + 2 * 1024 * 1024; // files + text fields + multipart framing
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 8;                                // requests per IP per window
const DAILY_SENDS = 80;                          // below the Resend free plan's 100 per day
const DEDUPE_MS = 60 * 60 * 1000;                // a retried submission (same key) is sent once

const log = entry => console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const clientIp = req => req.headers['cf-connecting-ip']
  || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || req.socket.remoteAddress || '';

// Browsers always send Origin with a POST; reject posts made from other sites' pages.
function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

function createLimiter(limit, windowMs) {
  const hits = new Map();
  return function take(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10000) for (const [k, times] of hits) if (now - times.at(-1) >= windowMs) hits.delete(k);
    return allowed;
  };
}

function newId(date) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date).replaceAll('-', '');
  return `MS-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function readForm(req) {
  let size = 0;
  const limit = new Transform({
    transform(chunk, _encoding, done) {
      size += chunk.length;
      done(size > MAX_BODY ? new InquiryError(413, 'too_large') : null, chunk);
    },
  });
  req.pipe(limit);
  try {
    return await new Request('http://localhost/api/inquiries', {
      method: 'POST',
      headers: { 'content-type': req.headers['content-type'] },
      body: Readable.toWeb(limit),
      duplex: 'half',
    }).formData();
  } catch {
    throw size > MAX_BODY ? new InquiryError(413, 'too_large') : new InquiryError(400, 'invalid_form');
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

async function serveStatic(root, req, res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { decoded = ''; }
  for (const candidate of [decoded, `${decoded}.html`, path.join(decoded, 'index.html')]) {
    const file = path.join(root, candidate);
    if (!decoded || !file.startsWith(root + path.sep)) continue;
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) continue;
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

export function createApp({ mailer, staticDir, now = () => new Date() }) {
  const take = createLimiter(PER_IP, WINDOW_MS);
  const pending = new Map(); // key → { at, promise }
  const daily = { day: '', count: 0 };
  const root = staticDir && path.resolve(staticDir);

  async function deliver({ fields, files }) {
    const date = now();
    const id = newId(date);
    if (daily.day !== id.slice(3, 11)) Object.assign(daily, { day: id.slice(3, 11), count: 0 });
    if (daily.count >= DAILY_SENDS) throw new InquiryError(429, 'daily_limit');
    const mail = renderInquiry({ ...fields, id, receivedAt: date.toISOString(), attachments: files });
    await mailer.send({ id, ...mail, attachments: files.map(f => ({ filename: f.name, content: f.content })) });
    daily.count++;
    return id;
  }

  async function inquiries(req, res) {
    const started = Date.now();
    if (req.method !== 'POST') return reply(res, 405, { ok: false, code: 'method_not_allowed' });
    if (!sameOrigin(req)) return reply(res, 403, { ok: false, code: 'forbidden_origin' });
    if (!String(req.headers['content-type']).startsWith('multipart/form-data')) return reply(res, 415, { ok: false, code: 'unsupported_media_type' });
    if (Number(req.headers['content-length']) > MAX_BODY) return reply(res, 413, { ok: false, code: 'too_large' });
    if (!take(clientIp(req))) {
      log({ event: 'inquiry', outcome: 'rate_limited' });
      return reply(res, 429, { ok: false, code: 'rate_limited' });
    }
    if (!mailer.configured) {
      log({ event: 'inquiry', outcome: 'mail_not_configured' });
      return reply(res, 503, { ok: false, code: 'mail_not_configured' });
    }

    let inquiry;
    try {
      inquiry = await readInquiry(await readForm(req));
    } catch (error) {
      if (!(error instanceof InquiryError)) throw error;
      log({ event: 'inquiry', outcome: error.code, field: error.extra.field }); // file names stay out of logs
      return reply(res, error.status, { ok: false, code: error.code, ...error.extra });
    }
    if (inquiry.spam) {
      log({ event: 'inquiry', outcome: 'spam_dropped' });
      return reply(res, 200, { ok: true });
    }

    for (const [k, e] of pending) if (started - e.at > DEDUPE_MS) pending.delete(k);
    const { key, files } = inquiry;
    let entry = key && pending.get(key);
    const duplicate = Boolean(entry);
    if (!entry) {
      entry = { at: started, promise: deliver(inquiry) };
      if (key) {
        pending.set(key, entry);
        entry.promise.catch(() => { if (pending.get(key) === entry) pending.delete(key); }); // failures may be retried
      }
    }
    const stats = { files: files.length, bytes: files.reduce((n, f) => n + f.size, 0) };
    try {
      const id = await entry.promise;
      log({ event: 'inquiry', outcome: 'sent', id, duplicate, ...stats, ms: Date.now() - started });
      return reply(res, 200, { ok: true, id });
    } catch (error) {
      if (error instanceof InquiryError) {
        log({ event: 'inquiry', outcome: error.code });
        return reply(res, error.status, { ok: false, code: error.code });
      }
      log({ event: 'inquiry', outcome: 'send_failed', status: error.status, reason: error.reason || error.name, ...stats, ms: Date.now() - started });
      return reply(res, 502, { ok: false, code: 'send_failed' });
    }
  }

  return async function handle(req, res) {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname === '/api/health') return reply(res, 200, { ok: true, mail: mailer.configured ? 'configured' : 'missing' });
      if (pathname === '/api/inquiries') return await inquiries(req, res);
      if (root && !pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(req.method)) return await serveStatic(root, req, res, pathname);
      return reply(res, 404, { ok: false, code: 'not_found' });
    } catch (error) {
      log({ event: 'error', message: error.message });
      if (!res.headersSent) reply(res, 500, { ok: false, code: 'internal' });
      else res.destroy();
    }
  };
}

export function start(env = process.env) {
  const mailer = createMailer({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM, toOverride: env.MAIL_TO_OVERRIDE, outbox: env.MAIL_OUTBOX });
  const server = createServer(createApp({ mailer, staticDir: env.STATIC_DIR }));
  const port = Number(env.PORT || 3000);
  server.listen(port, env.HOST || '0.0.0.0', () => log({
    event: 'listening', port,
    mail: env.MAIL_OUTBOX ? 'outbox' : mailer.configured ? 'resend' : 'missing',
    toOverride: Boolean(env.MAIL_TO_OVERRIDE),
  }));
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 20_000).unref();
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
