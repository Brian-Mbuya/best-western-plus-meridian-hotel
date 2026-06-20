/*
 * script.js
 * ---------------------------------------------------------------
 * All logic below is wrapped in a single init() function that only
 * runs after include-sections.js has finished injecting every HTML
 * fragment and fired the "sections:ready" event on `document`.
 *
 * This wrapping is required by the split-file architecture: every
 * document.getElementById(...) call here targets an element that
 * lives inside one of the /sections fragments, not in the static
 * shell of index.html. If this code ran at the normal top level
 * (the way it did in the original single-file version), it would
 * execute before those fragments exist and throw immediately on
 * the very first DOM lookup, silently breaking every feature below.
 * ---------------------------------------------------------------
 */

// ─── PAGE INTRO (runs immediately — overlay lives in static index.html) ──────
(function () {
  const intro = document.getElementById('page-intro');
  if (!intro) return;

  // Skip the animation for users who have already seen it this session.
  // Remove this block if you always want the animation to play.
  // if (sessionStorage.getItem('introSeen')) {
  //   intro.style.display = 'none';
  //   return;
  // }

  // Lock scroll while intro is visible
  document.body.style.overflow = 'hidden';

  // Total animation duration: logo 2.2s + curtain delay 1.8s + curtain 0.75s = 2.55s total
  // We give a tiny extra buffer (200ms) then clean up
  const INTRO_TOTAL_MS = 2600;

  // Allow click/tap to skip the intro
  intro.addEventListener('click', dismissIntro);
  intro.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') dismissIntro(); });

  setTimeout(dismissIntro, INTRO_TOTAL_MS);

  function dismissIntro() {
    // Mark as seen
    try { sessionStorage.setItem('introSeen', '1'); } catch (_) { }
    // Unlock scroll
    document.body.style.overflow = '';
    // Mark done — removes pointer-events so user can interact with the page
    intro.classList.add('done');
    // After curtains have fully slid away, hide the element entirely
    setTimeout(() => { intro.style.display = 'none'; }, 800);
  }
})();

document.addEventListener('sections:ready', init);

