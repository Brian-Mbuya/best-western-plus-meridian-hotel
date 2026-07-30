/*
 * script.js
 * ---------------------------------------------------------------
 * All logic below is wrapped in a single init() function that only
 * runs after include-sections.js has finished injecting every HTML
 * fragment and fired the "sections:ready" event on `document`.
 *
 * The PAGE INTRO dismissal is handled by an inline <script> in
 * index.html so it cannot be blocked by caching or defer timing.
 * ---------------------------------------------------------------
 */

/*
 * Start init() once every section fragment is in the DOM.
 *
 * Prefers the promise published by include-sections.js; the event listener is
 * a fallback for the case where an older include-sections.js is cached and
 * does not publish it. runInit() is idempotent, so both firing is harmless.
 */
let initHasRun = false;

function runInit() {
  if (initHasRun) return;
  initHasRun = true;
  // One broken feature must not take the rest of the page down with it.
  try {
    init();
  } catch (err) {
    console.error('[script] init() failed:', err);
  } finally {
    document.documentElement.classList.add('reveal-ready');
  }
}

if (window.sectionsReady && typeof window.sectionsReady.then === 'function') {
  window.sectionsReady.then(runInit, runInit);
} else {
  document.addEventListener('sections:ready', runInit);
}

/*
 * Watchdog. The reveal styles hide content until JS reveals it, so the one
 * unacceptable outcome is "still hidden forever". Two failures cause it:
 *
 *   1. init() never ran            -> .reveal-ready missing.
 *   2. init() ran but the observer never DELIVERS. IntersectionObserver
 *      callbacks are dispatched as part of the frame lifecycle, so an
 *      environment that suspends rendering (backgrounded/prerendered tab,
 *      some embedded webviews) wires it up fine and then never fires it.
 *      Only checking the outcome catches that.
 */
function checkForStrandedContent() {
  const de = document.documentElement;
  if (de.classList.contains('no-reveal')) return true;

  if (!de.classList.contains('reveal-ready')) {
    console.warn('[script] reveal engine never started — showing all content.');
    de.classList.add('no-reveal');
    return true;
  }

  const vh = window.innerHeight;
  const stranded = Array.prototype.filter.call(
    document.querySelectorAll('.fade-up, .fade-in, .mask-reveal, .accent-line'),
    function (el) {
      if (el.classList.contains('visible')) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;   // display:none / filtered
      return r.top < vh * 0.9 && r.bottom > 0;             // genuinely on screen
    }
  );

  if (stranded.length) {
    console.warn('[script] ' + stranded.length + ' element(s) on screen never ' +
      'revealed — IntersectionObserver is not delivering. Showing all content.');
    de.classList.add('no-reveal');
    return true;
  }
  return false;
}

setTimeout(checkForStrandedContent, 3000);

/*
 * Re-check after the user scrolls. The 3s check samples one scroll position;
 * at the top of the page nearly every target is legitimately still below the
 * fold, so a totally dead observer looks identical to a healthy one. Sampling
 * again after scrolling catches it. Time-boxed rather than count-boxed —
 * a fixed budget gets burned by early checks that pass near the top.
 */
(function watchScrollForStrandedContent() {
  const DEADLINE = performance.now() + 20000;
  let pending = false;

  function onScroll() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      // Give the observer a beat to fire for newly-visible elements first.
      if (checkForStrandedContent() || performance.now() > DEADLINE) {
        window.removeEventListener('scroll', onScroll);
      }
    }, 900);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();


