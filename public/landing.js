/*
 * The behaviour the design carried in its canvas runtime, ported to the page.
 *
 * The design tool renders through React: `ref="{{ setVideo }}"`, `style="{{
 * thumbStyle }}"` and the rest are props a component computes every render.
 * None of that survives an export, so the exported page came up with literal
 * braces on screen and dead controls. Rather than ship React and a 70KB
 * canvas runtime to serve one landing page, the same logic lives here against
 * data attributes, one function per thing the design actually does.
 */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* -- Liquid Glass -------------------------------------------------------
   *
   * A rounded rect's normal map, painted into a canvas and fed to an SVG
   * displacement filter: the pixels behind the element bend away from its rim
   * the way they do behind real glass. The map depends on the element's size,
   * so it is rebuilt when that changes and cached when it hasn't.
   */
  function glassMap(w, h, radius, edge, amount) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    const hw = cv.width / 2, hh = cv.height / 2;
    const r = Math.min(radius, hw, hh);
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const px = x + 0.5 - hw, py = y + 0.5 - hh;
        const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
        const mx = Math.max(qx, 0), my = Math.max(qy, 0);
        const d = Math.hypot(mx, my) + Math.min(Math.max(qx, qy), 0) - r; // negative inside
        const t = Math.max(0, Math.min(1, 1 + d / edge));                 // 1 at the rim
        const s = t * t * (3 - 2 * t);
        let nx, ny;
        if (mx > 0 || my > 0) { const L = Math.hypot(mx, my) || 1; nx = (mx / L) * Math.sign(px); ny = (my / L) * Math.sign(py); }
        else if (qx > qy) { nx = Math.sign(px); ny = 0; }
        else { nx = 0; ny = Math.sign(py); }
        const i = (y * cv.width + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, 128 + nx * amount * s));
        img.data[i + 1] = Math.max(0, Math.min(255, 128 + ny * amount * s));
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }

  const SVG = 'http://www.w3.org/2000/svg';

  function applyGlass() {
    const defs = document.getElementById('lgDefs');
    if (!defs) return;
    $('[data-glass]').forEach((el, n) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const key = Math.round(rect.width) + 'x' + Math.round(rect.height);
      if (el.__glassKey === key) return;
      el.__glassKey = key;
      const id = 'lgF' + n;
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;
      const edge = Math.max(10, Math.min(rect.height / 2, 34));
      const href = glassMap(rect.width, rect.height, radius, edge, 127);
      let f = defs.querySelector('#' + id);
      if (!f) {
        f = document.createElementNS(SVG, 'filter');
        f.setAttribute('id', id);
        f.setAttribute('filterUnits', 'userSpaceOnUse');
        f.setAttribute('color-interpolation-filters', 'sRGB');
        f.innerHTML = '<feImage preserveAspectRatio="none" result="map"></feImage>' +
          '<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>';
        defs.appendChild(f);
      }
      f.setAttribute('x', 0); f.setAttribute('y', 0);
      f.setAttribute('width', rect.width); f.setAttribute('height', rect.height);
      const fe = f.querySelector('feImage');
      fe.setAttribute('x', 0); fe.setAttribute('y', 0);
      fe.setAttribute('width', rect.width); fe.setAttribute('height', rect.height);
      fe.setAttribute('href', href);
      f.querySelector('feDisplacementMap').setAttribute('scale', el.getAttribute('data-glass-scale') || 26);
      const blur = el.getAttribute('data-glass-blur') || '10px';
      // Safari does not composite an SVG filter inside backdrop-filter, so it
      // gets the blur and the saturation without the refraction rather than
      // nothing at all.
      el.style.backdropFilter = 'blur(' + blur + ') url(#' + id + ') saturate(180%) brightness(1.08)';
      el.style.webkitBackdropFilter = 'blur(' + blur + ') saturate(180%) brightness(1.08)';
    });
  }

  /* -- Parallax on the band, and the fade that rides with it -------------- */
  function wireParallax() {
    const bands = $('[data-band]');
    const fade = document.querySelector('[data-fade]');
    const root = document.querySelector('[data-root]');
    if (!bands.length || !root) return;
    const update = () => {
      const vh = innerHeight;
      const max = Math.max(1, root.scrollHeight - vh);
      const y = Math.min(max, Math.max(0, -root.getBoundingClientRect().top));
      const prog = y / max;
      const shift = -prog * vh * 1.6;
      if (fade && bands[0]) {
        const bottom = bands[0].offsetTop + bands[0].offsetHeight + shift;
        fade.style.top = (bottom - fade.offsetHeight) + 'px';
      }
      bands.forEach(b => { b.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)'; });
    };
    if (reduce) { requestAnimationFrame(update); return; }
    const tick = () => { update(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  /* -- Videos play while they are on screen and pause when they leave ----- */
  function wireVideos() {
    const videos = $('[data-video]');
    if (!videos.length) return;
    videos.forEach(v => { v.muted = true; });
    if (reduce) { videos.forEach(v => { v.controls = true; }); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) {
          if (v.preload === 'none') v.preload = 'auto';
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.35 });
    videos.forEach(v => io.observe(v));
  }

  /* -- The pill that follows the pointer across the nav ------------------- */
  function wireNav() {
    const nav = document.querySelector('[data-nav]');
    const pill = document.querySelector('[data-navpill]');
    if (!nav || !pill) return;
    $('[data-navlink]', nav).forEach(link => {
      link.addEventListener('mouseenter', () => {
        pill.style.left = link.offsetLeft + 'px';
        pill.style.width = link.offsetWidth + 'px';
        pill.style.opacity = '1';
      });
    });
    nav.addEventListener('mouseleave', () => { pill.style.opacity = '0'; });
  }

  /* -- The hero's layout switcher ----------------------------------------
   *
   * One source of truth: the button's own `aria-selected`. The thumb is
   * measured off the selected button rather than positioned by index, so it
   * stays right when the labels reflow at a narrow width.
   */
  function wireHero() {
    const list = document.querySelector('[data-list]');
    const thumb = document.querySelector('[data-thumb]');
    if (!list) return;
    const tabs = $('[data-mode]', list);
    const shots = $('[data-hero]');
    let squishTimer;

    const measure = () => {
      const active = tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0];
      if (!thumb || !active || !active.offsetWidth) return;
      thumb.style.left = active.offsetLeft + 'px';
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.opacity = '1';
    };

    const pick = mode => {
      if (tabs.find(t => t.getAttribute('aria-selected') === 'true')?.dataset.mode === mode) return;
      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
      shots.forEach(s => { s.style.opacity = s.dataset.hero === mode ? '1' : '0'; });
      measure();
      if (reduce || !thumb) return;
      clearTimeout(squishTimer);
      thumb.style.transform = 'scaleX(1.1) scaleY(.86)';
      squishTimer = setTimeout(() => { thumb.style.transform = ''; }, 320);
    };

    tabs.forEach(t => t.addEventListener('click', () => pick(t.dataset.mode)));
    requestAnimationFrame(measure);
    addEventListener('resize', measure);
    // Web fonts land after first paint and change the labels' width.
    if (document.fonts) document.fonts.ready.then(measure);
  }

  /* -- style-hover, the design tool's inline hover state ------------------ */
  function wireHover() {
    $('[style-hover]').forEach(el => {
      const base = el.getAttribute('style') || '';
      const hover = el.getAttribute('style-hover');
      el.addEventListener('mouseenter', () => { el.setAttribute('style', base + ';' + hover); });
      el.addEventListener('mouseleave', () => { el.setAttribute('style', base); });
      el.addEventListener('focus', () => { el.setAttribute('style', base + ';' + hover); });
      el.addEventListener('blur', () => { el.setAttribute('style', base); });
    });
  }

  /* -- The footer's rotating credit --------------------------------------- */
  function wireCredit() {
    const el = document.querySelector('[data-credit]');
    if (!el || reduce) return;
    const credits = ['Floating UI', 'Bootstrap Material Design', 'Popper.js', 'cafe-hass'];
    let i = 0;
    setInterval(() => { i = (i + 1) % credits.length; el.textContent = credits[i]; }, 2400);
  }

  /* -- Which version the download button is handing out -------------------
   *
   * The link itself is `releases/latest/download/Basaltty.dmg`, which GitHub
   * resolves — so the button is right without anyone editing the page. The
   * number beside it comes from the same appcast the app's own updater reads,
   * rather than from a second source that could disagree with it.
   */
  async function wireVersion() {
    const label = document.querySelector('[data-version]');
    if (!label) return;
    try {
      const response = await fetch('appcast.xml', { cache: 'no-cache' });
      if (!response.ok) return;
      const feed = new DOMParser().parseFromString(await response.text(), 'application/xml');
      const version = feed.querySelector('item title')?.textContent?.trim();
      if (version) label.textContent = 'Version ' + version + '.';
    } catch {
      // No version beside the button is fine; a wrong one is not.
    }
  }

  function start() {
    wireVersion();
    wireParallax();
    wireVideos();
    wireNav();
    wireHero();
    wireHover();
    wireCredit();
    requestAnimationFrame(applyGlass);
    setTimeout(applyGlass, 400);
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(applyGlass, 180); });
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
