// Validates a submitted inquiry (multipart form data) before anything is sent.
// Mirrors the limits of the form (contact.html maxlength, dist/file-policy.js).
import { LIMITS } from '../dist/file-policy.js';
import { services } from '../email/render-inquiry.mjs';
import { checkFile, cleanFileName, FileError } from './files.mjs';

export class InquiryError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

const MAX_LENGTH = { name: 80, company: 120, email: 254, schedule: 120, message: 5000 };
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:".]+(\.[^\s@<>()[\]\\,;:".]+)+$/;
const MIN_FILL_MS = 3000; // time on the page before submitting; the form script always sends it

const line = value => value.normalize('NFC').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const block = value => value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();

export async function readInquiry(form) {
  const text = key => { const value = form.get(key); return typeof value === 'string' ? value : ''; };
  // A filled honeypot is answered with a normal success so bots learn nothing. Too fast (or no
  // fill time, i.e. not sent by the form) is an error instead, so a person can simply retry.
  if (text('moss_check') !== '') return { spam: true };
  if (!(Number(text('elapsed')) >= MIN_FILL_MS)) throw new InquiryError(400, 'too_fast');

  const fields = {
    name: line(text('name')), company: line(text('company')), email: line(text('email')),
    service: text('service'), schedule: line(text('schedule')), message: block(text('message')),
    language: text('language') === 'en' ? 'en' : 'ko',
  };
  for (const [field, max] of Object.entries(MAX_LENGTH)) {
    if (fields[field].length > max) throw new InquiryError(400, 'invalid', { field });
  }
  if (!fields.name) throw new InquiryError(400, 'invalid', { field: 'name' });
  if (!EMAIL.test(fields.email)) throw new InquiryError(400, 'invalid', { field: 'email' });
  if (!Object.hasOwn(services, fields.service)) throw new InquiryError(400, 'invalid', { field: 'service' });
  if (!fields.message) throw new InquiryError(400, 'invalid', { field: 'message' });

  const uploads = form.getAll('attachments').filter(value => typeof value !== 'string');
  if (uploads.length > LIMITS.count) throw new InquiryError(400, 'too_many_files');
  const files = [];
  let total = 0;
  for (const upload of uploads) {
    const name = cleanFileName(upload.name);
    total += upload.size;
    if (upload.size > LIMITS.each || total > LIMITS.total) throw new InquiryError(413, 'too_large', { file: name });
    const content = Buffer.from(await upload.arrayBuffer());
    try {
      checkFile(name, content);
    } catch (error) {
      if (error instanceof FileError) throw new InquiryError(422, error.code, { file: error.file });
      throw error;
    }
    files.push({ name, size: content.length, content });
  }
  const key = text('key');
  return { spam: false, fields, files, key: /^[A-Za-z0-9-]{8,100}$/.test(key) ? key : '' };
}
