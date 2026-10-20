import assert from 'node:assert/strict';
import test from 'node:test';
import { checkFile, cleanFileName, zipEntries } from '../files.mjs';
import { PDF, PNG, zip } from './helpers.mjs';

const codeOf = (name, bytes) => { try { checkFile(name, bytes); return 'ok'; } catch (error) { return error.code; } };

test('file names keep only a safe base name', () => {
  assert.equal(cleanFileName('../../etc/passwd.txt'), 'passwd.txt');
  assert.equal(cleanFileName('C:\\Users\\me\\회로도 참고.zip'), '회로도 참고.zip');
  assert.equal(cleanFileName('invoice\u202Efdp.exe'), 'invoicefdp.exe');
  assert.equal(cleanFileName('a\u0000b\nc.pdf'), 'abc.pdf');
  const long = cleanFileName(`${'가'.repeat(300)}.kicad_pcb`);
  assert.equal(Array.from(long).length, 150);
  assert.ok(long.endsWith('.kicad_pcb'));
});

test('content must match the extension and must not be a program', () => {
  assert.equal(codeOf('spec.pdf', PDF), 'ok');
  assert.equal(codeOf('photo.png', PNG), 'ok');
  assert.equal(codeOf('board.gbr', Buffer.from('G04 gerber*\n%FSLAX26Y26*%')), 'ok');
  assert.equal(codeOf('spec.pdf', Buffer.from('not a pdf')), 'invalid_file');
  assert.equal(codeOf('manual.pdf', Buffer.concat([Buffer.from('MZ'), PDF])), 'invalid_file');
  assert.equal(codeOf('notes.txt', Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1])), 'invalid_file');
  assert.equal(codeOf('setup.exe', Buffer.from('anything')), 'invalid_file');
  assert.equal(codeOf('empty.txt', Buffer.alloc(0)), 'invalid_file');
});

test('archives are checked for what Gmail refuses', () => {
  assert.equal(codeOf('project.zip', zip([{ name: 'board.kicad_pcb' }, { name: '회로/main.kicad_sch' }])), 'ok');
  assert.equal(codeOf('report.docx', zip([{ name: 'word/document.xml' }])), 'ok');
  assert.equal(codeOf('project.zip', zip([{ name: 'tools/flash.exe' }])), 'blocked_in_archive');
  assert.equal(codeOf('project.zip', zip([{ name: 'old-cache.LIB' }])), 'blocked_in_archive');
  assert.equal(codeOf('project.zip', zip([{ name: 'setup.exe.gz' }])), 'blocked_in_archive');
  assert.equal(codeOf('project.zip', zip([{ name: 'secret.pdf', encrypted: true }])), 'encrypted_archive');
  assert.equal(codeOf('project.zip', Buffer.from('PK\u0003\u0004 truncated')), 'invalid_file');
});

test('ZIP64 central directories are read', () => {
  const entries = zipEntries(zip([{ name: 'a.txt' }, { name: 'b/run.bat' }], { zip64: true }));
  assert.deepEqual(entries.map(e => e.name), ['a.txt', 'b/run.bat']);
  assert.equal(codeOf('big.zip', zip([{ name: 'b/run.bat' }], { zip64: true })), 'blocked_in_archive');
});
