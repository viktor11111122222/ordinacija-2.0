/* ── script.js ── */

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

  function updateTotal() {
    const sum = calcTotal();
    totalEl.textContent = fmt(sum) + ' RSD';
    // Bump animacija
    totalEl.classList.remove('bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('bump');
    setTimeout(() => totalEl.classList.remove('bump'), 220);
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
    totalEl.textContent = '0 RSD';
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

function updateParallax() {
  const scrollY = window.scrollY;
  // Move background upward at 40% of scroll speed
  parallaxBg.style.transform = `translateY(${scrollY * 0.40}px)`;
}

window.addEventListener('scroll', updateParallax, { passive: true });

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
   STAR RATING SYSTEM
══════════════════════════════════════════ */
(function () {
  const STORAGE_KEY = 'ordinacija_ratings';
  const BASE_RATINGS = { count: 128, sum: 640 }; // 128 ocena × 5.0 prosek

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

  if (alreadyRated) {
    if (interactiveEl) interactiveEl.classList.add('disabled');
    if (submitBtn) submitBtn.style.display = 'none';
    if (successEl) successEl.classList.add('show');
    if (labelEl)   labelEl.textContent = 'Već ste glasali. Hvala!';
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
      if (submitBtn) submitBtn.disabled = false;
    });
  }

  // Submit
  if (submitBtn && !alreadyRated) {
    submitBtn.addEventListener('click', () => {
      if (selectedValue === 0) return;
      const data = saveRating(selectedValue);
      localStorage.setItem('ordinacija_user_rated', 'true');
      updateDisplay(data);
      incrementPatients();

      if (interactiveEl) interactiveEl.classList.add('disabled');
      submitBtn.style.display = 'none';
      if (successEl) successEl.classList.add('show');
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
  btn.textContent = 'Šaljemo…';
  btn.disabled    = true;
  btn.style.opacity = '.7';

  const templateParams = {
    name    : document.getElementById('name').value,
    phone   : document.getElementById('phone').value  || 'Nije unet',
    email   : document.getElementById('email').value,
    service : document.getElementById('service').value || 'Nije odabrano',
    message : document.getElementById('message').value || 'Bez poruke',
    title   : 'Novi zahtev za pregled',
  };

  // Fire and forget — email šalje u pozadini
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams).catch(() => {});

  // Odmah prikaži uspeh (email stiže bez obzira na promise)
  setTimeout(() => {
    incrementServices();
    btn.textContent     = '✓ Zahtev poslat!';
    btn.style.background = '#16a34a';
    btn.style.opacity    = '1';

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
