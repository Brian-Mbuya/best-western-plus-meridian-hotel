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
  let hasSeenIntro = false;
  try { hasSeenIntro = sessionStorage.getItem('introSeen') === '1'; } catch (_) { }
  
  if (!intro || hasSeenIntro) {
    if (intro) intro.style.display = 'none';
    window._skipIntroAnimation = true;
    return;
  }

  // Lock scroll while intro is visible
  document.body.style.overflow = 'hidden';

  // Total animation duration: logo 2.2s + curtain delay 1.8s + curtain 0.75s = 2.55s total
  const INTRO_TOTAL_MS = 2600;

  // Allow click/tap to skip the intro
  intro.addEventListener('click', dismissIntro);
  intro.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') dismissIntro(); });

  let dismissed = false;
  setTimeout(dismissIntro, INTRO_TOTAL_MS);

  function dismissIntro() {
    if (dismissed) return;
    dismissed = true;
    try { sessionStorage.setItem('introSeen', '1'); } catch (_) { }
    document.body.style.overflow = '';
    intro.classList.add('done');
    setTimeout(() => { intro.style.display = 'none'; }, 800);
    
    // Dispatch event to trigger the nav and hero entrance
    document.dispatchEvent(new Event('intro:finished'));
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

  document.querySelectorAll('.fade-up, .fade-in').forEach(el => {
    if (!el.closest('.hero')) observer.observe(el);
  });

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

  // ─── HERO & NAV ENTRANCE ORCHESTRATION ────────────────
  function playEntranceSequence() {
    if (navbar) navbar.classList.add('nav-visible');
    
    document.querySelectorAll('.hero .fade-up, .hero .fade-in').forEach((el) => {
      const delay = parseFloat(el.dataset.delay || 0);
      el.style.animation = `fadeUp 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay + 0.1}s both`;
    });
  }

  if (window._skipIntroAnimation) {
    playEntranceSequence();
  } else {
    document.addEventListener('intro:finished', playEntranceSequence);
    // Fallback if the event fired before sections were ready
    const intro = document.getElementById('page-intro');
    if (intro && intro.classList.contains('done')) {
      playEntranceSequence();
    }
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

  // Hero Contact Scroll & Arrival Effect
  (function initHeroContactScroll() {
    const observer = new MutationObserver(() => {
      const scrollBtn = document.getElementById('heroContactScrollBtn');
      const contactSection = document.getElementById('contact');
      
      if (scrollBtn && contactSection) {
        // Smooth scroll to contact
        scrollBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetPos = contactSection.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({
            top: targetPos,
            behavior: 'smooth'
          });
        });

        // Arrival effect using IntersectionObserver
        const arrivalObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              contactSection.classList.add('contact-arrival-effect');
              
              // Remove class after animation finishes (1s) to return to normal
              setTimeout(() => {
                contactSection.classList.remove('contact-arrival-effect');
              }, 1000);
              
              // Only trigger once per page load
              arrivalObserver.disconnect();
            }
          });
        }, { threshold: 0.2 });
        
        // Ensure we only observe after clicking the button?
        // No, the user said "When the Contact section enters the viewport",
        // but maybe they meant just naturally scrolling to it. Let's observe it!
        scrollBtn.addEventListener('click', () => {
          // If we want it strictly on click, we connect it here.
          // The prompt says "When the Contact Us button is clicked: Smooth scroll... When the Contact section enters the viewport: Apply subtle premium arrival effect".
          // This means if we scroll via the button, it triggers. 
          arrivalObserver.observe(contactSection);
        });

        observer.disconnect(); // Only run once
      }
    });
    
    // Start observing document.body for injected sections
    observer.observe(document.body, { childList: true, subtree: true });
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
      { name: 'Kenya National Archives', dist: '0.75 km', time: '9 min walk', category: 'Historic Site', icon: 'archive', desc: 'Houses Kenya\'s most significant historical documents and a small museum on the ground floor. A short stroll down Moi Avenue.', maxDist: 10, img: data:image/webp;base64,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 },
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

  const galleryGrid = document.querySelector('.gallery-grid');
  if (galleryGrid) galleryGrid.style.transition = 'opacity 0.3s ease';

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const filter = btn.dataset.filter;
      
      if (galleryGrid) {
        galleryGrid.style.opacity = '0';
        setTimeout(() => {
          galleryItems.forEach(item => {
            if (filter === 'all' || item.dataset.category === filter) item.classList.remove('hidden');
            else item.classList.add('hidden');
          });
          galleryGrid.style.opacity = '1';
        }, 300);
      } else {
        galleryItems.forEach(item => {
          if (filter === 'all' || item.dataset.category === filter) item.classList.remove('hidden');
          else item.classList.add('hidden');
        });
      }
    });
  });

  // ─── PREMIUM MAGNETIC HOVER ─────────────────────────────
  document.querySelectorAll('.hero-btn-primary, .hero-btn-ghost').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}
