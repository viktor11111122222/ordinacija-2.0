/* ── script.js ── */

/* ══════════════════════════════════════════
   UTILITY: TOAST NOTIFICATIONS
══════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

/* ══════════════════════════════════════════
   UTILITY: SHAKE ANIMATION
══════════════════════════════════════════ */
function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // force reflow
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

/* ══════════════════════════════════════════
   PULL-TO-REFRESH (overscroll gore → reload)
══════════════════════════════════════════ */
(function () {
  const THRESHOLD = 500;
  let indicator   = null;
  let refreshing  = false;

  function createIndicator() {
    const el = document.createElement('div');
    el.id = 'ptr-indicator';
    el.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg><span>Pusti za osvežavanje</span>`;
    Object.assign(el.style, {
      position:      'fixed',
      top:           '0',
      left:          '50%',
      transform:     'translateX(-50%) translateY(-100%)',
      background:    'var(--teal)',
      color:         '#fff',
      padding:       '10px 22px',
      borderRadius:  '0 0 16px 16px',
      display:       'flex',
      alignItems:    'center',
      gap:           '10px',
      fontSize:      '0.85rem',
      fontWeight:    '500',
      fontFamily:    "'Inter', sans-serif",
      zIndex:        '9999',
      boxShadow:     '0 6px 24px rgba(42,157,143,.35)',
      transition:    'transform .3s cubic-bezier(.4,0,.2,1)',
      pointerEvents: 'none',
    });
    document.body.appendChild(el);
    return el;
  }

  function setProgress(ratio) {
    if (!indicator) indicator = createIndicator();
    const clamped = Math.min(ratio, 1);
    const y = clamped >= 1 ? 0 : -100 + clamped * 80;
    indicator.style.transform = `translateX(-50%) translateY(${y}%)`;
    indicator.querySelector('svg').style.transform = `rotate(${clamped * 360}deg)`;
  }

  function hideIndicator() {
    if (indicator) indicator.style.transform = 'translateX(-50%) translateY(-100%)';
  }

  function triggerReload() {
    if (!indicator) indicator = createIndicator();
    indicator.style.transform = 'translateX(-50%) translateY(0%)';
    indicator.querySelector('span').textContent = 'Osvežavanje…';
    const style = document.createElement('style');
    style.textContent = '@keyframes ptr-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    indicator.querySelector('svg').style.animation = 'ptr-spin .7s linear infinite';
    setTimeout(() => location.reload(), 600);
  }

  /* ── Touch (mobile) ── */
  let touchStart = null;
  window.addEventListener('touchstart', e => {
    if (window.scrollY === 0) touchStart = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (touchStart === null || refreshing) return;
    if (document.getElementById('calcModal')?.classList.contains('open')) return;
    const delta = e.touches[0].clientY - touchStart;
    if (delta > 0 && window.scrollY === 0) setProgress(delta / THRESHOLD);
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (touchStart === null || refreshing) return;
    const el = document.getElementById('ptr-indicator');
    const match = el?.style.transform.match(/translateY\((.+)%\)/);
    const y = match ? parseFloat(match[1]) : -100;
    if (y >= -25) { refreshing = true; triggerReload(); }
    else hideIndicator();
    touchStart = null;
  });

  /* ── Mouse wheel (desktop Mac trackpad overscroll) ── */
  let wheelPull  = 0;
  let wheelTimer = null;
  // Ako stranica starta na vrhu, odmah oznaci kao "na vrhu"
  let atTopSince = window.scrollY === 0 ? Date.now() : null;

  // Beleži kada se scroll zaustavi na vrhu
  window.addEventListener('scroll', () => {
    if (window.scrollY === 0) {
      if (atTopSince === null) atTopSince = Date.now();
    } else {
      atTopSince = null;
      wheelPull  = 0;
      hideIndicator();
    }
  }, { passive: true });

  window.addEventListener('wheel', e => {
    if (refreshing) return;
    if (document.getElementById('calcModal')?.classList.contains('open')) return;

    // Dozvoli pull samo ako je korisnik bio miran na vrhu bar 400ms
    const readyToRefresh = window.scrollY === 0
      && atTopSince !== null
      && (Date.now() - atTopSince) > 400;

    if (readyToRefresh && e.deltaY < 0) {
      wheelPull += Math.abs(e.deltaY);
      setProgress(wheelPull / THRESHOLD);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (wheelPull >= THRESHOLD) { refreshing = true; triggerReload(); }
        else { wheelPull = 0; hideIndicator(); }
      }, 200);
    } else if (window.scrollY > 0) {
      wheelPull = 0;
    }
  }, { passive: true });
})();

/* ══════════════════════════════════════════
   PRICE CALCULATOR
══════════════════════════════════════════ */
(function () {

  /* ── Sinhronizacija: čita cene iz kartica i puni kalkulator ── */
  document.querySelectorAll('#services .cpl-row').forEach(row => {
    const spans = row.querySelectorAll(':scope > span');
    if (spans.length < 2) return;
    const name      = spans[0].textContent.trim();
    const priceText = spans[1].textContent.trim();            // npr. "3.000 RSD"
    const price     = parseInt(priceText.replace(/\./g, '').replace(/\s*RSD/i, ''), 10);
    if (isNaN(price)) return;

    document.querySelectorAll('.calc-item').forEach(item => {
      const nameEl = item.querySelector('.calc-item-name');
      if (nameEl && nameEl.textContent.trim() === name) {
        item.dataset.price = price;
        const dispEl = item.querySelector('.calc-item-price');
        if (dispEl) dispEl.textContent = priceText;
      }
    });
  });

  const overlay  = document.getElementById('calcModal');
  const openBtn  = document.getElementById('openCalc');
  const closeBtn = document.getElementById('closeCalc');
  const resetBtn = document.getElementById('calcReset');
  const totalEl  = document.getElementById('calcTotal');
  const ctaBtn   = document.getElementById('calcCta');

  if (!overlay) return;

  // Format broj sa tačkama: 25000 → "25.000"
  function fmt(n) {
    return n.toLocaleString('sr-RS');
  }

  function calcTotal() {
    let sum = 0;
    overlay.querySelectorAll('.calc-item').forEach(item => {
      const qty   = parseInt(item.querySelector('.qty-val').textContent, 10);
      const price = parseInt(item.dataset.price, 10);
      sum += qty * price;
    });
    return sum;
  }

  let _displayed = 0;
  let _animId    = null;

  function easeOutTotal(t) { return 1 - Math.pow(1 - t, 3); }

  function updateTotal() {
    const target = calcTotal();
    const from   = _displayed;
    if (_animId) cancelAnimationFrame(_animId);

    const dur   = 420;
    const start = performance.now();

    (function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const v = from + (target - from) * easeOutTotal(p);
      _displayed = v;
      totalEl.textContent = fmt(Math.round(v)) + ' RSD';
      if (p < 1) {
        _animId = requestAnimationFrame(tick);
      } else {
        _displayed = target;
        _animId    = null;
      }
    })(start);
  }

  // Qty steppers
  overlay.addEventListener('click', e => {
    const plus  = e.target.closest('.qty-plus');
    const minus = e.target.closest('.qty-minus');
    if (!plus && !minus) return;

    const item  = e.target.closest('.calc-item');
    const valEl = item.querySelector('.qty-val');
    let val = parseInt(valEl.textContent, 10);

    if (plus)  val = Math.min(val + 1, 20);
    if (minus) val = Math.max(val - 1, 0);

    valEl.textContent = val;
    item.classList.toggle('has-qty', val > 0);
    updateTotal();
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    overlay.querySelectorAll('.qty-val').forEach(el => el.textContent = '0');
    overlay.querySelectorAll('.calc-item').forEach(el => el.classList.remove('has-qty'));
    updateTotal();
  });

  // Open / close
  function openModal() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  // Navigacija po kategorijama
  const calcBody = overlay.querySelector('.calc-body');
  const navBtns  = overlay.querySelectorAll('.calc-nav-btn');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      calcBody.scrollTo({ top: target.offsetTop - calcBody.offsetTop - 8, behavior: 'smooth' });
    });
  });

  // Aktivni tab prati scroll
  const categories = overlay.querySelectorAll('.calc-category');
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navBtns.forEach(b => b.classList.toggle('active', b.dataset.target === id));
        // Skroluj nav tab u vidljivo polje
        const activeBtn = overlay.querySelector(`.calc-nav-btn[data-target="${id}"]`);
        if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    });
  }, { root: calcBody, threshold: 0.35 });

  categories.forEach(cat => io.observe(cat));

  // Zatvori klik na CTA link
  ctaBtn.addEventListener('click', closeModal);

  // Klik van modala
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });
})();

/* ══════════════════════════════════════════
   BACK TO TOP
══════════════════════════════════════════ */
(function () {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ══════════════════════════════════════════
   PARALLAX EFFECT
══════════════════════════════════════════ */
const parallaxBg = document.getElementById('parallaxBg');

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  function updateParallax() {
    const scrollY = window.scrollY;
    // Hero parallax
    parallaxBg.style.transform = `translateY(${scrollY * 0.40}px)`;

    // Per-element parallax relativno od centra viewporta
    document.querySelectorAll('[data-parallax]').forEach(el => {
      const speed = parseFloat(el.dataset.parallax);
      const rect  = el.getBoundingClientRect();
      const centerOffset = (rect.top + rect.height / 2) - window.innerHeight / 2;
      el.style.transform = `translateY(${centerOffset * speed}px)`;
    });
  }

  window.addEventListener('scroll', updateParallax, { passive: true });
}

/* ══════════════════════════════════════════
   NAVBAR: scroll state
══════════════════════════════════════════ */
const navbar = document.getElementById('navbar');

function updateNavbar() {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', updateNavbar, { passive: true });

/* ── Active nav link on scroll ── */
(function () {
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
  const sectionIds = Array.from(navAnchors).map(a => a.getAttribute('href').slice(1));
  const sections   = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

  function setActive(id) {
    navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

  sections.forEach(s => observer.observe(s));
})();

/* ══════════════════════════════════════════
   MOBILE MENU toggle
══════════════════════════════════════════ */
const burger     = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');

burger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

// Close mobile menu on link click
document.querySelectorAll('.mob-link').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
  });
});

/* ══════════════════════════════════════════
   SMOOTH SCROLL for nav anchors
══════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 16;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ══════════════════════════════════════════
   SCROLL REVEAL (IntersectionObserver)
══════════════════════════════════════════ */
const reveals = document.querySelectorAll('[data-reveal]');

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el    = entry.target;
      const delay = parseInt(el.dataset.delay || '0', 10);
      setTimeout(() => {
        el.classList.add('visible');
        // Nakon što animacija završi, ukloni data-reveal da se vrate
        // originalni hover transitions elementa (npr. .card, .faq-item)
        setTimeout(() => el.removeAttribute('data-reveal'), 800);
      }, delay);
      revealObserver.unobserve(el);
    });
  },
  { threshold: 0.12 }
);

reveals.forEach(el => revealObserver.observe(el));
/* ════════════════════════════════════════════
   MAP MODAL
════════════════════════════════════════════ */
const mapModal = document.getElementById('mapModal');
const openMap  = document.getElementById('openMap');
const closeMap = document.getElementById('closeMap');

function showMap() {
  mapModal.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function hideMap() {
  mapModal.classList.remove('visible');
  document.body.style.overflow = '';
}

openMap.addEventListener('click', showMap);
closeMap.addEventListener('click', hideMap);

// Close on backdrop click — but only if drag started ON the backdrop (not iframe)
let _backdropDown = false;

mapModal.addEventListener('mousedown', e => {
  _backdropDown = e.target === mapModal;
});
mapModal.addEventListener('touchstart', e => {
  _backdropDown = e.target === mapModal;
}, { passive: true });

mapModal.addEventListener('click', e => {
  if (_backdropDown && e.target === mapModal) hideMap();
  _backdropDown = false;
});

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && mapModal.classList.contains('visible')) hideMap();
});
/* ══════════════════════════════════════════   FAQ ACCORDION  (event delegation)
════════════════════════════════════════════ */
const faqList = document.querySelector('.faq-list');
if (faqList) {
  faqList.addEventListener('click', e => {
    const btn = e.target.closest('.faq-question');
    if (!btn) return;
    const item = btn.closest('.faq-item');
    if (!item) return;
    const isOpen = item.classList.contains('open');

    // Close all open items
    faqList.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
      openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });

    // Open clicked item if it was closed
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
}

/* ══════════════════════════════════════════
   PATIENTS COUNTER (global utility)
══════════════════════════════════════════ */
const PATIENTS_KEY  = 'ordinacija_patients';
const PATIENTS_BASE = 2000;

function getPatientCount() {
  return parseInt(localStorage.getItem(PATIENTS_KEY) || '0', 10);
}

function incrementPatients() {
  const newCount = getPatientCount() + 1;
  localStorage.setItem(PATIENTS_KEY, String(newCount));
  console.log('Pacijenti uvećani na:', PATIENTS_BASE + newCount);
  refreshPatientsDisplay();
}

function refreshPatientsDisplay() {
  const total = PATIENTS_BASE + getPatientCount();
  const el = document.getElementById('statPatients');
  if (el) {
    // Format: "2 003+" with space as thousands separator
    const formatted = total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    el.textContent = formatted + '+';
    console.log('Stats bar ažuriran:', el.textContent);
  }
}

// Show correct count on page load
refreshPatientsDisplay();

/* ══════════════════════════════════════════
   SERVICES COUNTER (global utility)
══════════════════════════════════════════ */
const SERVICES_KEY  = 'ordinacija_services';
const SERVICES_BASE = 5;

function getServiceCount() {
  return parseInt(localStorage.getItem(SERVICES_KEY) || '0', 10);
}

function incrementServices() {
  const newCount = getServiceCount() + 1;
  localStorage.setItem(SERVICES_KEY, String(newCount));
  refreshServicesDisplay();
}

function refreshServicesDisplay() {
  const el = document.getElementById('statServices');
  if (el) el.textContent = SERVICES_BASE + getServiceCount();
}

// Show correct count on page load
refreshServicesDisplay();


/* ══════════════════════════════════════════
   STAR RATING SYSTEM
══════════════════════════════════════════ */
(function () {
  const STORAGE_KEY  = 'ordinacija_ratings';
  const REVIEWS_KEY  = 'ordinacija_reviews';
  const BASE_RATINGS = { count: 128, sum: 640 }; // 128 ocena × 5.0 prosek

  function getReviews() {
    try { return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || []; }
    catch (_) { return []; }
  }

  function saveReview(stars, comment, name) {
    const reviews = getReviews();
    reviews.push({ stars, comment: comment || '', name: name || '', date: Date.now() });
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  }

  function getRatings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && typeof stored.count === 'number') return stored;
    } catch (_) {}
    return { count: BASE_RATINGS.count, sum: BASE_RATINGS.sum };
  }

  function saveRating(value) {
    const data = getRatings();
    data.count += 1;
    data.sum += value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  function getAverage(data) {
    const real = data.sum / data.count;
    const boosted = Math.min(5.0, real + 0.3);
    return boosted.toFixed(1);
  }

  function getStarsString(avg) {
    const full = Math.round(avg);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  function updateDisplay(data) {
    const avg = getAverage(data);
    const statRating = document.getElementById('statRating');
    const bigScore   = document.getElementById('ratingBigScore');
    const starsDisp  = document.getElementById('ratingStarsDisplay');
    const countEl    = document.getElementById('ratingCount');

    if (statRating) statRating.textContent = avg + ' ★';
    if (bigScore)   bigScore.textContent   = avg;
    if (starsDisp)  starsDisp.textContent  = getStarsString(parseFloat(avg));
    if (countEl)    countEl.innerHTML       = 'Bazirana na <strong>' + data.count + '</strong> ocena';
  }

  // Labels for each star value
  const labels = ['', 'Loše', 'Moglo je bolje', 'Dobro', 'Vrlo dobro', 'Odlično'];

  const starsContainer = document.getElementById('ratingStars');
  const labelEl        = document.getElementById('ratingLabel');
  const submitBtn      = document.getElementById('submitRating');
  const successEl      = document.getElementById('ratingSuccess');
  const interactiveEl  = document.getElementById('ratingInteractive');
  const starBtns       = document.querySelectorAll('.star-btn');
  let selectedValue    = 0;

  // Check if user already rated
  const alreadyRated = localStorage.getItem('ordinacija_user_rated');

  // Init display
  updateDisplay(getRatings());

  const commentEl = document.getElementById('ratingComment');
  const nameEl    = document.getElementById('ratingName');

  if (alreadyRated) {
    if (interactiveEl) interactiveEl.classList.add('disabled');
    if (commentEl)     commentEl.disabled = true;
    if (nameEl)        nameEl.disabled    = true;
    if (submitBtn)     submitBtn.style.display = 'none';
    if (successEl)     successEl.classList.add('show');
    if (labelEl)       labelEl.textContent = 'Već ste glasali. Hvala!';
  }

  // Hover effects
  if (starsContainer && !alreadyRated) {
    starsContainer.addEventListener('mouseover', e => {
      const btn = e.target.closest('.star-btn');
      if (!btn) return;
      const val = parseInt(btn.dataset.value);
      starBtns.forEach(b => {
        b.classList.toggle('hovered', parseInt(b.dataset.value) <= val);
      });
      if (labelEl) {
        labelEl.textContent = labels[val];
        labelEl.classList.add('has-value');
      }
    });

    starsContainer.addEventListener('mouseleave', () => {
      starBtns.forEach(b => b.classList.remove('hovered'));
      if (labelEl) {
        labelEl.textContent = selectedValue ? labels[selectedValue] : 'Izaberite ocenu';
        labelEl.classList.toggle('has-value', selectedValue > 0);
      }
    });

    // Click to select
    starsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.star-btn');
      if (!btn) return;
      selectedValue = parseInt(btn.dataset.value);
      starBtns.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.value) <= selectedValue);
      });
      if (labelEl) {
        labelEl.textContent = labels[selectedValue];
        labelEl.classList.add('has-value');
      }
      if (submitBtn) submitBtn.disabled = !(nameEl && nameEl.value.trim());
    });

    // Revalidate submit when name changes
    if (nameEl) {
      nameEl.addEventListener('input', () => {
        if (submitBtn) submitBtn.disabled = !(selectedValue > 0 && nameEl.value.trim());
      });
    }
  }

  // Submit
  if (submitBtn && !alreadyRated) {
    submitBtn.addEventListener('click', () => {
      if (selectedValue === 0) {
        shake(document.getElementById('ratingStars'));
        showToast('Izaberite ocenu pre slanja.', 'error');
        return;
      }
      const data = saveRating(selectedValue);
      localStorage.setItem('ordinacija_user_rated', 'true');
      updateDisplay(data);
      if (selectedValue >= 2) incrementPatients();
      const reviewComment = commentEl ? commentEl.value.trim() : '';
      const reviewName    = nameEl    ? nameEl.value.trim()    : '';
      saveReview(selectedValue, reviewComment, reviewName);
      document.dispatchEvent(new CustomEvent('tc:newReview', { detail: { stars: selectedValue, comment: reviewComment, name: reviewName } }));

      // Send rating + comment via EmailJS
      const comment = (commentEl && commentEl.value.trim()) || 'Bez komentara';
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_RATING_TEMPLATE_ID, {
        rating       : selectedValue + '/5',
        rating_label : labels[selectedValue],
        comment      : comment,
      }).then(() => console.log('Rating email poslat OK'))
        .catch(err => console.error('Rating email greška:', err));

      if (interactiveEl) interactiveEl.classList.add('disabled');
      if (commentEl)     commentEl.disabled = true;
      if (nameEl)        nameEl.disabled    = true;
      submitBtn.style.display = 'none';
      if (successEl) successEl.classList.add('show');
      showToast('Hvala na oceni! Vaše mišljenje nam mnogo znači.');
    });
  }
})();

/* ══════════════════════════════════════════
   CUSTOM SELECT SYNC
══════════════════════════════════════════ */
const serviceSelect = document.getElementById('service');
const serviceText   = document.getElementById('serviceText');

if (serviceSelect && serviceText) {
  serviceSelect.addEventListener('change', function () {
    if (this.value) {
      serviceText.textContent = this.value;
      serviceText.classList.add('has-value');
    } else {
      serviceText.textContent = 'Izaberite uslugu…';
      serviceText.classList.remove('has-value');
    }
  });
}

/* ════════════════════════════════════════════   CONTACT FORM — EmailJS
══════════════════════════════════════════ */
const form = document.getElementById('contactForm');

form.addEventListener('submit', e => {
  e.preventDefault();

  const btn = form.querySelector('.btn-primary');

  // Validacija — shake invalid polja umjesto browser tooltipa
  const invalids = [...form.querySelectorAll('[required]')].filter(el => !el.value.trim());
  if (invalids.length) {
    invalids.forEach(el => {
      // Za select: shake vidljivi wrapper, ne skriveni <select>
      if (el.tagName === 'SELECT') shake(form.querySelector('.select-wrap'));
      else shake(el);
    });
    shake(btn);
    showToast('Popunite obavezna polja.', 'error');
    return;
  }

  btn.textContent = 'Šaljemo…';
  btn.disabled    = true;
  btn.style.opacity = '.7';

  const now = new Date();
  const templateParams = {
    name    : document.getElementById('name').value,
    phone   : document.getElementById('phone').value  || 'Nije unet',
    email   : document.getElementById('email').value,
    service : document.getElementById('service').value || 'Nije odabrano',
    message : document.getElementById('message').value || 'Bez poruke',
    title   : 'Novi zahtev za pregled',
    time    : now.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }),
  };

  // Fire and forget — email šalje u pozadini
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams).catch(() => {});

  // Odmah prikaži uspeh (email stiže bez obzira na promise)
  setTimeout(() => {
    incrementServices();
    btn.textContent     = '✓ Zahtev poslat!';
    btn.style.background = '#16a34a';
    btn.style.opacity    = '1';
    showToast('Zahtev je poslat! Javićemo se uskoro. ✓');

    setTimeout(() => {
      form.reset();
      if (serviceText) {
        serviceText.textContent = 'Izaberite uslugu…';
        serviceText.classList.remove('has-value');
      }
      btn.textContent     = 'Pošaljite Zahtev →';
      btn.style.background = '';
      btn.disabled         = false;
    }, 3000);
  }, 1500);
});

// Telefon — dozvoli samo cifre i +
const phoneInput = document.getElementById('phone');
if (phoneInput) {
  phoneInput.addEventListener('input', () => {
    const pos = phoneInput.selectionStart;
    const cleaned = phoneInput.value.replace(/[^\d+]/g, '');
    if (phoneInput.value !== cleaned) {
      phoneInput.value = cleaned;
      phoneInput.setSelectionRange(pos - 1, pos - 1);
    }
  });
  phoneInput.addEventListener('keydown', e => {
    // Dozvoli: backspace, delete, tab, escape, arrows, home, end, +, cifre
    const allowed = ['Backspace','Delete','Tab','Escape','ArrowLeft','ArrowRight','Home','End'];
    if (allowed.includes(e.key)) return;
    if (e.key === '+' && phoneInput.selectionStart === 0) return; // + samo na početku
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });
}

/* ══════════════════════════════════════════
   USLUGE — inline price toggle
══════════════════════════════════════════ */
document.querySelectorAll('.card-price-toggle').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const card = btn.closest('.card');
    const isOpen = card.classList.contains('prices-open');
    card.classList.toggle('prices-open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
  });
});

/* ══════════════════════════════════════════
   STATS BAR — ANIMATED COUNTERS
   (mora biti zadnji blok — svi display refresh-i
    su već pokrenuti, pa čitamo tačne ciljne vrijednosti
    i odmah resetujemo DOM na 0 prije prvog painta)
══════════════════════════════════════════ */
(function () {
  const elYears    = document.getElementById('statYears');
  const elPatients = document.getElementById('statPatients');
  const elServices = document.getElementById('statServices');
  const elRating   = document.getElementById('statRating');
  const statsBar   = document.querySelector('.stats-bar');
  if (!statsBar) return;

  // Pročitaj tačne ciljne vrijednosti dok su još u DOM-u
  const targets = {
    years    : 15,
    patients : PATIENTS_BASE + getPatientCount(),
    services : SERVICES_BASE + getServiceCount(),
    rating   : parseFloat(elRating && elRating.textContent) || 5.0,
  };

  // Odmah resetuj na 0 — browser još nije paintao, pa korisnik neće vidjeti pravi broj
  if (elYears)    elYears.textContent    = '0+';
  if (elPatients) elPatients.textContent = '0+';
  if (elServices) elServices.textContent = '0';
  if (elRating)   elRating.textContent   = '0.0 \u2605';

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el, target, duration, formatter) {
    const start = performance.now();
    (function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = formatter(easeOut(progress) * target);
      if (progress < 1) requestAnimationFrame(tick);
    })(start);
  }

  let animated = false;
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting || animated) return;
    animated = true;
    observer.disconnect();

    const dur = 1800;

    if (elYears)    animateCounter(elYears, targets.years, dur,
      (v) => Math.round(v) + '+');

    if (elPatients) animateCounter(elPatients, targets.patients, dur, (v) => {
      const n = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
      return n + '+';
    });

    if (elServices) animateCounter(elServices, targets.services, dur,
      (v) => String(Math.round(v)));

    if (elRating)   animateCounter(elRating, targets.rating, dur,
      (v) => v.toFixed(1) + ' \u2605');

  }, { threshold: 0.5 });

  observer.observe(statsBar);
})();

/* ══════════════════════════════════════════
   RADNO VREME — Otvoreno / Zatvoreno
══════════════════════════════════════════ */
(function () {
  const schedule = {
    1: { open: 8,  close: 20 }, // Ponedeljak
    2: { open: 8,  close: 20 }, // Utorak
    3: { open: 8,  close: 20 }, // Sreda
    4: { open: 8,  close: 20 }, // Četvrtak
    5: { open: 8,  close: 20 }, // Petak
    6: { open: 8,  close: 14 }, // Subota
    0: null,                     // Nedelja — zatvoreno
  };

  const statusEl    = document.getElementById('hoursStatus');
  const statusTxt   = document.getElementById('statusText');
  const navStatusEl = document.getElementById('navStatus');
  const navStatusTxt = document.getElementById('navStatusTxt');

  if (!statusEl || !statusTxt) return;

  const now     = new Date();
  const day     = now.getDay();
  const hour    = now.getHours();
  const minutes = now.getMinutes();
  const current = hour + minutes / 60;

  const todaySchedule = schedule[day];
  const isOpen = todaySchedule && current >= todaySchedule.open && current < todaySchedule.close;

  statusEl.classList.add(isOpen ? 'open' : 'closed');
  statusTxt.textContent = isOpen ? 'Otvoreno' : 'Zatvoreno';

  if (navStatusEl && navStatusTxt) {
    navStatusEl.classList.add(isOpen ? 'open' : 'closed');
    navStatusTxt.textContent = isOpen ? 'Otvoreno' : 'Zatvoreno';
  }

  // Highlight today's row
  document.querySelectorAll('.hours-row').forEach(row => {
    const days = row.dataset.days.split(',').map(Number);
    if (days.includes(day)) row.classList.add('today');
  });
})();

/* ══════════════════════════════════════════
   COPY PHONE NUMBER
══════════════════════════════════════════ */
(function () {
  const copyBtn = document.getElementById('copyPhone');
  const phoneEl = document.getElementById('phoneNumber');
  if (!copyBtn || !phoneEl) return;

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(phoneEl.textContent.trim()).then(() => {
      const label = copyBtn.querySelector('.copy-label');
      copyBtn.classList.add('copied');
      if (label) label.textContent = 'Kopirano!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        if (label) label.textContent = 'Kopiraj';
      }, 2000);
    });
  });
})();

/* ══════════════════════════════════════════
   DARK MODE TOGGLE
══════════════════════════════════════════ */
(function () {
  const toggle = document.getElementById('darkToggle');
  const html   = document.documentElement;

  // Primijeni sačuvanu preferencu odmah (default je light)
  if (localStorage.getItem('darkMode') === 'on') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
    if (!localStorage.getItem('darkMode')) localStorage.setItem('darkMode', 'off');
  }

  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'on' : 'off');
  });
})();

/* ══════════════════════════════════════════
   TESTIMONIALS CAROUSEL
══════════════════════════════════════════ */
(function () {
  const REVIEWS_KEY = 'ordinacija_reviews';

  const SEEDS = [
    { stars: 5, comment: 'Odlična ordinacija! Konačno stomatolog kod kojeg se ne osećam nervozno. Preporučujem svima.', name: 'Milica S.' },
    { stars: 5, comment: 'Profesionalan pristup i prijatna atmosfera. Zub je izvađen bez ikakvog bola.', name: 'Nikola T.' },
    { stars: 4, comment: 'Brzo zakazivanje i ljubazno osoblje. Definitivno se vraćam!', name: 'Ana K.' },
    { stars: 5, comment: 'Izbeljivanje zuba — rezultat bolji od očekivanog. Hvala doktorici Anđeli!', name: 'Jelena M.' },
    { stars: 4, comment: 'Moderna oprema i bez čekanja. Sve pohvale.', name: 'Stefan R.' },
    { stars: 5, comment: 'Moje dete je prvi put otišlo kod stomatologa bez suza. Hvala na strpljenju!', name: 'Ivana P.' },
  ];

  function getStoredReviews() {
    try { return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || []; }
    catch (_) { return []; }
  }

  function starsString(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  const track  = document.getElementById('tcTrack');
  const dotsEl = document.getElementById('tcDots');
  const prevBtn = document.getElementById('tcPrev');
  const nextBtn = document.getElementById('tcNext');
  if (!track || !dotsEl) return;

  const stored = getStoredReviews().filter(r => r.stars >= 3);
  // Realne recenzije prve, seed na kraju
  const all = [...stored, ...SEEDS];

  let current = 0;
  let timer   = null;

  function buildSlides() {
    track.innerHTML = '';
    dotsEl.innerHTML = '';
    all.forEach((r, i) => {
      const slide = document.createElement('div');
      slide.className = 'tc-slide';
      slide.innerHTML =
        '<div class="tc-quote">❝</div>' +
        '<p class="tc-text">' + r.comment + '</p>' +
        '<div class="tc-stars">' + starsString(r.stars) + '</div>' +
        '<span class="tc-name">' + (r.name || 'Anonimni pacijent') + '</span>';
      track.appendChild(slide);

      const dot = document.createElement('button');
      dot.className = 'tc-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Recenzija ' + (i + 1));
      dot.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(dot);
    });
  }

  function goTo(index) {
    current = (index + all.length) % all.length;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dotsEl.querySelectorAll('.tc-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function next() { goTo(current + 1); }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(next, 5000);
  }

  buildSlides();
  goTo(0);
  startTimer();

  // Prev / Next dugmad
  if (prevBtn) prevBtn.addEventListener('click', () => { goTo(current - 1); startTimer(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { goTo(current + 1); startTimer(); });

  const wrap = track.closest('.testimonials-carousel');
  if (wrap) {
    wrap.addEventListener('mouseenter', () => clearInterval(timer));
    wrap.addEventListener('mouseleave', startTimer);
  }

  // Touch swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { goTo(current + (diff > 0 ? 1 : -1)); startTimer(); }
  });

  // Trackpad horizontal swipe (wheel deltaX)
  let wheelAccum = 0;
  let wheelCooldown = false;
  const viewport = track.closest('.tc-viewport') || track.parentElement;
  viewport.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return; // ignoriši vertikalni scroll
    e.preventDefault();
    if (wheelCooldown) return;
    wheelAccum += e.deltaX;
    if (Math.abs(wheelAccum) > 80) {
      goTo(current + (wheelAccum > 0 ? 1 : -1));
      startTimer();
      wheelAccum = 0;
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, 600);
    }
  }, { passive: false });

  // Mouse drag
  let dragStartX = 0;
  let dragging   = false;
  track.addEventListener('mousedown', e => { dragStartX = e.clientX; dragging = true; track.classList.add('dragging'); clearInterval(timer); });
  window.addEventListener('mousemove', e => { if (!dragging) return; track.style.transform = 'translateX(calc(-' + (current * 100) + '% + ' + (e.clientX - dragStartX) + 'px))'; });
  window.addEventListener('mouseup', e => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');
    const diff = dragStartX - e.clientX;
    if (Math.abs(diff) > 60) goTo(current + (diff > 0 ? 1 : -1));
    else goTo(current);
    startTimer();
  });

  // Kada korisnik ostavi novu recenziju >= 3 zvezdice, dodaj je u carousel
  document.addEventListener('tc:newReview', function (e) {
    const { stars, comment, name } = e.detail;
    if (stars < 3) return;
    all.unshift({ stars, comment, name: name || 'Anonimni pacijent' });
    buildSlides();
    goTo(0);
    startTimer();
  });
})();

/* ══════════════════════════════════════════
   TYPED TEXT EFFECT
══════════════════════════════════════════ */
(function () {
  const el = document.getElementById('typedText');
  if (!el) return;

  const phrases = ['Vaš osmeh,', 'Vaše poverenje,', 'Vaša nega,', 'Vaša lepota,'];

  // Ako korisnik preferira smanjeno kretanje — prikaži prvu frazu statično
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = phrases[0];
    return;
  }

  let pi = 0, ci = 0, deleting = false;

  function tick() {
    const phrase = phrases[pi];
    if (!deleting) {
      el.textContent = phrase.slice(0, ++ci);
      if (ci === phrase.length) {
        deleting = true;
        return setTimeout(tick, 1800);
      }
    } else {
      el.textContent = phrase.slice(0, --ci);
      if (ci === 0) {
        deleting = false;
        pi = (pi + 1) % phrases.length;
        return setTimeout(tick, 400);
      }
    }
    setTimeout(tick, deleting ? 45 : 80);
  }

  setTimeout(tick, 900);
})();

/* ══════════════════════════════════════════
   PAGE LOADER
══════════════════════════════════════════ */
(function () {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;

  function hideLoader() {
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
  }

  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
    // Fallback: hide after 4s no matter what
    setTimeout(hideLoader, 4000);
  }
})();

/* ══════════════════════════════════════════
   COOKIE CONSENT
══════════════════════════════════════════ */
(function () {
  const COOKIE_KEY = 'cookieConsent';
  const banner     = document.getElementById('cookieBanner');
  if (!banner) return;

  // Already decided — don't show
  if (localStorage.getItem(COOKIE_KEY)) return;

  // Show after short delay so loader finishes first
  setTimeout(() => banner.classList.add('visible'), 1200);

  function dismiss(value) {
    localStorage.setItem(COOKIE_KEY, value);
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 500);
  }

  const acceptBtn  = document.getElementById('cookieAccept');
  const declineBtn = document.getElementById('cookieDecline');

  if (acceptBtn)  acceptBtn.addEventListener('click',  () => dismiss('accepted'));
  if (declineBtn) declineBtn.addEventListener('click', () => dismiss('declined'));
})();

/* ══════════════════════════════════════════
   PRINT CENOVNIK
══════════════════════════════════════════ */
(function () {
  const btn = document.getElementById('printCenovnik');
  if (!btn) return;
  btn.addEventListener('click', () => window.print());
})();

