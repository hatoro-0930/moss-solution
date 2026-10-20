// Server-side template. Validate inputs and create id/receivedAt on the server.
export const services = {planning:'아이디어 구체화 상담',circuit:'회로 설계',layout:'PCB 레이아웃',both:'회로 설계 및 PCB 레이아웃',discuss:'상담 후 결정'};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const single = value => String(value || '').replace(/[\r\n]/g,' ').trim();
// "2026. 10. 20. 오전 11:23" in Korea time (UTC+9, no daylight saving). Built by hand because
// Intl output depends on the Node build's ICU data (CLDR 48 prints "AM" for ko-KR).
const koreanTime = value => {
 const t = new Date(new Date(value).getTime() + 9 * 3600 * 1000), h = t.getUTCHours();
 return `${t.getUTCFullYear()}. ${t.getUTCMonth() + 1}. ${t.getUTCDate()}. ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
};
export function renderInquiry({name,company,email,service,message,schedule,language,id,receivedAt,attachments=[]}) {
 const type = services[service];
 if (!type || !name || !email || !message || !id || !receivedAt) throw new Error('Missing or invalid inquiry data');
 const date = koreanTime(receivedAt);
 const subject = `[moss 문의] ${type} | ${company ? single(company)+' · ' : ''}${single(name)}`;
 const rows = [['문의자',name],['회사·팀명',company || '미입력'],['회신 이메일',email],['희망 일정',schedule || '미입력'],['문의 언어',language === 'en' ? 'English' : '한국어'],['접수 일시',date+' (한국시간)'],['문의 번호',id]];
 const attachmentList=attachments.length ? attachments.map(f=>`${f.name} (${Math.ceil(f.size/1024)} KB)`).join('\n') : '없음';
 const text = `moss solution · 새 프로젝트 문의\n\n${type}\n\n${rows.map(([k,v])=>k+': '+v).join('\n')}\n\n프로젝트 내용\n\n${message}\n\n첨부 파일\n${attachmentList}\n\n이 메일에 답장하면 문의자에게 연결됩니다.\nmoss solution 홈페이지에서 접수된 문의입니다.`;
 const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f4f1;color:#20231f;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:#fff;border:1px solid #e0e3dc;border-collapse:collapse"><tr><td style="padding:32px 24px"><p style="font-size:13px;color:#626b5b;margin:0 0 24px">moss solution · 새 프로젝트 문의</p><h1 style="font-size:25px;line-height:1.4;margin:0 0 24px">${escape(type)}</h1>${rows.map(([k,v])=>`<p style="margin:0 0 18px;font-size:16px;line-height:1.6;overflow-wrap:anywhere"><span style="font-size:12px;color:#687061">${k}</span><br>${escape(v)}</p>`).join('')}<hr style="border:0;border-top:1px solid #e0e3dc;margin:28px 0"><h2 style="font-size:17px">프로젝트 내용</h2><p style="font-size:16px;line-height:1.85;overflow-wrap:anywhere">${escape(message).replace(/\r?\n/g,'<br>')}</p><h2 style="font-size:17px;margin-top:28px">첨부 파일</h2><p style="font-size:14px;line-height:1.8;overflow-wrap:anywhere">${escape(attachmentList).replace(/\n/g,'<br>')}</p><p style="margin-top:32px"><a href="mailto:${escape(encodeURIComponent(email))}" style="display:inline-block;padding:14px 20px;background:#22281f;color:white;text-decoration:none;border-radius:4px">문의자에게 답장하기 ↗</a></p><p style="font-size:12px;line-height:1.8;color:#687061">이 메일에 답장하면 문의자에게 연결됩니다.<br>moss solution 홈페이지에서 접수된 문의입니다.</p></td></tr></table></td></tr></table></body></html>`;
 return {to:'moss.solutions25@gmail.com',replyTo:single(email),subject,text,html};
}
