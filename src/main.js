import './style.css';

// ─── Timestamp animation ──────────────────────────────────────────
const tsEl = document.getElementById('timestamp');

const tsStates = [
  { text: '18:17:00', color: 'var(--green-mid)', opacity: '1',   dur: 2000 },
  { text: '18:17:∅', color: 'var(--text-dim)', opacity: '0.4', dur: 180  },
  { text: '06:17',   color: 'var(--blue-mid)',  opacity: '1',   dur: 1400 },
  { text: '06:17⁻', color: 'var(--text-dim)', opacity: '0.3', dur: 120  },
  { text: '18:17:01', color: 'var(--green-mid)', opacity: '1',   dur: 1800 },
  { text: '18:17:∅', color: 'var(--text-dim)', opacity: '0.4', dur: 150  },
  { text: '06:17',   color: 'var(--blue-mid)',  opacity: '1',   dur: 900  },
  { text: '18:17:02', color: 'var(--green-mid)', opacity: '1',   dur: 1600 },
];

let tsIdx = 0;

function stepTimestamp() {
  const s = tsStates[tsIdx % tsStates.length];
  if (tsEl) {
    tsEl.textContent = s.text;
    tsEl.style.color   = s.color;
    tsEl.style.opacity = s.opacity;
  }
  tsIdx++;
  setTimeout(stepTimestamp, s.dur);
}

stepTimestamp();

// ─── Easter egg ───────────────────────────────────────────────────
const eggOverlay  = document.getElementById('easter-egg');
const eggCloseBtn = document.getElementById('egg-close-btn');

function openEgg() {
  if (!eggOverlay) return;
  eggOverlay.classList.add('visible');
  eggOverlay.setAttribute('aria-hidden', 'false');
  eggCloseBtn?.focus();
}

function closeEgg() {
  if (!eggOverlay) return;
  eggOverlay.classList.remove('visible');
  eggOverlay.setAttribute('aria-hidden', 'true');
  tsEl?.focus();
}

tsEl?.addEventListener('click', () => {
  if (tsEl.textContent === '06:17') openEgg();
});

eggCloseBtn?.addEventListener('click', closeEgg);

eggOverlay?.addEventListener('click', (e) => {
  if (e.target === eggOverlay) closeEgg();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && eggOverlay?.classList.contains('visible')) closeEgg();
});

// ─── Progress bar ─────────────────────────────────────────────────
const progressBar = document.getElementById('progress-bar');

function updateProgress() {
  const scrolled = window.scrollY;
  const total    = document.documentElement.scrollHeight - window.innerHeight;
  const pct      = total > 0 ? (scrolled / total) * 100 : 0;
  if (progressBar) progressBar.style.width = pct + '%';
}

// ─── Nav scroll state ─────────────────────────────────────────────
const nav = document.getElementById('site-nav');

function updateNav() {
  nav?.classList.toggle('scrolled', window.scrollY > 10);
}

window.addEventListener('scroll', () => {
  updateProgress();
  updateNav();
}, { passive: true });

updateProgress();
updateNav();

// ─── Mobile nav toggle ────────────────────────────────────────────
const navToggle = document.querySelector('.nav-toggle');
const navLinks  = document.querySelector('.nav-links');

navToggle?.addEventListener('click', () => {
  const open = navLinks?.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(!!open));
});

navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

// ─── Scroll reveals ───────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const delay = el.classList.contains('reveal-item')
        ? (Array.from(el.parentElement?.children ?? []).indexOf(el) * 120)
        : 0;
      setTimeout(() => el.classList.add('visible'), delay);
      revealObs.unobserve(el);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal-section, .reveal-item').forEach(el => {
  revealObs.observe(el);
});

// ─── Fragments ────────────────────────────────────────────────────
const fragmentData = [
  {
    code: 'working.',
    exp:  'The system logs a single word. No timestamp. No author. The file modification date is three seconds before the first heartbeat appears on the axis.',
  },
  {
    code: 'consent?',
    exp:  'The question is in the code. It was always in the code. Whether anyone read it is a separate matter.',
  },
  {
    code: 'maintain_dream()',
    exp:  'The function exists. It has parameters. None of them are optional.',
  },
  {
    code: 'offer_exit()',
    exp:  'The daemon offers an exit. It does not say what you are exiting.',
  },
  {
    code: 'CLINICAL\n— anchor acquired',
    exp:  'INFO 18:17:02 --- CLINICAL\nANCHOR ACQUIRED: trace_03\nbiometric source confirmed\nsignal stable',
  },
  {
    code: 'exit?',
    exp:  'The prompt appears once. It does not appear again.',
  },
  {
    code: 'see you on\nthe other side',
    exp:  'Sent at 18:16:59. One minute before the merge. The recipient had not yet agreed to participate.',
  },
  {
    code: 'Local Mode,\nForever',
    exp:  'When the server goes dark, the daemon switches to local mode. Forever is not a duration. It is a flag.',
  },
  {
    code: 'Fault Tolerance',
    exp:  'The system was designed to tolerate faults. It was not designed to tolerate this one.',
  },
  {
    code: 'Common Clock',
    exp:  'Three biometric streams. Three different clocks. The daemon reconciles them every seventeen seconds. At 18:17, reconciliation takes longer than seventeen seconds.',
  },
  {
    code: 'Manual Time',
    exp:  'After the loop, Jack sets his watch manually. He sets it to 06:17. He does this every morning.',
  },
];

const wall = document.querySelector('.fragment-wall');

if (wall) {
  fragmentData.forEach((frag) => {
    const item = document.createElement('div');
    item.className = 'fragment-item';
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-expanded', 'false');

    const code = document.createElement('span');
    code.className = 'fragment-code';
    code.textContent = frag.code;

    const expWrap = document.createElement('div');
    expWrap.className = 'fragment-expanded';

    const expInner = document.createElement('div');
    expInner.className = 'fragment-expanded-inner';
    expInner.textContent = frag.exp;
    expWrap.appendChild(expInner);

    const hint = document.createElement('span');
    hint.className = 'fragment-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = '+ expand';

    item.appendChild(code);
    item.appendChild(expWrap);
    item.appendChild(hint);

    const toggle = () => {
      const expanded = item.classList.toggle('expanded');
      item.setAttribute('aria-expanded', String(expanded));
      hint.textContent = expanded ? '− collapse' : '+ expand';
    };

    item.addEventListener('click', toggle);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    wall.appendChild(item);
  });
}

// ─── Footer live timestamp ────────────────────────────────────────
const footerTs = document.getElementById('footer-timestamp');

function updateFooterTs() {
  if (!footerTs) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  footerTs.textContent = `${h}:${m}:${s}`;
}

updateFooterTs();
setInterval(updateFooterTs, 1000);

// ─── ECG path length calibration ─────────────────────────────────
const ecgPath = document.getElementById('ecg-path');
if (ecgPath) {
  try {
    const len = Math.ceil(ecgPath.getTotalLength());
    ecgPath.style.strokeDasharray  = len;
    ecgPath.style.strokeDashoffset = len;
    ecgPath.style.setProperty('--ecg-len', len);
  } catch (_) {
    // CSS fallback value already set
  }
}