function init() {
  // ─── NAVBAR ───────────────────────────────────────────
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  let menuOpen = false;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  hamburger.addEventListener('click', () => {
    menuOpen = !menuOpen;
    hamburger.classList.toggle('open', menuOpen);
    mobileMenu.classList.toggle('open', menuOpen);
    hamburger.setAttribute('aria-expanded', menuOpen);
    document.body.style.overflow = menuOpen ? 'hidden' : '';
  });

  // Close mobile menu on nav link click
  document.querySelectorAll('[data-mobile-page]').forEach(link => {
    link.addEventListener('click', () => {
      menuOpen = false;
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
      document.body.style.overflow = '';
    });
  });

  // ─── SCROLL ANIMATION ──────────────────────────────────
  const observerOptions = { threshold: 0.12, rootMargin: '0px 0px -40px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Slight stagger for sibling elements
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay * 1000);
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-up, .fade-in').forEach(el => observer.observe(el));

  // Gold line animation
  const lineObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'slideRight 0.6s ease forwards';
        entry.target.style.opacity = '1';
        lineObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.accent-line').forEach(el => {
    el.style.opacity = '0';
    lineObserver.observe(el);
  });

  // ─── HERO CONTENT ENTRANCE ─────────────────────────────
  // data-delay attribute drives stagger (in seconds, matches CSS animation-delay)
  document.querySelectorAll('.hero .fade-up, .hero .fade-in').forEach((el) => {
    const delay = el.dataset.delay || 0;
    el.style.animation = `fadeUp 0.9s ease ${parseFloat(delay) + 0.1}s both`;
  });

  // ─── HERO SLIDESHOW ─────────────────────────────────────
  // Pure crossfade — no zoom, no parallax. Just clean hotel photography.
  // Transitions are handled entirely via CSS opacity on .active class.
  (function initHeroSlideshow() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');

    if (!slides.length) return;

    const INTERVAL = 7000;   // ms between auto-advances
    const TOTAL = slides.length;
    let current = 0;
    let timer = null;
    let paused = false;

    function goTo(index) {
      // Clamp / wrap
      index = ((index % TOTAL) + TOTAL) % TOTAL;

      // Deactivate current
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      dots[current].removeAttribute('aria-current');

      // Activate next
      current = index;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
      dots[current].setAttribute('aria-current', 'true');
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


  // ─── BOOKING WIDGET ────────────────────────────────────
  const checkinInput = document.getElementById('checkin');
  const checkoutInput = document.getElementById('checkout');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  checkinInput.min = today.toISOString().split('T')[0];
  checkinInput.value = tomorrow.toISOString().split('T')[0];
  checkoutInput.value = dayAfter.toISOString().split('T')[0];
  checkoutInput.min = tomorrow.toISOString().split('T')[0];

  checkinInput.addEventListener('change', () => {
    const ci = new Date(checkinInput.value);
    const co = new Date(checkoutInput.value);
    const nextDay = new Date(ci);
    nextDay.setDate(nextDay.getDate() + 1);
    if (co <= ci) {
      checkoutInput.value = nextDay.toISOString().split('T')[0];
    }
    checkoutInput.min = nextDay.toISOString().split('T')[0];
  });

  document.getElementById('check-avail-btn').addEventListener('click', () => {
    const ci = checkinInput.value;
    const co = checkoutInput.value;
    const guests = document.getElementById('guests').value;
    if (!ci || !co) { showToast('Please select check-in and check-out dates.'); return; }
    window.open(`https://www.bestwestern.com/en_US/book/hotel-rooms.75152.html?checkIn=${ci}&checkOut=${co}&numberOfAdults=${guests}`, '_blank');
  });

  // ─── NEIGHBORHOOD EXPLORER ─────────────────────────────
  const attractions = {
    landmarks: [
      { name: 'Kenyatta International Convention Centre', dist: '0.4 km', time: '5 min walk', category: 'Landmark', icon: 'building', desc: 'Nairobi\'s iconic cylindrical tower and convention complex, one of the most recognisable structures in East Africa. A 5-minute walk from the hotel.', maxDist: 5, img: 'gallery/attractions/kenya international convention centre.webp' },
      { name: 'Kenya National Archives', dist: '0.75 km', time: '9 min walk', category: 'Historic Site', icon: 'archive', desc: 'Houses Kenya\'s most significant historical documents and a small museum on the ground floor. A short stroll down Moi Avenue.', maxDist: 10, img: null },
      { name: 'Anniversary Towers', dist: '0.3 km', time: '4 min walk', category: 'Business Hub', icon: 'office', desc: 'Major government and commercial office complex at the very edge of the CBD. Walking distance.', maxDist: 4, img: null },
      { name: 'August 7th Memorial Park', dist: '1.1 km', time: '13 min walk', category: 'Memorial', icon: 'park', desc: 'A peace garden and memorial marking the site of the 1998 US Embassy bombing. A significant site of reflection in the city.', maxDist: 15, img: null },
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
    document.getElementById('explorer-detail').innerHTML = `
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
  document.getElementById('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const msg = document.getElementById('contact-message').value.trim();
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
      const subject = document.getElementById('event-subject').value.trim();
      const guests = document.getElementById('event-guests').value;
      if (guests && Number(guests) > 350) {
        showToast('Kyber Hall holds up to 350 guests — please call us directly for larger events.');
        return;
      }
      showToast('Thank you' + (subject ? ' — "' + subject + '"' : '') + '. Our events team will follow up shortly.');
      eventForm.reset();
    });
  }

  // ─── TOAST ─────────────────────────────────────────────
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.animation = 'fadeUp 0.3s ease';
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 4500);
  }

  // ─── SMOOTH SCROLL ─────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ─── ACTIVE NAV LINK ───────────────────────────────────
  const sections = ['rooms', 'dining', 'meetings', 'gallery', 'location', 'about-intro', 'contact'];
  const navLinks = document.querySelectorAll('.nav-link[data-page]');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.dataset.page === id || (id === 'about-intro' && link.dataset.page === 'about'));
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
      menuOpen = false;
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
      document.body.style.overflow = '';
      hamburger.focus();
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

  window.addEventListener('scroll', () => {
    if (scrollProgressEl) {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      scrollProgressEl.style.width = pct + '%';
    }
    if (backToTopBtn) {
      if (window.scrollY > 600) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }
  }, { passive: true });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ─── CONFERENCE PLANNER TABS ──────────────────────────
  const confData = {
    boardroom: {
      name: 'Boardroom',
      capacity: 'Best for small executive groups',
      setup: 'Single table, focused discussion, presentation screen as needed',
      recommendation: 'Use this for leadership meetings, interviews, private negotiations, and board sessions.',
      img: 'gallery/meetings/best-western-plus-meridian-1.jpg',
      imgAlt: 'Boardroom setup with conference table and chairs'
    },
    training: {
      name: 'Training',
      capacity: 'Best for medium learning groups',
      setup: 'Classroom or U-shape seating with writing space',
      recommendation: 'Use this for workshops, onboarding, team training, and day-delegate sessions.',
      img: 'gallery/meetings/meeting-room.jpg',
      imgAlt: 'Training room with classroom seating and whiteboard'
    },
    conference: {
      name: 'Conference',
      capacity: 'Scales up to 350 guests',
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
        <button class="conf-panel-cta" onclick="document.getElementById('contact').scrollIntoView({behavior:'smooth'})">
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

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const filter = btn.dataset.filter;
      galleryItems.forEach(item => {
        if (filter === 'all' || item.dataset.category === filter) item.classList.remove('hidden');
        else item.classList.add('hidden');
      });
    });
  });
}
