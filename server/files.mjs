// Attachment checks for the inquiry API. Gmail bounces a message whose attachments include a
// blocked file type (also inside archives) or a password-protected archive, and the inquiry
// would be lost silently — so those are rejected before sending, with a code the form can explain.
import { EXTENSIONS } from '../dist/file-policy.js';

// https://support.google.com/mail/answer/6590 (checked 2026-10-20)
const GMAIL_BLOCKED = new Set(('ade adp apk appx appxbundle bat cab chm cmd com cpl diagcab diagcfg diagpkg dll dmg ex ex_ exe hta img ins iso isp jar jnlp js jse lib lnk mde mjs msc msi msix msixbundle msp mst nsh pif ps1 scr sct shb sys vb vbe vbs vhd vxd wsc wsf wsh xll').split(' '));
const COMPRESSED = new Set(['gz', 'bz2', 'xz', 'z']); // setup.exe.gz is blocked like setup.exe
const MAX_ENTRIES = 50000;

export class FileError extends Error {
  constructor(code, file) { super(code); this.code = code; this.file = file; }
}

export const extensionOf = name => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

// Keeps only the base name and drops characters that break mail clients or disguise the
// extension (control characters, bidi overrides such as "invoice‮fdp.exe").
export function cleanFileName(raw) {
  const base = String(raw ?? '').normalize('NFC').split(/[\\/]/).pop()
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩<>:"|?*]/g, '')
    .replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  const chars = Array.from(base);
  if (chars.length <= 150) return base;
  const ext = extensionOf(base);
  return chars.slice(0, 149 - ext.length).join('').trimEnd() + '.' + ext;
}

const at = (bytes, offset, ...expected) => expected.every((byte, i) => bytes[offset + i] === byte);
const isZip = b => at(b, 0, 0x50, 0x4b, 0x03, 0x04) || at(b, 0, 0x50, 0x4b, 0x05, 0x06);
const isExecutable = b => at(b, 0, 0x4d, 0x5a) || at(b, 0, 0x7f, 0x45, 0x4c, 0x46)
  || [[0xcf, 0xfa, 0xed, 0xfe], [0xce, 0xfa, 0xed, 0xfe], [0xfe, 0xed, 0xfa, 0xcf], [0xfe, 0xed, 0xfa, 0xce]].some(sig => at(b, 0, ...sig));
const isJpeg = b => at(b, 0, 0xff, 0xd8, 0xff);
const SIGNATURES = {
  pdf: b => b.subarray(0, 1024).includes('%PDF-'),
  png: b => at(b, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  jpg: isJpeg, jpeg: isJpeg,
  webp: b => at(b, 0, 0x52, 0x49, 0x46, 0x46) && at(b, 8, 0x57, 0x45, 0x42, 0x50),
  zip: isZip, docx: isZip, xlsx: isZip,
};

// Reads entry names from the central directory without extracting anything.
// Returns null when the archive is not readable.
export function zipEntries(b) {
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) return null;
  let count = b.readUInt16LE(end + 10), offset = b.readUInt32LE(end + 16);
  if (count === 0xffff || offset === 0xffffffff) { // ZIP64
    const locator = end - 20;
    if (locator < 0 || b.readUInt32LE(locator) !== 0x07064b50) return null;
    const record = Number(b.readBigUInt64LE(locator + 8));
    if (record + 56 > b.length || b.readUInt32LE(record) !== 0x06064b50) return null;
    count = Number(b.readBigUInt64LE(record + 32));
    offset = Number(b.readBigUInt64LE(record + 48));
  }
  const entries = [];
  for (let n = 0, p = offset; n < count; n++) {
    if (n >= MAX_ENTRIES || p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) return null;
    const flags = b.readUInt16LE(p + 8), nameLength = b.readUInt16LE(p + 28);
    const next = p + 46 + nameLength + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
    if (next > b.length) return null;
    entries.push({ name: b.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLength), encrypted: (flags & 1) === 1 });
    p = next;
  }
  return entries;
}

const blockedByGmail = entryName => {
  const base = entryName.split(/[\\/]/).pop();
  let ext = extensionOf(base);
  if (COMPRESSED.has(ext)) ext = extensionOf(base.slice(0, -(ext.length + 1)));
  return GMAIL_BLOCKED.has(ext);
};

// Throws FileError('invalid_file' | 'encrypted_archive' | 'blocked_in_archive').
export function checkFile(name, bytes) {
  const ext = extensionOf(name);
  if (!EXTENSIONS.has(ext) || bytes.length === 0 || isExecutable(bytes)) throw new FileError('invalid_file', name);
  if (SIGNATURES[ext] && !SIGNATURES[ext](bytes)) throw new FileError('invalid_file', name);
  if (!isZip(bytes)) return;
  const entries = zipEntries(bytes);
  if (!entries) throw new FileError('invalid_file', name);
  if (entries.some(entry => entry.encrypted)) throw new FileError('encrypted_archive', name);
  if (entries.some(entry => blockedByGmail(entry.name))) throw new FileError('blocked_in_archive', name);
}
