/*
 * include-sections.js
 * ---------------------------------------------------------------
 * Fetches each HTML fragment in /sections and injects it into its
 * matching mount point in index.html, in order, then dispatches a
 * "sections:ready" event on `document` once every fragment has been
 * injected (or has failed, so a single missing file can't hang the
 * whole page forever).
 *
 * IMPORTANT — this only works when the site is served over HTTP(S),
 * e.g. via `python3 -m http.server`, VS Code Live Server, Netlify,
 * GitHub Pages, or any real web host. Opening index.html directly
 * as a file:// URL will cause every fetch() call below to fail,
 * because browsers block local-file fetches for security reasons.
 * If you see a blank page when double-clicking index.html, that is
 * why — run a local server instead.
 * ---------------------------------------------------------------
 */
(function () {
  // Map of mount point id -> section file to load into it.
  const SECTIONS = [
    ['navbar-mount', 'sections/nav.html'],
    ['mobilemenu-mount', 'sections/mobilemenu.html'],
    ['hero-mount', 'sections/hero.html'],
    ['booking-mount', 'sections/booking.html'],
    ['rooms-mount', 'sections/rooms.html'],
    ['dining-mount', 'sections/dining.html'],
    ['meetings-mount', 'sections/meetings.html'],
    ['rooftop-mount', 'sections/rooftop.html'],
    ['neighborhood-mount', 'sections/neighborhood.html'],
    ['reviews-mount', 'sections/reviews.html'],
    ['gallery-mount', 'sections/gallery.html'],
    ['contact-mount', 'sections/contact.html'],
    ['footer-mount', 'sections/footer.html'],
  ];

  async function loadSection(mountId, path) {
    const mount = document.getElementById(mountId);
    if (!mount) return; // mount point not present on this page — skip quietly
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${path} responded with ${res.status}`);
      const html = await res.text();
      mount.outerHTML = html; // replace the placeholder div with the real markup
    } catch (err) {
      console.error('[include-sections] failed to load', path, err);
      mount.outerHTML = `<!-- failed to load ${path}: ${String(err.message || err)} -->`;
    }
  }

  async function loadAll() {
    // Sections are loaded in parallel for speed, but Promise.all ensures
    // we only signal "ready" once every single one has resolved (success
    // or caught failure) — script.js must never start before this point.
    await Promise.all(SECTIONS.map(([id, path]) => loadSection(id, path)));
    document.dispatchEvent(new CustomEvent('sections:ready'));
  }

  loadAll();
})();
