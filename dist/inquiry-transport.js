/** Sends the inquiry to the server (POST /api/inquiries, see server/server.mjs).
 * Resolves only when the server accepted the email for delivery; otherwise throws an Error
 * whose `code` (and `file`) contact.js turns into a message. Retrying the same content reuses
 * the same key, so the server never sends a retried inquiry twice.
 */
const openedAt = Date.now();
let lastContent = '';
let key = '';

export async function submitInquiry(payload) {
  const { attachments = [], ...fields } = payload;
  const content = JSON.stringify([fields, attachments.map(f => [f.name, f.size, f.lastModified])]);
  if (content !== lastContent) { lastContent = content; key = crypto.randomUUID(); }
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  body.append('elapsed', String(Date.now() - openedAt));
  body.append('key', key);
  for (const file of attachments) body.append('attachments', file, file.name);
  let response;
  try {
    response = await fetch('/api/inquiries', {
      method: 'POST',
      body,
      headers: { Accept: 'application/json' },
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(180000) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Network error'), { code: 'network' });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    throw Object.assign(new Error('Inquiry was not accepted'), { code: result?.code || `http_${response.status}`, file: result?.file });
  }
  lastContent = '';
  return result;
}