function init() {
  // ─── NAVBAR ───────────────────────────────────────────
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  let menuOpen = false;

  // Every lookup below is null-guarded. include-sections.js is built to
  // survive a fragment that fails to load (it logs and continues), but
  // init() used to dereference these blind — so one missing fragment threw
  // here and killed every feature further down the file.

  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
    // Apply immediately, in case the page was restored mid-scroll.
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }

  function setMenu(open) {
    menuOpen = open;
    if (hamburger) {
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    }
    if (mobileMenu) mobileMenu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => setMenu(!menuOpen));
  }

  // Close mobile menu on nav link click
  document.querySelectorAll('[data-mobile-page]').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
  });

  // ─── SCROLL REVEAL ENGINE ──────────────────────────────
  /*
   * One observer drives every reveal on the page.
   *
   * Stagger is a CSS transition-delay (via the --reveal-delay custom
   * property) rather than a setTimeout per element. Two reasons:
   *
   *   1. setTimeout stagger keeps firing after the user has scrolled past,
   *      so fast-scrolling a long page queues dozens of pending callbacks
   *      that pop elements in long after they left the viewport.
   *   2. Delays live on the compositor alongside the transition, so they
   *      stay in sync with it instead of drifting under load.
   *
   * The hiding styles are now keyed off `html.js` (set inline in <head>)
   * rather than a `.js-animations` class added here, so content is never
   * hidden during the window between first paint and init() running.
   */
  const REVEAL_SELECTOR = '.fade-up, .fade-in, .mask-reveal, .accent-line';

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;

      // Explicit data-delay (seconds) wins; otherwise use the auto-assigned
      // sibling index so groups cascade instead of arriving as one slab.
      const explicit = parseFloat(el.dataset.delay);
      if (!Number.isNaN(explicit)) {
        el.style.setProperty('--reveal-delay', Math.round(explicit * 1000) + 'ms');
      } else if (el.dataset.revealIndex) {
        el.style.setProperty('--reveal-delay', el.dataset.revealIndex * 90 + 'ms');
      }

      el.classList.add('visible');
      revealObserver.unobserve(el);

      el.addEventListener('transitionend', function done(e) {
        if (e.target !== el) return;          // ignore bubbling child transitions
        el.classList.add('reveal-done');
        el.style.removeProperty('--reveal-delay');
        el.removeEventListener('transitionend', done);
      });
    });
  }, {
    threshold: 0.12,
    // Begin slightly before the element reaches the fold so it is already
    // settling by the time it sits comfortably on screen.
    rootMargin: '0px 0px -12% 0px',
  });

  // Auto-stagger: number each element among its reveal-siblings so card grids
  // and stat rows cascade without hand-authored data-delay values.
  const staggerGroups = new Map();
  document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
    if (el.closest('.hero')) return;          // hero runs on the intro timeline
    const parent = el.parentElement;
    if (parent && !el.dataset.delay) {
      const n = staggerGroups.get(parent) || 0;
      // Cap the cascade: past ~5 items the tail reads as lag, not rhythm.
      el.dataset.revealIndex = Math.min(n, 5);
      staggerGroups.set(parent, n + 1);
    }
    revealObserver.observe(el);
  });

  // ─── HERO & NAV ENTRANCE ORCHESTRATION ────────────────
  /*
   * Driven by the introComplete promise published by the inline controller in
   * index.html, so this runs correctly whether the intro is still playing,
   * already finished, or was skipped entirely. The previous version listened
   * for an 'intro:finished' event from inside init() — if sections loaded
   * slowly the event fired first, was missed, and the hero stayed invisible.
   */
  function playEntranceSequence() {
    // Dropping .nav-armed lets the navbar transition back to its resting
    // (visible) position. If it was never armed this is a harmless no-op.
    if (navbar) navbar.classList.remove('nav-armed');

    document.querySelectorAll('.hero .fade-up, .hero .fade-in').forEach((el) => {
      const delay = parseFloat(el.dataset.delay) || 0;
      el.style.setProperty('--reveal-delay', Math.round(delay * 1000) + 'ms');
      el.classList.add('visible');
    });
  }

  // Arm the navbar only while the intro is genuinely on screen, so it can
  // drop in behind the rising panel.
  const introEl = document.getElementById('page-intro');
  if (navbar && introEl && !introEl.hidden) navbar.classList.add('nav-armed');

  // .catch is not decorative: if the intro controller ever rejects, the hero
  // must still be revealed rather than left at opacity 0.
  if (window.introComplete && typeof window.introComplete.then === 'function') {
    window.introComplete.then(playEntranceSequence).catch(playEntranceSequence);
  } else {
    playEntranceSequence();
  }


  // ─── HERO SLIDESHOW ─────────────────────────────────────
  // Pure crossfade — no zoom, no parallax. Just clean hotel photography.
  // Transitions are handled entirely via CSS opacity on .active class.
  (function initHeroSlideshow() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');

    if (!slides.length) return;

    const INTERVAL = 7500;   // ms between auto-advances
    const TOTAL = slides.length;
    let current = 0;
    let timer = null;
    let paused = false;

    function goTo(index) {
      // Clamp / wrap
      index = ((index % TOTAL) + TOTAL) % TOTAL;

      // dots[] is indexed by slide, but the two lists live in different
      // parts of hero.html and can drift apart. Guard rather than throw — a
      // missing dot must not stop the slideshow from advancing.
      const prevDot = dots[current];
      if (prevDot) {
        prevDot.classList.remove('active');
        prevDot.removeAttribute('aria-current');
      }
      slides[current].classList.remove('active');

      current = index;
      slides[current].classList.add('active');

      const nextDot = dots[current];
      if (nextDot) {
        nextDot.classList.add('active');
        nextDot.setAttribute('aria-current', 'true');
      }
    }

    function advance() {
      if (!paused) goTo(current + 1);
    }

    function startTimer() {
      clearInterval(timer);
      timer = setInterval(advance, INTERVAL);
    }

    // Dot click — jump to that slide
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.dot, 10);
        goTo(idx);
        startTimer(); // reset interval so we don't immediately advance
      });
    });

    // Pause on hover/focus so users can read copy
    const heroEl = document.querySelector('.hero');
    if (heroEl) {
      heroEl.addEventListener('mouseenter', () => { paused = true; });
      heroEl.addEventListener('mouseleave', () => { paused = false; });
      heroEl.addEventListener('focusin', () => { paused = true; });
      heroEl.addEventListener('focusout', () => { paused = false; });
    }

    // Preload slide 2 immediately so the first transition is instant
    const img2 = slides[1]?.querySelector('img');
    if (img2 && img2.loading === 'lazy') {
      img2.loading = 'eager';
    }

    startTimer();
  })();

  // Hero "Contact Us" → arrival effect on the contact section
  /*
   * This previously waited on a MutationObserver watching document.body for
   * the sections to appear. By the time init() runs they are ALREADY in the
   * DOM, and a MutationObserver only reports *future* mutations — so it
   * should never have fired. It worked purely by accident, because
   * renderExplorer() later rewrote some innerHTML and tripped the observer.
   * Any change to the explorer would have silently broken it.
   *
   * init() already runs after sections:ready, so wire it directly.
   */
  (function initHeroContactScroll() {
    const scrollBtn = document.getElementById('heroContactScrollBtn');
    const contactSection = document.getElementById('contact');
    if (!scrollBtn || !contactSection) return;

    let arrivalPlayed = false;
    const arrivalObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || arrivalPlayed) return;
        arrivalPlayed = true;
        contactSection.classList.add('contact-arrival-effect');
        setTimeout(() => contactSection.classList.remove('contact-arrival-effect'), 1000);
        arrivalObserver.disconnect();
      });
    }, { threshold: 0.2 });

    // Arm the effect on click, then let the shared smooth-scroll handler plus
    // html{scroll-padding-top} do the scrolling — no manual offset maths, so
    // the heading clears the fixed navbar like every other anchor.
    scrollBtn.addEventListener('click', () => arrivalObserver.observe(contactSection));
  })();

  // ─── BOOKING WIDGET ────────────────────────────────────
  const checkinInput = document.getElementById('checkin');
  const checkoutInput = document.getElementById('checkout');
  const availBtn = document.getElementById('check-avail-btn');

  if (checkinInput && checkoutInput) {
    // Dates are formatted from local calendar parts, NOT toISOString().
    // toISOString() converts to UTC first, so for anyone east of Greenwich —
    // Nairobi is UTC+3 — an evening visit rolled the date forward a day and
    // the widget opened pre-set to the wrong night.
    const fmt = (d) =>
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');

    const addDays = (d, n) => {
      const out = new Date(d);
      out.setDate(out.getDate() + n);
      return out;
    };

    const today = new Date();

    checkinInput.min = fmt(today);
    checkinInput.value = fmt(addDays(today, 1));
    checkoutInput.min = fmt(addDays(today, 2));
    checkoutInput.value = fmt(addDays(today, 2));

    checkinInput.addEventListener('change', () => {
      if (!checkinInput.value) return;
      // Parse as local midnight; `new Date('2026-07-30')` parses as UTC and
      // reintroduces the same off-by-one on comparison.
      const [y, m, d] = checkinInput.value.split('-').map(Number);
      const nextDay = addDays(new Date(y, m - 1, d), 1);

      checkoutInput.min = fmt(nextDay);
      if (!checkoutInput.value || checkoutInput.value <= checkinInput.value) {
        checkoutInput.value = fmt(nextDay);
      }
    });
  }

  if (availBtn) {
    availBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const ci = checkinInput ? checkinInput.value : '';
      const co = checkoutInput ? checkoutInput.value : '';
      const guestsEl = document.getElementById('guests');
      const guests = guestsEl ? guestsEl.value : '1';
      if (!ci || !co) { showToast('Please select check-in and check-out dates.'); return; }
      window.open(
        'https://www.bestwestern.com/en_US/book/hotel-rooms.75152.html' +
        `?checkIn=${encodeURIComponent(ci)}&checkOut=${encodeURIComponent(co)}` +
        `&numberOfAdults=${encodeURIComponent(guests)}`,
        '_blank',
        'noopener'
      );
    });
  }

  // ─── NEIGHBORHOOD EXPLORER ─────────────────────────────
  const attractions = {
    landmarks: [
      { name: 'Kenyatta International Convention Centre', dist: '0.4 km', time: '5 min walk', category: 'Landmark', icon: 'building', desc: 'Nairobi\'s iconic cylindrical tower and convention complex, one of the most recognisable structures in East Africa. A 5-minute walk from the hotel.', maxDist: 5, img: 'gallery/attractions/kenya international convention centre.webp' },
      { name: 'Kenya National Archives', dist: '0.75 km', time: '9 min walk', category: 'Historic Site', icon: 'archive', desc: 'Houses Kenya\'s most significant historical documents and a small museum on the ground floor. A short stroll down Moi Avenue.', maxDist: 10, img: 'gallery/attractions/kenya-national-archives-nairobi-africa-B6693N.jpg'},
      { name: 'Anniversary Towers', dist: '0.3 km', time: '4 min walk', category: 'Business Hub', icon: 'office', desc: 'Major government and commercial office complex at the very edge of the CBD. Walking distance.', maxDist: 4, img: 'gallery/attractions/anniversary towers.webp' },
      { name: 'August 7th Memorial Park', dist: '1.1 km', time: '13 min walk', category: 'Memorial', icon: 'park', desc: 'A peace garden and memorial marking the site of the 1998 US Embassy bombing. A significant site of reflection in the city.', maxDist: 15, img: 'gallery/attractions/august-7-memorial-park-us-embassy-bombing-memorial-nairobi-kenya-BWAPED.jpg' },
    ],
    culture: [
      { name: 'Nairobi National Museum', dist: '1.6 km', time: '6 min drive', category: 'Museum', icon: 'museum', desc: 'Kenya\'s flagship natural history and cultural museum. Home to collections on paleontology, ethnography, and fine art.', maxDist: 20, img: null },
      { name: 'Kenya National Theatre', dist: '0.6 km', time: '7 min walk', category: 'Arts', icon: 'theatre', desc: 'Kenya\'s premier performing arts venue, hosting plays, dance, and cultural performances year-round. A short walk from the hotel.', maxDist: 8, img: null },
      { name: 'Nairobi Gallery', dist: '2.4 km', time: '8 min drive', category: 'Gallery', icon: 'art', desc: 'Housed in the former PC\'s office building, Nairobi Gallery is a fine art space with a range of contemporary and traditional Kenyan works.', maxDist: 25, img: null },
    ],
    transport: [
      { name: 'Jomo Kenyatta International Airport', dist: '18 km', time: '25 min drive', category: 'International Airport', icon: 'plane', desc: 'Nairobi\'s main international airport. The hotel offers 24-hour airport transfers by arrangement with the concierge.', maxDist: 100, img: null },
      { name: 'Wilson Airport', dist: '6.7 km', time: '15 min drive', category: 'Domestic Airport', icon: 'plane', desc: 'Kenya\'s domestic aviation hub, serving flights to Maasai Mara, Lamu, and other regional destinations.', maxDist: 60, img: null },
      { name: 'Nairobi CBD Bus Terminus', dist: '0.5 km', time: '6 min walk', category: 'Public Transport', icon: 'bus', desc: 'The main bus and matatu terminus for routes across Nairobi and intercity destinations. Walking distance from the hotel.', maxDist: 6, img: null },
    ],
    parks: [
      { name: 'Jeevanjee Gardens', dist: '0.3 km', time: '4 min walk', category: 'Public Garden', icon: 'park', desc: 'A small but beloved public garden in the heart of the CBD. Ideal for a morning stroll or a quiet lunch break between meetings.', maxDist: 4, img: null },
      { name: 'Uhuru Park', dist: '3.1 km', time: '10 min drive', category: 'City Park', icon: 'park', desc: 'Nairobi\'s central public park beside the CBD, with a lake, boating, and open lawns. A popular weekend destination.', maxDist: 35, img: null },
      { name: 'Nairobi National Park', dist: '24.9 km', time: '35 min drive', category: 'Wildlife Reserve', icon: 'safari', desc: 'The only national park in the world bordering a capital city. Lions, rhino, leopard, and giraffe can be spotted within sight of Nairobi\'s skyline.', maxDist: 100, img: null },
    ],
  };

  let activeCategory = 'landmarks';
  let activeItem = null;

  function getIcon(type) {
    const icons = {
      building: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
      archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
      office: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
      park: '<path d="M17 8C8 10 5.9 16.17 3.82 22h3.72l1-2.1C9.12 20.65 10.54 21 12 21c4 0 7-2.24 7-5 0-1.5-.73-2.82-1.87-3.75C18.77 11 20 9.1 20 7c0-1.66-1.34-3-3-3-1.11 0-2.07.6-2.61 1.5A9 9 0 0 0 12 5C9.24 5 7 7.24 7 10"/>',
      museum: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
      theatre: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
      art: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
      plane: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
      bus: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
      safari: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    };
    return icons[type] || icons.building;
  }

  function renderExplorer() {
    const list = document.getElementById('explorer-list');
    if (!list) return;
    const items = attractions[activeCategory];
    list.innerHTML = items.map((item, i) => `
    <div class="explorer-item ${activeItem === i ? 'active' : ''}"
         role="option"
         aria-selected="${activeItem === i}"
         data-index="${i}"
         tabindex="0"
         aria-label="${item.name}, ${item.dist}">
      <div class="explorer-item-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--maroon);">${getIcon(item.icon)}</svg>
      </div>
      <div>
        <div class="explorer-item-name">${item.name}</div>
        <div class="explorer-item-meta">${item.category}</div>
        <div class="explorer-item-dist">${item.dist} · ${item.time}</div>
      </div>
    </div>
  `).join('');

    list.querySelectorAll('.explorer-item').forEach(el => {
      el.addEventListener('click', () => selectItem(parseInt(el.dataset.index)));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectItem(parseInt(el.dataset.index)); });
    });

    if (activeItem !== null) renderDetail(items[activeItem]);
    else renderPlaceholder();
  }

  function selectItem(index) {
    activeItem = index;
    renderExplorer();
  }

  function renderDetail(item) {
    const panel = document.getElementById('explorer-detail');
    if (!panel) return;
    const pct = Math.min((item.maxDist / 100) * 100, 100);
    panel.innerHTML = `
    <p class="explorer-detail-category">${item.category}</p>
    <h3 class="explorer-detail-name">${item.name}</h3>
    <p class="explorer-detail-distance">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:6px;" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      ${item.dist} from the hotel · ${item.time}
    </p>
    <p class="explorer-detail-desc">${item.desc}</p>
    <div class="explorer-distance-visual" aria-label="Distance indicator: ${item.dist}">
      <div class="explorer-distance-bar"><div class="explorer-distance-fill" style="width:${pct}%;"></div></div>
      <div class="explorer-distance-label">Distance from Meridian</div>
    </div>
    <a href="https://maps.google.com/?q=${encodeURIComponent(item.name + ', Nairobi')}" target="_blank" rel="noopener"
      style="display:inline-flex;align-items:center;gap:6px;margin-top:16px;font-size:0.8rem;font-weight:600;color:var(--maroon);">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Open in Google Maps
    </a>
  `;
    
    // Update the map embed area
    const iframe = document.getElementById('explorer-map-iframe');
    const overlay = document.getElementById('map-pin-overlay');
    
    let mapImg = document.getElementById('explorer-map-image');
    if (!mapImg) {
      const mapEmbed = document.querySelector('.explorer-map-embed');
      if (mapEmbed) {
        mapImg = document.createElement('img');
        mapImg.id = 'explorer-map-image';
        mapImg.style.cssText = 'width:100%; height:100%; object-fit:cover; position:absolute; inset:0; z-index:5; display:none;';
        mapEmbed.appendChild(mapImg);
      }
    }

    if (iframe) {
      if (item.img) {
        iframe.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
        if (mapImg) {
          mapImg.src = item.img;
          mapImg.alt = item.name;
          mapImg.style.display = 'block';
        }
      } else {
        iframe.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
        if (mapImg) mapImg.style.display = 'none';
        // Update the map iframe to show this location
        iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(item.name + ', Nairobi')}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
      }
    }
  }

  function renderPlaceholder() {
    const panel = document.getElementById('explorer-detail');
    if (!panel) return;
    panel.innerHTML = `
    <p class="eyebrow">Select a destination</p>
    <p class="display-md" style="color:var(--muted); margin-top:8px;">Choose an attraction to see how close it is from the Meridian.</p>
  `;
  }

  document.querySelectorAll('.explorer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.explorer-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeCategory = tab.dataset.category;
      activeItem = null;
      renderExplorer();
    });
  });

  renderExplorer();

  // ─── CONTACT FORM ──────────────────────────────────────
  // NOTE: this validates and shows a success toast, but does not transmit
  // the message anywhere yet. A real backend/email endpoint is required
  // before launch — see the comment in sections/contact.html.
  const contactForm = document.getElementById('contact-form');
  if (contactForm) contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('contact-name');
    const emailEl = document.getElementById('contact-email');
    const msgEl = document.getElementById('contact-message');
    if (!nameEl || !emailEl || !msgEl) return;
    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const msg = msgEl.value.trim();
    if (!name || !email || !msg) {
      showToast('Please fill in your name, email, and message.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address.');
      return;
    }
    showToast('Thank you, ' + name + '. Your message has been received. Our team will be in touch shortly.');
    e.target.reset();
  });

  // ─── EVENT ENQUIRY FORM (Meetings & Events) ────────────
  // Added to replace the previous mailto:-based form, which silently
  // failed for any guest without a configured desktop email client and
  // exposed the destination address in a plain GET query string. Same
  // caveat as the contact form above: this needs a real backend before
  // launch to actually deliver the enquiry anywhere.
  const eventForm = document.getElementById('event-enquiry-form');
  if (eventForm) {
    eventForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const subjEl = document.getElementById('event-subject');
      const guestEl = document.getElementById('event-guests');
      const subject = subjEl ? subjEl.value.trim() : '';
      const guests = guestEl ? guestEl.value : '';
      if (guests && Number(guests) > 350) {
        showToast('Kyber Hall holds up to 350 guests — please call us directly for larger events.');
        return;
      }
      showToast('Thank you' + (subject ? ' — "' + subject + '"' : '') + '. Our events team will follow up shortly.');
      eventForm.reset();
    });
  }

  // ─── TOAST ─────────────────────────────────────────────
  // `duration` is optional; some call sites pass one, and the previous
  // single-parameter signature silently ignored it.
  function showToast(message, duration) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.animation = 'fadeUp 0.3s ease';
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, duration || 4500);
  }

  // ─── SMOOTH SCROLL ─────────────────────────────────────
  /*
   * Delegated, so it also covers links inside panels rendered later (the
   * conference planner and neighbourhood explorer both rebuild their markup).
   * The previous version bound listeners once at init time, so any anchor
   * injected afterwards silently lost its smooth scroll.
   *
   * Vertical offset comes from html{scroll-padding-top} in the stylesheet
   * rather than arithmetic here, so native anchor jumps and keyboard focus
   * clear the fixed navbar too.
   */
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('a[href^="#"], [data-scroll-to]');
    if (!trigger) return;

    const id = trigger.dataset.scrollTo
      ? trigger.dataset.scrollTo
      : trigger.getAttribute('href').slice(1);
    if (!id) return;                                   // bare "#" — leave it

    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Move keyboard focus with the viewport, otherwise the next Tab press
    // jumps back to wherever the user was before the scroll.
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  // ─── ACTIVE NAV LINK ───────────────────────────────────
  const sections = ['rooms', 'dining', 'meetings', 'gallery', 'location', 'about-intro', 'contact'];
  const navLinks = document.querySelectorAll('.nav-link[data-page], .nav-link[data-mobile-page]');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          const page = link.dataset.page || link.dataset.mobilePage;
          link.classList.toggle('active', page === id || (id === 'about-intro' && page === 'about'));
        });
      }
    });
  }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });

  // ─── KEYBOARD FOCUS ────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) {
      setMenu(false);
      if (hamburger) hamburger.focus();
    }
  });

  // ─── FOOTER COPYRIGHT YEAR ─────────────────────────────
  const copyrightYearEl = document.getElementById('copyright-year');
  if (copyrightYearEl) {
    copyrightYearEl.textContent = new Date().getFullYear();
  }

  // ─── SCROLL PROGRESS BAR ───────────────────────────────
  const scrollProgressEl = document.getElementById('scroll-progress');
  const backToTopBtn = document.getElementById('back-to-top');

  /*
   * Scroll-linked effects, batched into one rAF-throttled handler so layout
   * reads happen once per frame instead of once per scroll event.
   */
  const reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const parallaxNodes = Array.from(document.querySelectorAll('.parallax-media'));
  let ticking = false;

  function onScrollFrame() {
    const scrollTop = window.scrollY;
    const vh = window.innerHeight;

    if (scrollProgressEl) {
      const docHeight = document.documentElement.scrollHeight - vh;
      const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      scrollProgressEl.style.width = pct + '%';
    }

    if (backToTopBtn) {
      backToTopBtn.classList.toggle('visible', scrollTop > 600);
    }

    if (!reduceMotion) {
      // The image is pre-scaled 1.12 in CSS so the drift never exposes an
      // edge; we write a custom property so CSS keeps ownership of the scale.
      for (let i = 0; i < parallaxNodes.length; i++) {
        const node = parallaxNodes[i];
        const rect = node.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) continue;
        const progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
        const depth = parseFloat(node.dataset.parallax) || 28;
        node.style.setProperty('--parallax', (progress * -depth).toFixed(1) + 'px');
      }
    }

    ticking = false;
  }

  function requestScrollFrame() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScrollFrame);
  }

  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', requestScrollFrame, { passive: true });

  // Run once now. Without this the progress bar sits at 0% and back-to-top
  // stays hidden when the page is reloaded mid-scroll or opened on a deep
  // link, until the user happens to scroll again.
  onScrollFrame();

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ─── CONFERENCE PLANNER TABS ──────────────────────────
  const confData = {
    boardroom: {
      name: 'Executive Boardroom',
      capacity: 'Up to 12 guests',
      setup: 'Single table, focused discussion, presentation screen as needed',
      recommendation: 'Use this for leadership meetings, interviews, private negotiations, and board sessions.',
      img: 'gallery/meetings/best-western-plus-meridian-1.jpg',
      imgAlt: 'Boardroom setup with conference table and chairs'
    },
    training: {
      name: 'Lukenya Hall',
      capacity: 'Up to 80 guests',
      setup: 'Classroom or U-shape seating with writing space',
      recommendation: 'Use this for workshops, onboarding, team training, and day-delegate sessions.',
      img: 'gallery/meetings/meeting-room.jpg',
      imgAlt: 'Training room with classroom seating and whiteboard'
    },
    conference: {
      name: 'Khyber Hall',
      capacity: 'Up to 350 guests',
      setup: 'Theatre-style seating, AV support, and dedicated internet',
      recommendation: 'Use this for seminars, launches, annual meetings, and larger company gatherings.',
      img: 'gallery/meetings/khyber.jpg',
      imgAlt: 'Large conference room with theatre-style seating'
    },
    banquet: {
      name: 'Banquet',
      capacity: 'Best for catered receptions',
      setup: 'Round tables or reception layout with on-site catering',
      recommendation: 'Use this for dinners, celebrations, networking receptions, and formal hospitality.',
      img: 'gallery/dining/2.jpg',
      imgAlt: 'Banquet hall with round tables and catering setup'
    }
  };

  function renderConfPanel(key) {
    const d = confData[key];
    if (!d) return;
    const panel = document.getElementById('conf-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="conf-panel-img">
        <img src="${d.img}" alt="${d.imgAlt}" loading="lazy" />
      </div>
      <div class="conf-panel-info">
        <div class="conf-panel-recommended">Recommended Setup</div>
        <div class="conf-panel-name">${d.name}</div>
        <div class="conf-panel-row">
          <div class="conf-panel-row-label">Capacity</div>
          <div class="conf-panel-row-value">${d.capacity}</div>
        </div>
        <div class="conf-panel-row">
          <div class="conf-panel-row-label">Setup</div>
          <div class="conf-panel-row-value">${d.setup}</div>
        </div>
        <div class="conf-panel-row">
          <div class="conf-panel-row-label">Recommendation</div>
          <div class="conf-panel-row-value">${d.recommendation}</div>
        </div>
        <button class="conf-panel-cta" data-scroll-to="contact">
          Send Conference Inquiry
        </button>
        <a href="tel:+254719063000" class="conf-panel-call">Call events team</a>
      </div>
    `;
  }

  const confTabs = document.querySelectorAll('.conf-tab');
  if (confTabs.length) {
    renderConfPanel('boardroom');
    confTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        confTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        renderConfPanel(tab.dataset.conf);
      });
    });
  }

  // ─── GALLERY FILTERS + LIGHTBOX ────────────────────────
  const galleryItems = document.querySelectorAll('.gallery-item');
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxPrev = document.getElementById('lightbox-prev');
  const lightboxNext = document.getElementById('lightbox-next');

  let lightboxIndex = 0;
  let visibleItems = [];

  function getVisibleItems() {
    return Array.from(galleryItems).filter(el => !el.classList.contains('hidden'));
  }

  function openLightbox(item) {
    visibleItems = getVisibleItems();
    lightboxIndex = visibleItems.indexOf(item);
    showLightboxSlide(lightboxIndex);
    if (lightbox) {
      lightbox.style.display = 'flex';
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      lightboxClose?.focus();
    }
  }

  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.add('hidden');
      lightbox.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function showLightboxSlide(index) {
    if (!visibleItems.length) return;
    const item = visibleItems[((index % visibleItems.length) + visibleItems.length) % visibleItems.length];
    lightboxIndex = ((index % visibleItems.length) + visibleItems.length) % visibleItems.length;
    const src = item.dataset.src || item.querySelector('img')?.src || '';
    const label = item.dataset.label || '';
    if (lightboxImg) {
      lightboxImg.src = src;
      lightboxImg.alt = label;
      lightboxImg.style.animation = 'none';
      void lightboxImg.offsetWidth;
      lightboxImg.style.animation = 'fadeIn 0.3s ease';
    }
    if (lightboxCaption) lightboxCaption.textContent = label;
  }

  galleryItems.forEach(item => {
    item.addEventListener('click', () => openLightbox(item));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(item); });
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', 'View ' + (item.dataset.label || 'image'));
  });

  lightboxClose?.addEventListener('click', closeLightbox);
  lightboxPrev?.addEventListener('click', () => showLightboxSlide(lightboxIndex - 1));
  lightboxNext?.addEventListener('click', () => showLightboxSlide(lightboxIndex + 1));

  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (!lightbox || lightbox.style.display === 'none' || lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showLightboxSlide(lightboxIndex - 1);
    if (e.key === 'ArrowRight') showLightboxSlide(lightboxIndex + 1);
  });

  if (lightbox) {
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) showLightboxSlide(lightboxIndex + 1);
        else showLightboxSlide(lightboxIndex - 1);
      }
    }, { passive: true });
  }

  const galleryGrid = document.querySelector('.gallery-grid');
  if (galleryGrid) galleryGrid.style.transition = 'opacity 0.3s ease';

  const taGalleryModal = document.getElementById('ta-gallery-modal');
  const taGalleryClose = document.getElementById('ta-gallery-close');

  /*
   * Gallery modal openers.
   *
   * Previously each tile carried an inline onclick that opened the modal and
   * applied its own filter ('rooms', 'facilities'), AND #ta-hero-grid had a
   * click listener that applied the 'all' filter. Both ran for a single tile
   * click — the tile's filter first, then the grid's 'all' as the event
   * bubbled up — so clicking "Executive Room" opened the gallery unfiltered.
   * The grid-level listener is gone; one delegated handler now honours
   * whichever data-gallery-open value was actually clicked.
   */
  function openGalleryModal(filter) {
    if (!taGalleryModal) return;
    taGalleryModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const btn = document.querySelector(
      '.ta-sidebar .gallery-filter-btn[data-filter="' + filter + '"]'
    );
    if (btn) btn.click();
    else updateGalleryVisibility(filter);
  }

  function closeGalleryModal() {
    if (!taGalleryModal) return;
    taGalleryModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-gallery-open]');
    if (!opener) return;
    e.preventDefault();
    openGalleryModal(opener.dataset.galleryOpen || 'all');
  });

  // The tiles were plain <div>s with inline onclick — not focusable and
  // invisible to screen readers. Promote them to real buttons.
  document.querySelectorAll('[data-gallery-open]').forEach((el) => {
    if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGalleryModal(el.dataset.galleryOpen || 'all');
      }
    });
  });

  if (taGalleryClose) {
    taGalleryClose.addEventListener('click', closeGalleryModal);
  }

  // Escape closes the full-screen gallery, matching the lightbox behaviour.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && taGalleryModal && taGalleryModal.classList.contains('open')) {
      closeGalleryModal();
    }
  });

  function updateGalleryVisibility(filter) {
    galleryItems.forEach(item => {
      if (filter === 'all' || item.dataset.category === filter) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const filter = btn.dataset.filter;
      
      if (galleryGrid) {
        galleryGrid.style.opacity = '0';
        setTimeout(() => {
          updateGalleryVisibility(filter);
          galleryGrid.style.opacity = '1';
        }, 300);
      } else {
        updateGalleryVisibility(filter);
      }
    });
  });

  // Apply on initial load
  updateGalleryVisibility('all');

  /* ───────────────────────────────────────────────────────
   * REMOVED: a second "BOOKING ENGINE REDIRECT" block and a second
   * "CONTACT FORM LOGIC" block used to sit here.
   *
   * They re-declared `const checkinInput` / `const checkoutInput`, which
   * were already declared with `const` near the top of this same init()
   * scope. That is a *parse-time* SyntaxError, not a runtime one, so V8
   * rejected this entire file before executing a single statement:
   * init() was never even defined. The result was a page with no navbar
   * (it is CSS-hidden until JS reveals it), no slideshow, no booking
   * widget, no lightbox, no conference planner and no explorer — which
   * read as "everything is broken" when it was really one bad edit.
   *
   * Both blocks were redundant anyway: the booking redirect is handled
   * above (and additionally forwards the guest count), and the contact
   * form handler above actually validates input instead of just firing a
   * toast. Keeping both would also have double-bound the listeners,
   * opening two booking tabs per click and showing two toasts per submit.
   * ─────────────────────────────────────────────────────── */

  // ─── PREMIUM MAGNETIC HOVER ─────────────────────────────
  /*
   * Desktop-only, and skipped under reduced motion.
   *
   * On touch devices a tap fires a synthetic mousemove, so buttons used to
   * lurch sideways under the finger and then stay offset — mouseleave never
   * arrives without a real pointer, leaving the CTA permanently crooked.
   */
  const finePointer =
    window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.hero-btn-primary, .hero-btn-ghost').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        // Cap the pull so a wide button cannot drift far from its slot.
        const dx = Math.max(-10, Math.min(10, x * 0.15));
        const dy = Math.max(-8, Math.min(8, y * 0.15));
        btn.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      });

      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
      // Blur/scroll can steal the pointer without firing mouseleave.
      btn.addEventListener('blur', () => { btn.style.transform = ''; });
    });
  }
}
