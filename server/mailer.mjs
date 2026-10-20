// Sends a rendered inquiry through Resend (https://resend.com/docs/api-reference/emails/send-email).
// With MAIL_OUTBOX set, messages are written to that folder instead — for local development.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class MailError extends Error {
  constructor(status, reason) { super(`mail ${status} ${reason}`); this.status = status; this.reason = reason; }
}

// mail: { id, to, replyTo, subject, text, html, attachments: [{ filename, content: Buffer }] }
export function createMailer({ apiKey, from, toOverride, outbox, timeoutMs = 30_000 } = {}) {
  if (outbox) {
    return {
      configured: true,
      async send(mail) {
        await mkdir(outbox, { recursive: true });
        const base = path.join(outbox, mail.id);
        const { html, attachments, ...rest } = mail;
        await writeFile(`${base}.html`, html);
        await writeFile(`${base}.json`, JSON.stringify({ ...rest, from, attachments: attachments.map(a => ({ filename: a.filename, size: a.content.length })) }, null, 2));
        for (const [i, a] of attachments.entries()) await writeFile(`${base}.${i + 1}-${a.filename}`, a.content);
        return { id: `outbox-${mail.id}` };
      },
    };
  }
  if (!apiKey || !from) return { configured: false, async send() { throw new MailError(503, 'not_configured'); } };
  return {
    configured: true,
    async send(mail) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [toOverride || mail.to],
          reply_to: mail.replyTo,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          attachments: mail.attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') })),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) throw new MailError(response.status, result.name || 'unknown');
      return { id: result.id };
    },
  };
}
