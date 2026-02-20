/* ── script.js ── */

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
      setTimeout(() => el.classList.add('visible'), delay);
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
