/*
 * Side projects in the Lab: ONE list with every public, non-fork GitHub repository,
 * most recently updated first. Repos with a hand-written card (SITE.PROJECTS in content.js)
 * use that card; every other repo gets an automatic card built from its GitHub data.
 *
 * Source: the backend (/api/projects, cached and enriched with README summaries); if there is no
 * backend (e.g. GitHub Pages only), the public GitHub API is called directly from the browser.
 * Until the list arrives (or if GitHub is unreachable) the hand-written cards are shown alone.
 */
(function () {
  'use strict';

  const USER = 'Paolo994';
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

  function autoCard(p, lang) {
    const it = lang === 'it';
    const tags = [p.language, ...(p.topics || [])].filter(Boolean);
    const url = safeUrl(p.url), home = safeUrl(p.homepage);
    const links = [
      home ? `<a href="${esc(home)}" target="_blank" rel="noopener">${it ? 'Demo' : 'Live'} ↗</a>` : '',
      url ? `<a href="${esc(url)}" target="_blank" rel="noopener">GitHub ↗</a>` : ''
    ].filter(Boolean).join(' · ');
    return `
      <div class="card">
        <div class="card-head"><h3>📦 ${esc(pretty(p.name))}</h3><span>${links}</span></div>
        <p>${p.description ? esc(p.description) : `<span class="meta">${it ? 'Nessuna descrizione ancora.' : 'No description yet.'}</span>`}</p>
        <div class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      </div>`;
  }

  window.GitHubProjects = {
    /** Fill every [data-gh-projects] list inside root. */
    fill(root, lang) {
      const slots = root.querySelectorAll('[data-gh-projects]');
      if (!slots.length) return;
      const curated = (window.SITE && window.SITE.PROJECTS) || {};
      const s = (en, it) => (lang === 'it' ? it : en);
      load().then((list) => {
        if (!list) return; // GitHub unreachable: keep the hand-written cards already on the page
        const seen = new Set();
        const cards = list.map((p) => {
          seen.add(p.name);
          return curated[p.name] ? curated[p.name](s) : autoCard(p, lang);
        });
        // hand-written cards whose repo isn't in the list (renamed, made private...) stay at the end
        Object.keys(curated).filter((n) => !seen.has(n)).forEach((n) => cards.push(curated[n](s)));
        slots.forEach((slot) => { slot.innerHTML = cards.join(''); });
      });
    }
  };
})();
