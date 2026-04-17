// === i18n ===
const AVAILABLE_LANGS = [
  { code: 'en', name: 'English' }
];

// Draft translations — only visible at /preview
const DRAFT_LANGS = [
  { code: 'es', name: 'Español' },
  { code: 'ne', name: 'नेपाली' }
];

if (window.location.pathname.includes('/preview')) {
  AVAILABLE_LANGS.push(...DRAFT_LANGS);
}

// Cache-busting version — increment on deploy
const CACHE_V = '20260404g';

let currentLang = 'en';
let strings = {};
let entryStrings = {};

async function loadStrings(lang) {
  const resp = await fetch(`i18n/${lang}.json?v=${CACHE_V}`);
  const data = await resp.json();
  entryStrings = data.entries || {};
  // Separate UI strings from entry strings
  strings = Object.fromEntries(
    Object.entries(data).filter(([k]) => k !== 'entries')
  );
  currentLang = lang;
  document.documentElement.lang = lang;
  renderTimeline();
}

function t(key, replacements) {
  let s = strings[key] || key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      s = s.replace(`{{${k}}}`, v);
    }
  }
  return s;
}

function te(entryId, field) {
  return entryStrings[entryId]?.[field] || '';
}

// === Data & Rendering ===
let entries = [];

async function init() {
  // Load structural data
  const resp = await fetch(`data/entries.json?v=${CACHE_V}`);
  entries = await resp.json();

  // Setup lang switcher
  const select = document.getElementById('lang-select');
  AVAILABLE_LANGS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = l.name;
    select.appendChild(opt);
  });

  // Detect preferred language
  const saved = localStorage.getItem('timeline-lang');
  const browserLang = navigator.language?.slice(0, 2);
  const preferred = saved || (AVAILABLE_LANGS.find(l => l.code === browserLang) ? browserLang : 'en');
  select.value = preferred;

  select.addEventListener('change', () => {
    localStorage.setItem('timeline-lang', select.value);
    loadStrings(select.value);
  });

  await loadStrings(preferred);
  setupLightbox();
}

function renderTimeline() {
  const container = document.getElementById('timeline');
  container.innerHTML = entries.map((e, i) => {
    const title = te(e.id, 'title');
    const yearDisplay = te(e.id, 'year_display');
    const description = te(e.id, 'description');
    const artDesc = te(e.id, 'art_description');
    const altText = (artDesc || title) + ' — artwork by ' + e.artist;

    return `
    <article class="entry" id="entry-${e.id}" data-index="${i}">
      <div class="entry-card">
        <div class="entry-year">${yearDisplay}</div>
        ${e.image
          ? `<div class="entry-img-wrap" data-full="${e.image}" role="button" tabindex="0" aria-label="View artwork">
               <img src="${e.image_thumb}" alt="${altText}" loading="lazy">
             </div>`
          : `<div class="entry-img-wrap"><div class="no-image">${t('no_image')}</div></div>`
        }
        <div class="entry-body">
          <h2 class="entry-title"><a href="#entry-${e.id}" class="entry-anchor">${title}</a></h2>
          <div class="entry-artist">${t('artist')}: ${e.artist}</div>
          <p class="entry-description">${description}</p>
          <button class="entry-toggle">${t('read_more')}</button>
        </div>
      </div>
    </article>
  `;
  }).join('');

  // Toggle descriptions
  container.querySelectorAll('.entry-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const desc = btn.previousElementSibling;
      desc.classList.toggle('open');
      btn.textContent = desc.classList.contains('open') ? t('read_less') : t('read_more');
    });
  });

  // Image click -> lightbox
  container.querySelectorAll('.entry-img-wrap[data-full]').forEach(wrap => {
    const handler = () => openLightbox(wrap.dataset.full, wrap.querySelector('img').alt);
    wrap.addEventListener('click', handler);
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
  });

  // Re-apply scroll observer
  setupScrollObserver();

  // Update static i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}

// === Lightbox ===
function setupLightbox() {
  const lb = document.getElementById('lightbox');
  const close = () => { lb.hidden = true; document.body.style.overflow = ''; };
  lb.querySelector('.lightbox-close').addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

function openLightbox(src, alt) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  img.alt = alt;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
}

// === Scroll-triggered fade-in ===
function setupScrollObserver() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.entry').forEach(e => e.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.entry:nth-child(n+6)').forEach(el => {
    if (!el.classList.contains('visible')) observer.observe(el);
  });
}

// === Hash-based deep linking ===
function scrollToHash() {
  if (location.hash) {
    const el = document.querySelector(location.hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const desc = el.querySelector('.entry-description');
      const btn = el.querySelector('.entry-toggle');
      if (desc && !desc.classList.contains('open')) {
        desc.classList.add('open');
        btn.textContent = t('read_less');
      }
    }
  }
}

// Go!
init().then(() => {
  setTimeout(scrollToHash, 100);
});
window.addEventListener('hashchange', scrollToHash);
