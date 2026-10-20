import { attachments } from './attachments.js';
import { submitInquiry } from './inquiry-transport.js';
const form = document.getElementById('inquiry-form');
const formView = document.getElementById('form-view');
const success = document.getElementById('success-view');
const submitButton = form.querySelector('[type="submit"]');
const submitError = document.getElementById('submit-error');
let submitting = false;
let failure = null;
const lang = () => window.mossLanguage?.() || 'ko';
const copy = (ko,en) => lang() === 'en' ? en : ko;
function failureMessage() {
 const file = failure?.file || '';
 switch (failure?.code) {
  case 'blocked_in_archive': return copy(`‘${file}’ 압축 파일 안에 메일로 보낼 수 없는 형식(.exe, .js, .lib 등)의 파일이 있습니다. 해당 파일을 빼고 다시 압축해 첨부해주세요.`,`‘${file}’ contains file types that can’t be sent by email (such as .exe, .js or .lib). Please remove them, re-zip and attach it again.`);
  case 'encrypted_archive': return copy(`‘${file}’은(는) 암호가 걸린 압축 파일이라 보낼 수 없습니다. 암호 없이 다시 압축해 첨부해주세요.`,`‘${file}’ is password-protected, so it can’t be sent. Please re-zip it without a password.`);
  case 'invalid_file': return copy(`‘${file}’ 파일은 형식이나 내용이 첨부 기준과 맞지 않아 보낼 수 없습니다. 해당 파일을 빼고 다시 보내주세요.`,`‘${file}’ can’t be sent because its format or content doesn’t match the allowed file types. Please remove it and try again.`);
  case 'too_large': case 'too_many_files': return copy('첨부 파일이 기준(최대 10개 · 파일당 10MB · 전체 20MB)을 넘었습니다. 파일을 줄여 다시 보내주세요.','Your attachments exceed the limit (up to 10 files · 10 MB each · 20 MB total). Please reduce them and try again.');
  case 'rate_limited': case 'daily_limit': return copy('짧은 시간에 문의가 많이 접수되어 잠시 받을 수 없습니다. 작성한 내용은 유지되어 있습니다. 잠시 후 다시 시도하거나 moss.solutions25@gmail.com으로 연락해주세요.','We’re receiving too many inquiries right now. Your entries have been kept. Please try again shortly or email moss.solutions25@gmail.com.');
  default: return copy('문의를 보내지 못했습니다. 작성한 내용은 유지되어 있습니다. 잠시 후 다시 시도하거나 moss.solutions25@gmail.com으로 연락해주세요.','We couldn’t send your inquiry. Your entries have been kept. Please try again or email moss.solutions25@gmail.com.');
 }
}
const selectedLabel = () => options.find(o => o.dataset.value === serviceValue.value)?.querySelector('.option-label').textContent || copy('선택해주세요','Please select');
function refreshLanguage() {
 document.getElementById('service-text').textContent = selectedLabel();
 document.getElementById('chosen-service').textContent = selectedLabel();
 document.getElementById('success-files').textContent = attachments.files().map(f => f.name).join(', ') || copy('없음','None');
 submitButton.innerHTML = '<span>' + (submitting ? copy('보내는 중…','Sending…') : copy('문의 보내기','Send inquiry')) + '</span><span aria-hidden="true">↗</span>';
 submitError.textContent = failureMessage();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  if (!document.getElementById('service-value').value) {
    document.getElementById('service-error').hidden = false;
    document.getElementById('service-trigger').setAttribute('aria-invalid', 'true');
    document.getElementById('service-trigger').focus();
    return;
  }
  const payload = {...Object.fromEntries(new FormData(form)), language: lang(), attachments: attachments.files()};
  submitting = true;
  failure = null;
  submitButton.disabled = true;
  attachments.setBusy(true);
  refreshLanguage();
  form.setAttribute('aria-busy', 'true');
  submitError.hidden = true;
  try {
    const result = await submitInquiry(payload);
    if (!result || result.ok !== true) throw new Error('Inquiry was not accepted');
    document.getElementById('chosen-service').textContent = selectedLabel();
 document.getElementById('success-files').textContent = attachments.files().map(f => f.name).join(', ') || copy('없음','None');
    document.getElementById('reply-email').textContent = payload.email;
    formView.hidden = true;
    success.hidden = false;
    document.getElementById('success-title').focus();
  } catch (error) {
    failure = error;
    refreshLanguage();
    submitError.hidden = false;
  } finally {
    submitting = false;
    submitButton.disabled = false;
    attachments.setBusy(false);
    refreshLanguage();
    form.removeAttribute('aria-busy');
  }
});
document.getElementById('new-inquiry').addEventListener('click', () => {
  form.reset();
  attachments.reset();
  serviceValue.value = '';
  document.getElementById('service-text').textContent = copy('선택해주세요','Please select');
  options.forEach(option => option.setAttribute('aria-selected', 'false'));
  trigger.removeAttribute('aria-invalid');
  document.getElementById('service-error').hidden = true;
  closePicker();
  submitError.hidden = true;
  success.hidden = true;
  formView.hidden = false;
  form.elements.name.focus();
});
const picker = document.querySelector('.custom-select');
const trigger = document.getElementById('service-trigger');
const menu = document.getElementById('service-options');
const options = Array.from(menu.querySelectorAll('[role="option"]'));
const serviceValue = document.getElementById('service-value');
let activeIndex = 0;
function highlight(index) {
  activeIndex = (index + options.length) % options.length;
  options.forEach((option, i) => option.classList.toggle('active', i === activeIndex));
  trigger.setAttribute('aria-activedescendant', options[activeIndex].id);
}
function openPicker(index) {
  menu.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  const selected = options.findIndex(option => option.dataset.value === serviceValue.value);
  highlight(index === undefined ? Math.max(0, selected) : index);
}
function closePicker() {
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.removeAttribute('aria-activedescendant');
}
function choose(index) {
  serviceValue.value = options[index].dataset.value;
  document.getElementById('service-text').textContent = selectedLabel();
  options.forEach((option,i) => option.setAttribute('aria-selected', String(i === index)));
  document.getElementById('service-error').hidden = true;
  trigger.removeAttribute('aria-invalid');
  closePicker();
  trigger.focus();
}
trigger.addEventListener('click', () => menu.hidden ? openPicker() : closePicker());
trigger.addEventListener('keydown', event => {
  if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)) {
    event.preventDefault();
    if (menu.hidden) { openPicker(event.key === 'End' || event.key === 'ArrowUp' ? options.length - 1 : undefined); return; }
    if (event.key === 'ArrowDown') highlight(activeIndex + 1);
    else if (event.key === 'ArrowUp') highlight(activeIndex - 1);
    else if (event.key === 'Home') highlight(0);
    else if (event.key === 'End') highlight(options.length - 1);
    else choose(activeIndex);
  } else if (event.key === 'Escape') { event.preventDefault(); closePicker(); }
  else if (event.key === 'Tab') closePicker();
});
options.forEach((option,index) => {
  option.addEventListener('pointerdown', event => event.preventDefault());
  option.addEventListener('click', () => choose(index));
  option.addEventListener('pointerenter', () => highlight(index));
});
document.addEventListener('pointerdown', event => { if (!picker.contains(event.target)) closePicker(); });
trigger.addEventListener('blur', () => closePicker());

document.addEventListener('languagechange', refreshLanguage);
refreshLanguage();
