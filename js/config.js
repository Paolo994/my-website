/*
 * Where the assistant backend lives.
 * - Same origin (site served by the Spring Boot container): leave apiBase empty.
 * - Site on GitHub Pages and backend elsewhere: put the backend URL here, e.g. 'https://paolo-site.fly.dev'.
 * If the backend can't be reached, the site works as before and simply hides the chat button.
 */
window.SITE_CONFIG = {
  apiBase: (function () {
    const h = location.hostname;
    const local = location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1';
    return local && location.port !== '8787' ? 'http://localhost:8787' : '';
  })()
};
