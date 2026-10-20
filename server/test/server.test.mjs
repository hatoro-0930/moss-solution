import assert from 'node:assert/strict';
import test from 'node:test';
import { MailError } from '../mailer.mjs';
import { PDF, PNG, inquiryForm, withServer, zip } from './helpers.mjs';

test('a valid inquiry is sent to the company mailbox with its files', () => withServer(async ({ post, sent }) => {
  const files = [{ name: '제품 요구사항.pdf', data: PDF }, { name: 'board.png', data: PNG }];
  const { status, body } = await post(inquiryForm({}, files));
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.match(body.id, /^MS-\d{8}-[0-9A-F]{6}$/);
  assert.equal(sent.length, 1);
  const [mail] = sent;
  assert.equal(mail.to, 'moss.solutions25@gmail.com');
  assert.equal(mail.replyTo, 'minsu@example.com');
  assert.equal(mail.subject, '[moss 문의] 회로 설계 및 PCB 레이아웃 | 예시테크 · 김민수');
  assert.ok(mail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.text.includes('측정 보드를 만들고 싶습니다.\n<script>'), 'CRLF from the browser becomes LF');
  assert.ok(mail.text.includes('제품 요구사항.pdf (1 KB)'));
  assert.deepEqual(mail.attachments.map(a => a.filename), ['제품 요구사항.pdf', 'board.png']);
  assert.deepEqual(mail.attachments[0].content, PDF);
}));

test('inquiry numbers and received time use the Korean date', () => withServer(async ({ post, sent }) => {
  const { body } = await post(inquiryForm());
  assert.match(body.id, /^MS-20261020-[0-9A-F]{6}$/, '15:30 UTC on the 19th is already the 20th in Korea');
  assert.ok(sent[0].text.includes('접수 일시: 2026. 10. 20. 오전 12:30 (한국시간)'), sent[0].text);
}, { now: () => new Date('2026-10-19T15:30:00Z') }));

test('missing or malformed fields are refused', () => withServer(async ({ post, sent }) => {
  const cases = [
    [{ name: '  ' }, 'name'],
    [{ email: 'minsu@example' }, 'email'],
    [{ email: 'minsu@example.com\r\nBcc: other@example.com' }, 'email'],
    [{ service: 'manufacturing' }, 'service'],
    [{ message: 'x'.repeat(5001) }, 'message'],
  ];
  for (const [override, field] of cases) {
    const { status, body } = await post(inquiryForm(override));
    assert.equal(status, 400, field);
    assert.deepEqual(body, { ok: false, code: 'invalid', field });
  }
  assert.equal(sent.length, 0);
}));

test('file rules are enforced on the server too', () => withServer(async ({ post, sent }) => {
  const tooMany = Array.from({ length: 11 }, (_, i) => ({ name: `p${i}.pdf`, data: PDF }));
  assert.equal((await post(inquiryForm({}, tooMany))).body.code, 'too_many_files');
  const big = await post(inquiryForm({}, [{ name: 'big.pdf', data: Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]) }]));
  assert.deepEqual([big.status, big.body.code, big.body.file], [413, 'too_large', 'big.pdf']);
  const fake = await post(inquiryForm({}, [{ name: 'manual.pdf', data: Buffer.from('MZ\x90\x00') }]));
  assert.deepEqual([fake.status, fake.body.code, fake.body.file], [422, 'invalid_file', 'manual.pdf']);
  const blocked = await post(inquiryForm({}, [{ name: 'kicad5.zip', data: zip([{ name: 'proj-cache.lib' }]) }]));
  assert.deepEqual([blocked.status, blocked.body.code, blocked.body.file], [422, 'blocked_in_archive', 'kicad5.zip']);
  assert.equal(sent.length, 0);
}));

test('a request body over the limit is refused before parsing', () => withServer(async ({ post }) => {
  const files = [0, 1, 2].map(i => ({ name: `p${i}.pdf`, data: Buffer.concat([PDF, Buffer.alloc(8 * 1024 * 1024)]) }));
  const { status, body } = await post(inquiryForm({}, files));
  assert.deepEqual([status, body.code], [413, 'too_large']);
}));

test('bots: a filled honeypot looks accepted, a too-fast submit is refused', () => withServer(async ({ post, sent }) => {
  assert.deepEqual(await post(inquiryForm({ moss_check: 'https://spam.example' })), { status: 200, body: { ok: true } });
  assert.equal((await post(inquiryForm({ elapsed: '800' }))).body.code, 'too_fast');
  assert.equal((await post(inquiryForm({ elapsed: undefined }))).body.code, 'too_fast');
  assert.equal(sent.length, 0);
}));

test('a retried submission with the same key is sent once', () => withServer(async ({ post, sent }) => {
  const key = crypto.randomUUID();
  const [a, b] = await Promise.all([post(inquiryForm({ key })), post(inquiryForm({ key }))]);
  const c = await post(inquiryForm({ key }));
  assert.ok([a, b, c].every(r => r.status === 200 && r.body.ok));
  assert.equal(new Set([a, b, c].map(r => r.body.id)).size, 1);
  assert.equal(sent.length, 1);
  await post(inquiryForm());
  assert.equal(sent.length, 2, 'a different key is a new inquiry');
}));

test('a failed send is reported and can be retried', async () => {
  let calls = 0;
  const mailer = { configured: true, async send() { calls++; if (calls === 1) throw new MailError(500, 'application_error'); return { id: 'x' }; } };
  await withServer(async ({ post }) => {
    const form = () => inquiryForm({ key: 'retry-key-0001' });
    assert.deepEqual(await post(form()), { status: 502, body: { ok: false, code: 'send_failed' } });
    assert.equal((await post(form())).status, 200);
    assert.equal(calls, 2);
  }, { mailer });
});

test('without mail credentials the API says so instead of pretending', async () => {
  const mailer = { configured: false, async send() { throw new MailError(503, 'not_configured'); } };
  await withServer(async ({ base, post }) => {
    assert.deepEqual(await post(inquiryForm()), { status: 503, body: { ok: false, code: 'mail_not_configured' } });
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, mail: 'missing' });
  }, { mailer });
});

test('requests are rate limited per client', () => withServer(async ({ post }) => {
  const statuses = [];
  for (let i = 0; i < 9; i++) statuses.push((await post(inquiryForm({}, []), { 'CF-Connecting-IP': '203.0.113.7' })).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 200, 200, 429]);
  assert.equal((await post(inquiryForm(), { 'CF-Connecting-IP': '203.0.113.8' })).status, 200, 'other clients are unaffected');
}));

test('posts from other sites and non-form bodies are refused', () => withServer(async ({ base, post }) => {
  assert.equal((await post(inquiryForm(), { Origin: 'https://evil.example' })).status, 403);
  const json = await fetch(`${base}/api/inquiries`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  assert.equal(json.status, 415);
  assert.equal((await fetch(`${base}/api/inquiries`)).status, 405);
}));
