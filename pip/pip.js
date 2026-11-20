/* larkin · progressive enhancement only. The page reads fine without it. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ── pip, drawn ───────────────────────────────────────────────────── */
  var SQ = 'M100 50L99.9 67.4L99.6 73.8L99 78.5L98.2 82.3L97.2 85.5L96 88.3L94.5 90.7L92.7 92.7L90.7 94.5L88.3 96L85.5 97.2L82.3 98.2L78.5 99L73.8 99.6L67.4 99.9L50 100L32.6 99.9L26.2 99.6L21.5 99L17.7 98.2L14.5 97.2L11.7 96L9.3 94.5L7.3 92.7L5.5 90.7L4 88.3L2.8 85.5L1.8 82.3L1 78.5L0.4 73.8L0.1 67.4L0 50L0.1 32.6L0.4 26.2L1 21.5L1.8 17.7L2.8 14.5L4 11.7L5.5 9.3L7.3 7.3L9.3 5.5L11.7 4L14.5 2.8L17.7 1.8L21.5 1L26.2 0.4L32.6 0.1L50 0L67.4 0.1L73.8 0.4L78.5 1L82.3 1.8L85.5 2.8L88.3 4L90.7 5.5L92.7 7.3L94.5 9.3L96 11.7L97.2 14.5L98.2 17.7L99 21.5L99.6 26.2L99.9 32.6Z';
  var uid = 0;
  function pipSVG() {
    var n = ++uid;
    return '<svg class="pipsvg" viewBox="-12 -8 224 226" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<radialGradient id="pg' + n + '" cx="32%" cy="14%" r="98%">' +
          '<stop offset="0" style="stop-color:var(--c-hi)"/><stop offset=".44" style="stop-color:var(--c)"/><stop offset="1" style="stop-color:var(--c-lo)"/>' +
        '</radialGradient>' +
        '<clipPath id="pc' + n + '"><path transform="scale(2)" d="' + SQ + '"/></clipPath>' +
        '<filter id="pb' + n + '" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>' +
      '</defs>' +
      '<rect x="-7" y="80" width="16" height="42" rx="7" style="fill:var(--c-lo)"/>' +
      '<path transform="scale(2)" d="' + SQ + '" fill="url(#pg' + n + ')"/>' +
      '<g clip-path="url(#pc' + n + ')">' +
        '<ellipse cx="84" cy="27" rx="70" ry="13" fill="#fff" opacity=".5" filter="url(#pb' + n + ')"/>' +
        '<ellipse cx="100" cy="190" rx="78" ry="10" fill="#fff" opacity=".17" filter="url(#pb' + n + ')"/>' +
      '</g>' +
      '<g class="pip-eyes">' +
        '<rect class="pip-eye" x="60" y="82" width="8" height="27" rx="4"/>' +
        '<rect class="pip-eye" x="132" y="82" width="8" height="27" rx="4"/>' +
      '</g>' +
      '<circle cx="100" cy="190" r="2.6" fill="#000" opacity=".38"/>' +
    '</svg>';
  }
  $$('[data-pipsvg]').forEach(function (el) { el.innerHTML = pipSVG(); });
  var pips = $$('.pipsvg');

  /* he blinks */
  if (!reduce) {
    (function blink() {
      pips.forEach(function (p) {
        if (p.classList.contains('is-sleep') || p.classList.contains('is-listen')) return;
        p.classList.add('is-blink');
        setTimeout(function () { p.classList.remove('is-blink'); }, 130);
      });
      setTimeout(blink, 2600 + Math.random() * 3200);
    })();

    /* and he looks at you */
    var raf = 0, px = 0, py = 0;
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        pips.forEach(function (p) {
          var r = p.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight || !r.width) return;
          var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
          var d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
          $('.pip-eyes', p).style.transform = 'translate(' + (dx / d * 9 * k).toFixed(1) + 'px,' + (dy / d * 7 * k).toFixed(1) + 'px)';
        });
      });
    }, { passive: true });
  }

  /* ── colours: the whole page takes the tint of the pip you pick ───── */
  var NAMES = { cherry: 'cherry', bone: 'bone', blue: 'pearl blue', black: 'patent black' };
  var QUIPS = { cherry: 'cherry is my good side.', bone: 'bone. tasteful. like me.', blue: 'pearl blue. i feel calm. you should try it.', black: 'patent black. now i mean business.' };
  var buddySay;
  function setPip(name, announce) {
    if (!NAMES[name]) return;
    root.dataset.pip = name;
    if (announce) { try { localStorage.setItem('larkin-pip', name); } catch (e) {} }   /* remember only a colour the visitor picked */
    $$('[data-set-pip]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setPip === name)); });
    $$('[data-pip-name]').forEach(function (el) { el.textContent = NAMES[name]; });
    $$('img[data-swap]').forEach(function (img) {
      var src = 'img/' + img.dataset.swap + '-' + name + '.jpg';
      if (img.getAttribute('src') === src) return;
      var next = new Image();
      next.onload = function () {
        img.classList.add('is-out');
        setTimeout(function () { img.src = next.src; img.classList.remove('is-out'); }, reduce ? 0 : 220);
      };
      /* a colour with no device-only photo yet falls back to its on-the-phone photo */
      next.onerror = function () { if (img.dataset.swap !== 'pip') { next.onerror = null; next.src = 'img/pip-' + name + '.jpg'; } };
      next.src = src;
    });
    var colours = $('#colours');
    if (colours) colours.dataset.says = QUIPS[name];
    if (announce && buddySay) buddySay(QUIPS[name], true);
  }
  $$('[data-set-pip]').forEach(function (b) {
    b.addEventListener('click', function () { setPip(b.dataset.setPip, true); });
  });
  if (!NAMES[root.dataset.pip]) root.dataset.pip = 'cherry';
  setPip(root.dataset.pip, false);

  /* ── the founder batch: count and size, set on <html>; /batch.js updates the count ── */
  var size = 1000, count = 0, pct = 0, done = false;
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var bar = $('[data-batch-bar]'), num = $('[data-batch-num]'), meter = $('.meter');
  function read() {
    size = Math.max(1, parseInt(root.dataset.batchSize, 10) || 1000);
    count = Math.max(0, Math.min(size, parseInt(root.dataset.batchCount, 10) || 0));
    pct = count / size * 100;
    $$('[data-batch-final]').forEach(function (el) { el.textContent = fmt(count); });
    $$('[data-batch-total]').forEach(function (el) { el.textContent = fmt(size); });
    if (meter) {
      meter.style.setProperty('--fill', (pct / 100).toFixed(4));
      meter.setAttribute('aria-label', 'founder batch: ' + fmt(count) + ' of ' + fmt(size) + ' reserved');
    }
  }
  function show(f) {                                /* f goes from 0 to 1 */
    if (bar) bar.style.width = (pct * f) + '%';
    if (num) num.textContent = fmt(count * f);
  }
  read();
  window.addEventListener('larkin:batch', function () { read(); if (done) show(1); });
  if (bar && meter) {
    if (reduce || !('IntersectionObserver' in window)) { done = true; show(1); meter.classList.add('is-live'); }
    else {
      show(0);
      new IntersectionObserver(function (es, io) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        var t0 = performance.now(), D = 1800;
        (function tick(now) {
          var t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 4);   /* fast, then settles */
          show(e);
          if (t < 1) requestAnimationFrame(tick); else { done = true; meter.classList.add('is-live'); }
        })(t0);
      }, { threshold: .6 }).observe(bar.parentNode);
    }
  }

  /* ── checkout: tell PostHog and Meta which page sent the reservation ── */
  $$('a[data-reserve]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.posthog && window.posthog.capture) window.posthog.capture('reserve_clicked', { segment: 'pip' });
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', { value: 10, currency: 'USD', content_name: 'Larkin pip (Reservation)', content_category: 'pip' });
      }
    });
  });

  /* ── the hero bubble: pip's opinions, in rotation ─────────────────── */
  var OPINIONS = [
    ['after the one-to-one', 'you talked for most of it. it was her one-to-one.'],
    ['after dinner', 'five follow-up questions. he felt very interesting. well done.'],
    ['after stand-up', 'you cut in twice. both times on priya.'],
    ['after drinks', 'four sorries nobody asked for. you did nothing wrong.'],
    ['after the big talk', 'that pause before you answered? keep that.']
  ];
  var bubble = $('.bubble'), oi = 0;
  if (bubble && !reduce) {
    setInterval(function () {
      if (document.hidden) return;
      bubble.classList.add('is-out');
      setTimeout(function () {
        oi = (oi + 1) % OPINIONS.length;
        $('[data-opinion-when]', bubble).textContent = OPINIONS[oi][0];
        $('[data-opinion]', bubble).textContent = OPINIONS[oi][1];
        bubble.classList.remove('is-out');
      }, 320);
    }, 4200);
  }

  /* ── the button: press = "i'm working on this" ────────────────────── */
  var toy = $('[data-toy]');
  if (toy) {
    var btn = $('[data-toy-btn]', toy), status = $('[data-toy-status]', toy), toyPip = $('.pipsvg', toy);
    var goal = function () { return $('.chip[aria-pressed="true"]', toy); };
    $$('.chip', toy).forEach(function (c) {
      c.addEventListener('click', function () {
        $$('.chip', toy).forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
        if (btn.getAttribute('aria-pressed') === 'true') listening();
        else status.textContent = 'good one. now press.';
      });
    });
    function listening() { status.textContent = 'eyes on. he\'s listening.'; }
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      $('span', btn).textContent = on ? 'done' : 'press';
      toy.classList.toggle('is-on', on);
      if (toyPip) toyPip.classList.toggle('is-listen', on);
      if (on) listening();
      else status.textContent = 'eyes off. notes on the way.';
    });
  }

  /* ── pip in the corner, with opinions about your scrolling ────────── */
  var buddy = $('[data-buddy]');
  if (buddy) {
    var says = $('[data-buddy-says]', buddy), bp = $('.pipsvg', buddy), hide = 0, asleep = false, last = '';
    buddySay = function (text, force) {
      if (asleep || !text || (text === last && !force)) return;
      last = text;
      says.classList.remove('is-in');
      clearTimeout(hide);
      setTimeout(function () {
        says.textContent = text;
        says.classList.add('is-in');
        hide = setTimeout(function () { says.classList.remove('is-in'); }, innerWidth < 700 ? 3200 : 5200);
      }, 160);
    };
    $('[data-buddy-pip]', buddy).addEventListener('click', function () {
      asleep = !asleep;
      bp.classList.toggle('is-sleep', asleep);
      this.setAttribute('aria-label', asleep ? 'pip is asleep. press to wake him.' : 'pip. press to send him to sleep.');
      if (asleep) { clearTimeout(hide); says.textContent = 'fine. zzz.'; says.classList.add('is-in'); hide = setTimeout(function () { says.classList.remove('is-in'); }, 1800); }
      else { last = ''; buddySay('i\'m up. what did i miss.', true); }
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) buddySay(e.target.dataset.says); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      $$('[data-says]').forEach(function (s) { io.observe(s); });
    }
    /* he's already big in the hero: the corner pip turns up once you scroll past it */
    var heroEl = $('.hero');
    var away = function () { buddy.classList.toggle('is-away', !!heroEl && heroEl.getBoundingClientRect().bottom > innerHeight * .55); };
    away();
    window.addEventListener('scroll', away, { passive: true });
    window.addEventListener('resize', away);
    /* he notices when you skim */
    var ly = scrollY, lt = performance.now(), skim = 0;
    window.addEventListener('scroll', function () {
      var now = performance.now(), dt = now - lt;
      if (dt < 120) return;
      var v = Math.abs(scrollY - ly) / dt; ly = scrollY; lt = now;
      if (v > 5.5 && now - skim > 20000 && !asleep) {
        skim = now;
        bp.classList.add('is-squint');
        buddySay('you\'re skimming. i noticed.', true);
        setTimeout(function () { bp.classList.remove('is-squint'); }, 2400);
      }
    }, { passive: true });
  }

  /* ── reveals ──────────────────────────────────────────────────────── */
  var rev = $$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) rev.forEach(function (el) { el.classList.add('is-in'); });
  else {
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    rev.forEach(function (el) { ro.observe(el); });
  }
})();
