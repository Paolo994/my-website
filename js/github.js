/*
 * Live GitHub projects for the Lab: every public, non-fork repository appears automatically.
 * Source: the backend (/api/projects, cached and enriched with README summaries); if there is no
 * backend (e.g. GitHub Pages only), the public GitHub API is called directly from the browser.
 */
(function () {
  'use strict';

  const USER = 'Paolo994';
  // repositories that already have a hand-written card in the Lab
  const CURATED = ['fridge_manager', 'my-website'];
  const API = (window.SITE_CONFIG && window.SITE_CONFIG.apiBase) || '';

  let request = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pretty = (name) => name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : null);

  function fromGitHub(repos) {
    return repos.filter((r) => !r.fork && !r.archived).map((r) => ({
      name: r.name, description: r.description, language: r.language, topics: r.topics || [],
      url: r.html_url, homepage: r.homepage, pushedAt: r.pushed_at, stars: r.stargazers_count
    }));
  }

  function load() {
    if (!request) {
      request = fetch(API + '/api/projects')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((list) => (list.length ? list : Promise.reject('empty')))
        .catch(() => fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`)
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then(fromGitHub))
        .catch(() => null);
    }
    return request;
  }

  function card(p, lang) {
    const it = lang === 'it';
    const date = p.pushedAt ? new Date(p.pushedAt).toLocaleDateString(it ? 'it-IT' : 'en-GB', { month: 'short', year: 'numeric' }) : '';
    const tags = [p.language, ...(p.topics || [])].filter(Boolean);
    const url = safeUrl(p.url), home = safeUrl(p.homepage);
    return `
      <div class="card gh-card">
        <div class="card-head">
          <h3>📦 ${esc(pretty(p.name))}</h3>
          <span>${home ? `<a href="${esc(home)}" target="_blank" rel="noopener">${it ? 'Demo' : 'Live'} ↗</a> · ` : ''}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">GitHub ↗</a>` : ''}</span>
        </div>
        <p>${p.description ? esc(p.description) : `<span class="meta">${it ? 'Nessuna descrizione ancora.' : 'No description yet.'}</span>`}</p>
        <div class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        <p class="meta">${it ? 'Ultimo aggiornamento' : 'Last updated'}: ${esc(date)}${p.stars ? ` · ★ ${p.stars}` : ''}</p>
      </div>`;
  }

  window.GitHubProjects = {
    /** Fill every [data-gh-projects] placeholder inside root. */
    fill(root, lang) {
      const slots = root.querySelectorAll('[data-gh-projects]');
      if (!slots.length) return;
      load().then((list) => {
        const extra = (list || []).filter((p) => !CURATED.includes(p.name));
        const html = list === null
          ? `<p class="meta">${lang === 'it' ? 'GitHub non è raggiungibile ora.' : 'GitHub is not reachable right now.'} <a href="https://github.com/${USER}" target="_blank" rel="noopener">github.com/${USER} ↗</a></p>`
          : extra.length
            ? extra.map((p) => card(p, lang)).join('')
            : `<p class="meta">${lang === 'it' ? 'Nessun altro progetto pubblico per ora.' : 'No other public projects yet.'}</p>`;
        slots.forEach((s) => { s.innerHTML = html; });
      });
    }
  };
})();
