/*
 * Page glue: language, start screen, map mode vs classic mode, section panel, menu.
 */
(function () {
  'use strict';

  const { UI, SECTIONS, LINKS, CASES } = window.SITE;
  const Game = window.Game;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const byId = Object.fromEntries(SECTIONS.map((x) => [x.id, x]));

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  };

  let lang = pickLang();
  let mode = 'start';
  let panelId = null;
  let nearId = null;
  let celebrated = false;
  let pendingItem = null; // case study to open once the bike reaches the building
  const visited = new Set((store.get('visited') || '').split(',').filter((id) => byId[id]));

  function pickLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'it' || q === 'en') return q;
    const saved = store.get('lang');
    if (saved === 'it' || saved === 'en') return saved;
    return 'en'; // English first for everyone; Italian is one click away
  }
  const s = (en, it) => (lang === 'it' ? it : en);
  const ui = (key) => UI[lang][key];

  // ------------------------------------------------------------ language
  function applyTexts() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = ui(el.dataset.i18n); });
    $$('[data-i18n-device]').forEach((el) => { el.textContent = ui(el.dataset.i18nDevice)[isTouch ? 'touch' : 'desktop']; });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $$('[data-cv]').forEach((a) => { a.href = LINKS.cv; });
    renderClassic();
    renderMenu();
    if (panelId) fillPanel(panelId);
    updateProgress();
    updatePrompt();
  }
  function applyMapLabels() {
    Game.setLabels(Object.fromEntries(SECTIONS.map((x) => [x.id, x.sign[lang]])), lang);
  }
  function setLang(l) {
    if (l === lang) return;
    lang = l; store.set('lang', l);
    applyTexts(); applyMapLabels();
    window.Assistant.setLang();
  }

  // ------------------------------------------------------------ classic view
  function renderClassic() {
    $('#classic-nav').innerHTML = SECTIONS.map((x) =>
      `<a href="#sec-${x.id}" data-scroll="${x.id}"><span aria-hidden="true">${x.icon}</span>${x.title[lang]}</a>`).join('');
    $('#classic-sections').innerHTML = SECTIONS.map((x) => `
      <section class="csec" id="sec-${x.id}">
        <h2><span class="csec-icon" aria-hidden="true">${x.icon}</span>${x.title[lang]}</h2>
        ${x.render(s)}
      </section>`).join('');
    $('#year').textContent = new Date().getFullYear();
  }
  function scrollToSection(id) {
    const el = document.getElementById('sec-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ------------------------------------------------------------ fast-travel menu
  function renderMenu() {
    $('#menu-list').innerHTML = SECTIONS.map((x) => `
      <li><button data-menu="${x.id}">
        <span class="mi-icon" aria-hidden="true">${x.icon}</span>
        <span class="mi-text"><b>${x.title[lang]}</b><small>${x.sign[lang]}</small></span>
        <span class="mi-state" aria-hidden="true">${visited.has(x.id) ? '✔' : '!'}</span>
      </button></li>`).join('');
  }
  function openMenu() { renderMenu(); $('#menu').hidden = false; Game.pause(true); $('#menu button[data-menu]').focus(); }
  function closeMenu(resume = true) { $('#menu').hidden = true; if (resume && mode === 'game' && !panelId) Game.pause(false); }

  // ------------------------------------------------------------ section panel
  function fillPanel(id) {
    const x = byId[id];
    $('#panel-icon').textContent = x.icon;
    $('#panel-title').textContent = x.title[lang];
    $('#panel-body').innerHTML = x.render(s);
  }
  function openPanel(id) {
    if (!byId[id]) return;
    panelId = id;
    fillPanel(id);
    $('#panel').hidden = false;
    $('#panel-body').scrollTop = 0;
    Game.pause(true);
    markVisited(id);
    $('#panel .x').focus();
    if (pendingItem) {
      const item = pendingItem;
      pendingItem = null;
      requestAnimationFrame(() => focusCase($('#panel-body'), item));
    }
  }
  function closePanel() {
    if (!panelId) return;
    panelId = null;
    $('#panel').hidden = true;
    if (mode === 'game') { Game.pause(false); $('#world').focus({ preventScroll: true }); }
  }
  function nextStop() {
    const tour = Game.tour, from = tour.indexOf(panelId);
    let next = null;
    for (let i = 1; i <= tour.length; i++) {
      const id = tour[(from + i) % tour.length];
      if (!visited.has(id)) { next = id; break; }
    }
    if (!next) next = tour[(from + 1) % tour.length];
    closePanel();
    Game.driveTo(next, true);
  }

  // ------------------------------------------------------------ progress
  function markVisited(id) {
    if (visited.has(id)) return;
    visited.add(id);
    store.set('visited', Array.from(visited).join(','));
    Game.setVisited(visited);
    updateProgress();
    if (visited.size === SECTIONS.length && !celebrated) { celebrated = true; setTimeout(() => toast(ui('allFound')), 400); }
  }
  function updateProgress() { $('#progress').textContent = `${visited.size}/${SECTIONS.length}`; }
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 6000);
  }

  // ------------------------------------------------------------ near-building prompt
  function updatePrompt() {
    const p = $('#prompt');
    if (!nearId || mode !== 'game') { p.hidden = true; return; }
    const x = byId[nearId];
    p.innerHTML = `${x.icon} ${ui('enter')}: <b>${x.title[lang]}</b>${isTouch ? '' : ' <kbd>E</kbd>'}`;
    p.hidden = false;
  }

  // ------------------------------------------------------------ modes
  function setMode(m) {
    mode = m;
    document.body.className = 'mode-' + m;
    closeMenu(false);
    if (panelId) { panelId = null; $('#panel').hidden = true; }
    if (m === 'game') { Game.start(); $('#world').focus({ preventScroll: true }); }
    else Game.stop();
    if (m === 'classic') window.scrollTo(0, 0);
    const hash = m === 'classic' ? '#classic' : m === 'game' ? '#ride' : '';
    history.replaceState(null, '', location.pathname + location.search + hash);
    updatePrompt();
  }

  // ------------------------------------------------------------ events
  document.addEventListener('click', (e) => {
    const langBtn = e.target.closest('[data-lang]');
    if (langBtn) { setLang(langBtn.dataset.lang); return; }

    const act = e.target.closest('[data-action]');
    if (act) {
      const a = act.dataset.action;
      if (a !== 'home' || mode !== 'start') e.preventDefault();
      if (a === 'ride') setMode('game');
      else if (a === 'classic') setMode('classic');
      else if (a === 'home') setMode('start');
      else if (a === 'menu') openMenu();
      else if (a === 'close-menu') closeMenu();
      else if (a === 'close-panel') closePanel();
      else if (a === 'next-zone') nextStop();
      return;
    }

    const m = e.target.closest('[data-menu]');
    if (m) {
      closeMenu(false);
      if (mode !== 'game') setMode('game');
      Game.pause(false);
      Game.driveTo(m.dataset.menu, true);
      return;
    }

    const go = e.target.closest('[data-goto]');
    if (go) {
      e.preventDefault();
      if (mode === 'classic') scrollToSection(go.dataset.goto);
      else { closePanel(); Game.driveTo(go.dataset.goto, true); }
      return;
    }

    const sc = e.target.closest('[data-scroll]');
    if (sc) { e.preventDefault(); scrollToSection(sc.dataset.scroll); return; }

    if (e.target.id === 'panel') closePanel();
    if (e.target.id === 'menu') closeMenu();
  });

  $('#prompt').addEventListener('click', () => nearId && openPanel(nearId));

  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') {
      if (!$('#menu').hidden) closeMenu();
      else if (panelId) closePanel();
    } else if ((e.key === 'm' || e.key === 'M') && mode === 'game' && !panelId && $('#menu').hidden) {
      openMenu();
    }
  });

  // ------------------------------------------------------------ boot
  Game.init({
    canvas: $('#world'),
    minimap: $('#minimap'),
    onNear(id) { nearId = id; updatePrompt(); },
    onArrive(id) { openPanel(id); }
  });
  Game.setVisited(visited);

  // Targets look like "experience" or, for a single case study, "cases/kafka".
  function parseTarget(target) {
    const [id, item] = String(target).split('/');
    return { id, item: item || null };
  }
  function targetTitle(target) {
    const { id, item } = parseTarget(target);
    const c = item && CASES.find((x) => x.id === item);
    if (c) return c.title[lang];
    if (byId[id]) return byId[id].title[lang];
    throw new Error('Unknown section: ' + target);
  }

  // Open one case study and collapse the others, inside the given container.
  function focusCase(root, caseId) {
    const target = root.querySelector(`details.case[data-case="${caseId}"]`);
    if (!target) return;
    root.querySelectorAll('details.case').forEach((d) => { d.open = d === target; });
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('flash');
    setTimeout(() => target.classList.remove('flash'), 1600);
  }

  // Called by the assistant's "Show me" button.
  function goTo(target) {
    const { id, item } = parseTarget(target);
    if (!byId[id]) return;
    if (mode === 'classic') {
      if (item) focusCase($('#sec-' + id), item); else scrollToSection(id);
      return;
    }
    if (mode !== 'game') setMode('game');
    closePanel(); closeMenu(false);
    pendingItem = item;
    Game.pause(false);
    Game.driveTo(id, true);
  }
  window.Assistant.init({
    ui: () => UI[lang],
    sectionTitle: targetTitle,
    goTo,
    onOpen() { Game.pause(true); },
    onClose() { if (mode === 'game' && !panelId && $('#menu').hidden) Game.pause(false); }
  });

  applyTexts();

  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('8px "Press Start 2P"'), new Promise((r) => setTimeout(r, 2500))])
    : Promise.resolve();
  fontReady.catch(() => {}).then(applyMapLabels);

  if (location.hash === '#classic') setMode('classic');
  else if (location.hash === '#ride') setMode('game');
  else setMode('start');
})();
