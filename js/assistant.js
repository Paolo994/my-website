/*
 * "Ask about me": a chat drawer that talks to the Spring Boot assistant (/api/ask).
 * The conversation lives only in memory; the last few turns are sent along for context.
 */
(function () {
  'use strict';

  const API = (window.SITE_CONFIG && window.SITE_CONFIG.apiBase) || '';
  const MAX_TURNS = 6;
  const $ = (sel) => document.querySelector(sel);

  let opts = null;           // callbacks from app.js
  let history = [];          // [{role, text}]
  let pending = false;
  let available = false;

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // tiny, safe formatter: escape everything, then allow **bold**, "- " bullets, emails and line breaks
  function format(text) {
    const lines = esc(text).split(/\n/);
    let html = '', inList = false;
    for (const raw of lines) {
      const line = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');
      const m = line.match(/^\s*[-•]\s+(.*)$/);
      if (m) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${m[1]}</li>`; continue; }
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += `<p>${line}</p>`;
    }
    return html + (inList ? '</ul>' : '');
  }

  function ui() { return opts.ui(); }

  function addMessage(role, text, section) {
    const log = $('#ask-log');
    const el = document.createElement('div');
    el.className = 'msg msg-' + role;
    el.innerHTML = role === 'user' ? `<p>${esc(text)}</p>` : format(text);
    if (section) {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost msg-go';
      b.textContent = `${ui().askGo} → ${opts.sectionTitle(section)}`;
      b.addEventListener('click', () => { close(); opts.goTo(section); });
      el.appendChild(b);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function renderStatic() {
    if (!opts) return;
    const u = ui();
    $('#ask-input').placeholder = u.askPlaceholder;
    $('#ask-suggest').innerHTML = u.askSuggest.map((q) => `<button type="button">${esc(q)}</button>`).join('');
    if (!history.length) {
      $('#ask-log').innerHTML = '';
      addMessage('assistant', u.askHello);
    }
  }

  async function send(question) {
    question = question.trim();
    if (!question || pending) return;
    pending = true;
    $('#ask-form').classList.add('busy');
    $('#ask-suggest').hidden = true;
    addMessage('user', question);
    const typing = addMessage('assistant', ui().askThinking);
    typing.classList.add('typing');

    try {
      // 1) network: only a failure here really means "offline"
      let res;
      try {
        res = await fetch(API + '/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, history: history.slice(-MAX_TURNS) })
        });
      } catch (networkError) {
        typing.remove();
        addMessage('assistant', ui().askErr.offline);
        return;
      }
      typing.remove();

      // 2) HTTP errors from the backend
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = ui().askErr;
        addMessage('assistant', res.status === 429 ? e.rate : err.error === 'daily_limit' ? e.daily : res.status === 503 ? e.offline : e.generic);
        return;
      }

      // 3) a good answer: show it even if the "Show me" link can't be built
      const data = await res.json();
      let section = data.section;
      try { opts.sectionTitle(section); } catch (e) { section = null; }
      addMessage('assistant', data.answer, section);
      history.push({ role: 'user', text: question }, { role: 'assistant', text: data.answer.slice(0, 2000) });
    } catch (e) {
      console.error('Assistant reply could not be shown', e);
      addMessage('assistant', ui().askErr.generic);
    } finally {
      pending = false;
      $('#ask-form').classList.remove('busy');
      $('#ask-input').focus();
    }
  }

  function open() {
    if (!available) return;
    $('#ask').hidden = false;
    document.body.classList.add('ask-open');
    opts.onOpen();
    setTimeout(() => $('#ask-input').focus(), 50);
  }
  function close() {
    if ($('#ask').hidden) return;
    $('#ask').hidden = true;
    document.body.classList.remove('ask-open');
    opts.onClose();
  }

  window.Assistant = {
    init(o) {
      opts = o;
      renderStatic();
      $('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#ask-input'); const q = i.value; i.value = ''; send(q); });
      $('#ask-suggest').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) send(b.textContent); });
      $('#ask-fab').addEventListener('click', open);
      $('#ask .x').addEventListener('click', close);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#ask').hidden) { e.stopImmediatePropagation(); close(); } }, true);

      // Only show the button if the backend is reachable and has an API key configured.
      fetch(API + '/api/assistant').then((r) => (r.ok ? r.json() : null)).then((s) => {
        if (s && s.enabled) {
          available = true;
          $('#ask-fab').hidden = false;
          if (s.maxQuestionLength) $('#ask-input').maxLength = s.maxQuestionLength;
        }
      }).catch(() => { /* no backend: the site works without the assistant */ });
    },
    setLang() { renderStatic(); },
    open,
    close,
    isOpen() { return !$('#ask').hidden; }
  };
})();
