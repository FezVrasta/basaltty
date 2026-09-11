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

  /* -- The basalt behind everything --------------------------------------
   *
   * The design referenced a rendered image that never came with the export.
   * It is drawn here from the same seeded generator the design used, which
   * also means it is sharp at any viewport rather than a fixed-size photo.
   */
  function rng(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }

  function drawBasalt(c) {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = rng(20260911);
    g.fillStyle = '#05080C'; g.fillRect(0, 0, w, h);

    const R = Math.max(58, Math.min(w, h) / 9);      // hex circumradius
    const dx = Math.sqrt(3) * R, dy = 1.5 * R;
    const cols = Math.ceil(w / dx) + 2, rows = Math.ceil(h / dy) + 2;
    const cells = [];
    for (let r = -1; r < rows; r++) {
      for (let q = -1; q < cols; q++) {
        const cx = q * dx + (r % 2 ? dx / 2 : 0) + (rnd() - 0.5) * R * 0.22;
        const cy = r * dy + (rnd() - 0.5) * R * 0.22;
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 180 * (60 * i - 30);
          const rr = R * (0.9 + rnd() * 0.16);
          pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
        }
        cells.push({ cx, cy, pts, tone: rnd(), lift: rnd() });
      }
    }

    const poly = (pts, scale, cx, cy) => {
      g.beginPath();
      pts.forEach((p, i) => {
        const x = cx + (p[0] - cx) * scale, y = cy + (p[1] - cy) * scale;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.closePath();
    };

    cells.forEach(({ cx, cy, pts, tone, lift }) => {
      // side wall, lit from the upper left
      const bev = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      const warm = 20 * lift;
      bev.addColorStop(0, 'rgb(' + Math.round(116 + warm) + ',' + Math.round(120 + warm) + ',' + Math.round(118 + warm * 0.6) + ')');
      bev.addColorStop(0.5, 'rgb(52,58,64)');
      bev.addColorStop(1, 'rgb(16,21,27)');
      g.fillStyle = bev;
      poly(pts, 1, cx, cy); g.fill();

      // top face
      const shade = 34 + tone * 58;
      const face = g.createLinearGradient(cx - R * 0.7, cy - R * 0.7, cx + R * 0.7, cy + R * 0.7);
      face.addColorStop(0, 'rgb(' + Math.round(shade * 1.25) + ',' + Math.round(shade * 1.3) + ',' + Math.round(shade * 1.35) + ')');
      face.addColorStop(1, 'rgb(' + Math.round(shade * 0.7) + ',' + Math.round(shade * 0.76) + ',' + Math.round(shade * 0.84) + ')');
      g.fillStyle = face;
      const inset = 0.82 - lift * 0.08;
      const ox = cx + (cx - w / 2) * 0.012, oy = cy + (cy - h / 2) * 0.012;
      poly(pts, inset, ox, oy); g.fill();

      // grain
      g.save();
      poly(pts, inset, ox, oy); g.clip();
      for (let i = 0; i < 26; i++) {
        const px = cx + (rnd() - 0.5) * R * 1.6, py = cy + (rnd() - 0.5) * R * 1.6;
        g.fillStyle = rnd() > 0.5 ? 'rgba(226,244,251,.05)' : 'rgba(4,6,10,.22)';
        g.beginPath(); g.arc(px, py, rnd() * 2.4, 0, 6.283); g.fill();
      }
      g.restore();

      // crack outline
      g.strokeStyle = 'rgba(4,6,10,.6)'; g.lineWidth = 1;
      poly(pts, 1, cx, cy); g.stroke();
    });

    const vg = g.createRadialGradient(w * 0.5, h * 0.3, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(4,6,10,.15)');
    vg.addColorStop(1, 'rgba(4,6,10,.75)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }

  function wireBasalt() {
    const band = document.querySelector('[data-basalt]');
    if (!band) return;
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    band.appendChild(c);
    const draw = () => drawBasalt(c);
    draw();
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
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

  function start() {
    wireBasalt();
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
