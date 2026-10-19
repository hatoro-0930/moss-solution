import { attachments } from './attachments.js';
import { submitInquiry } from './inquiry-transport.js';
const form = document.getElementById('inquiry-form');
const formView = document.getElementById('form-view');
const success = document.getElementById('success-view');
const submitButton = form.querySelector('[type="submit"]');
const submitError = document.getElementById('submit-error');
let submitting = false;
const lang = () => window.mossLanguage?.() || 'ko';
const copy = (ko,en) => lang() === 'en' ? en : ko;
const selectedLabel = () => options.find(o => o.dataset.value === serviceValue.value)?.querySelector('.option-label').textContent || copy('선택해주세요','Please select');
function refreshLanguage() {
 document.getElementById('service-text').textContent = selectedLabel();
 document.getElementById('chosen-service').textContent = selectedLabel();
 document.getElementById('success-files').textContent = attachments.files().map(f => f.name).join(', ') || copy('없음','None');
 submitButton.innerHTML = '<span>' + (submitting ? copy('보내는 중…','Sending…') : copy('문의 보내기','Send inquiry')) + '</span><span aria-hidden="true">↗</span>';
 submitError.textContent = copy('문의를 보내지 못했습니다. 작성한 내용은 유지되어 있습니다. 잠시 후 다시 시도하거나 moss.solutions25@gmail.com으로 연락해주세요.','We couldn’t send your inquiry. Your entries have been kept. Please try again or email moss.solutions25@gmail.com.');
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
  } catch {
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
