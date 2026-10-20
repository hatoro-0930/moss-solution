import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInquiry } from '../../email/render-inquiry.mjs';

const receivedLine = receivedAt => renderInquiry({ name: 'a', email: 'a@example.com', service: 'circuit', message: 'm', id: 'MS-T', receivedAt })
  .text.split('\n').find(line => line.startsWith('접수 일시'));

test('received time is written in Korea time with 오전/오후, whatever ICU data Node has', () => {
  assert.equal(receivedLine('2026-10-19T07:30:00Z'), '접수 일시: 2026. 10. 19. 오후 4:30 (한국시간)'); // email/preview.txt
  assert.equal(receivedLine('2026-10-19T15:00:00Z'), '접수 일시: 2026. 10. 20. 오전 12:00 (한국시간)');
  assert.equal(receivedLine('2026-10-20T03:05:00Z'), '접수 일시: 2026. 10. 20. 오후 12:05 (한국시간)');
  assert.equal(receivedLine('2026-12-31T14:59:00Z'), '접수 일시: 2026. 12. 31. 오후 11:59 (한국시간)');
});
