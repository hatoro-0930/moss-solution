(() => {
  let language = 'ko';
  try { if (localStorage.getItem('moss-language') === 'en') language = 'en'; } catch {}
  window.mossLanguage = () => language;
  function apply(next) {
    language = next === 'en' ? 'en' : 'ko';
    document.documentElement.lang = language;
    document.querySelectorAll('[data-ko][data-en]').forEach(el => { const lines = el.dataset[language].split('\n');
      if (lines.length === 1) { el.textContent = lines[0]; return; }
      el.replaceChildren(...lines.map(line => {
        const span = document.createElement('span');
        span.className = 'copy-line';
        span.textContent = line;
        return span;
      })); });
    document.querySelectorAll('[data-ph-ko]').forEach(el => { el.placeholder = language === 'en' ? el.dataset.phEn : el.dataset.phKo; });
    document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === language)));
    const description = document.querySelector('meta[name="description"]');
    description.content = language === 'en' ? 'From shaping your idea to circuit design and PCB layout. moss solution.' : '아이디어 구체화부터 회로 설계와 PCB 레이아웃까지. moss solution.';
    try { localStorage.setItem('moss-language',language); } catch {}
    document.dispatchEvent(new Event('languagechange'));
  }
  document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => apply(button.dataset.lang)));
  apply(language);
})();
