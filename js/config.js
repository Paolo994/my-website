/*
 * Where the assistant backend lives.
 * - Served by the Spring Boot container (locally on :8787, or behind Caddy in production): same origin.
 * - Opened as a file or from a local dev server (IntelliJ, VS Code Live Server, npx serve): the local
 *   backend on http://localhost:8787.
 * - Site on GitHub Pages and backend elsewhere: put the backend URL in apiBase, e.g. 'https://api.example.com'.
 * If the backend can't be reached, the site works as before and simply hides the chat button.
 */
window.SITE_CONFIG = {
  apiBase: (function () {
    const DEV_SERVER_PORTS = ['3000', '5500', '63342'];
    if (location.protocol === 'file:') return 'http://localhost:8787';
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return local && DEV_SERVER_PORTS.includes(location.port) ? 'http://localhost:8787' : '';
  })()
};
