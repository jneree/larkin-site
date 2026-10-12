/* Larkin V6 (V5 plus the how-it-works story) — progressive enhancement only. The page is fully usable without this. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOut = function (p) { return 1 - Math.pow(1 - p, 3); };

  /* ---- Ready: the moment the curtain lifts -------------------------------- */
  /* Everything that should start with the reveal (the hero film, the hero
     lines) waits for this. Without a curtain it fires at once. */
  var readyFns = [], isReady = false;
  var onReady = function (fn) { if (isReady) fn(); else readyFns.push(fn); };
  var ready = function () {
    if (isReady) return;
    isReady = true;
    root.classList.add('is-ready');
    readyFns.forEach(function (fn) { fn(); });
    readyFns = [];
  };

  /* ---- Intro ---------------------------------------------------------------- */
  /* The ink curtain stays up for at least 1.25 s, until the hero's resting
     frame has arrived, and never past 2.6 s. Once per visit. */
  var intro = document.querySelector('[data-intro]');
  if (intro) {
    var seen = false;
    try { seen = sessionStorage.getItem('v6-intro') === '1'; } catch (e) {}
    if (reduceMotion || seen) {
      intro.hidden = true;
      ready();
    } else {
      try { sessionStorage.setItem('v6-intro', '1'); } catch (e) {}
      var poster = document.querySelector('.hero__poster');
      var posterReady = new Promise(function (res) {
        if (!poster || poster.complete) return res();
        poster.addEventListener('load', res, { once: true });
        poster.addEventListener('error', res, { once: true });
      });
      var wait = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
      Promise.race([Promise.all([posterReady, wait(1250)]), wait(2600)]).then(function () {
        intro.classList.add('is-out');
        setTimeout(ready, 220);
        var gone = function () { intro.hidden = true; };
        intro.addEventListener('animationend', gone, { once: true });
        setTimeout(gone, 1500);
      });
    }
  } else {
    ready();
  }

  /* ---- Header ---------------------------------------------------------------- */
  /* Clear over the hero (.over-hero), white while the film behind it is dark
     (.on-dark, set by the hero below), a frosted pill once scrolled
     (.is-floating). Scrolling down hides it, any scroll up brings it back,
     never while something in it has focus. The nav lights the link of the
     section that holds the middle of the screen. */
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('[data-hero]');
  if (header) {
    var lastY = window.scrollY, pending = false;
    var headLinks = [].slice.call(header.querySelectorAll('.nav a'));
    var headTargets = headLinks.map(function (a) {
      var h = a.getAttribute('href');
      return h && h.charAt(0) === '#' ? document.querySelector(h) : null;
    });
    var lit = -2;
    // Only one Reserve on screen: the header's steps aside while one in the page is in view.
    var pageCtas = [].slice.call(document.querySelectorAll('main [data-reserve]'));
    var place = function () {
      pending = false;
      var y = window.scrollY;
      var vh = window.innerHeight;
      header.classList.toggle('cta-off', pageCtas.some(function (c) {
        var r = c.getBoundingClientRect();
        return r.width > 0 && r.bottom > 0 && r.top < vh;
      }));
      var atTop = y < 10;
      header.classList.toggle('is-floating', !atTop);
      header.classList.toggle('over-hero', atTop && !!hero);
      if (atTop || header.contains(document.activeElement)) {
        header.classList.remove('is-hidden');
      } else if (y > lastY + 6) {
        header.classList.add('is-hidden');
      } else if (y < lastY - 6) {
        header.classList.remove('is-hidden');
      }
      lastY = y;

      var mid = window.innerHeight * 0.45, at = -1;
      headTargets.forEach(function (t, i) {
        if (!t) return;
        var r = t.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) at = i;
      });
      if (at !== lit) {
        lit = at;
        headLinks.forEach(function (a, i) {
          a.classList.toggle('is-active', i === at);
          if (i === at) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      }
    };
    window.addEventListener('scroll', function () {
      if (!pending) { pending = true; requestAnimationFrame(place); }
    }, { passive: true });
    window.addEventListener('resize', function () {
      if (!pending) { pending = true; requestAnimationFrame(place); }
    }, { passive: true });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    place();
  }

  /* ---- One scroll loop ------------------------------------------------------- */
  /* The scroll-linked pieces (the hero lifting away, the photos drifting,
     the module scrubbing) share one frame loop. Each registers a function
     that gets the frame; the loop keeps running while anything is still
     easing towards where the scroll put it. */
  var linked = [], loopOn = false, settling = false;
  var frame = function () {
    loopOn = false;
    settling = false;
    var vh = window.innerHeight || root.clientHeight;
    for (var i = 0; i < linked.length; i++) {
      if (linked[i](vh)) settling = true;
    }
    if (settling) { loopOn = true; requestAnimationFrame(frame); }
  };
  var kick = function () { if (!loopOn) { loopOn = true; requestAnimationFrame(frame); } };
  var link = function (fn) { linked.push(fn); kick(); };
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick, { passive: true });

  /* ---- Hero film -------------------------------------------------------------- */
  /* The film plays once and rests on its last frame, which is also the
     poster underneath it. It's requested as soon as this script runs, so it
     is buffered while the curtain is up, and starts the moment the curtain
     lifts. The copy and the header follow the film: measured from the
     footage, the text side of the frame is bright for the first 0.7 s, dark
     until 5.1 s (a sleeve, then close-ups of the module), then bright again. */
  var DARK_FROM = 0.7, DARK_TO = 5.1;
  var video = hero && hero.querySelector('.hero__video');
  if (hero && video) {
    var raf = 0;

    /* The header is clear over the film, so each of its words takes the
       colour that reads best against the frame right behind it. On every new
       frame (requestVideoFrameCallback, else a quick timer) the frame is
       drawn into a small thumbnail, the patch behind the wordmark and behind
       each nav link is averaged, and a word turns white (.on-dark) where
       white out-contrasts ink. If the film can't be read, the timings above
       stand in for every word at once. */
    var tones = header ? [].slice.call(header.querySelectorAll('.brand, .nav a')) : [];
    var thumb = document.createElement('canvas');
    var tctx = thumb.getContext && thumb.getContext('2d');
    var canRead = !!tctx, lastRead = 0;
    var lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    var readTones = function (force) {
      if (!canRead || !tones.length || !header.classList.contains('over-hero')) return;
      var now = Date.now();
      if (!force && now - lastRead < 30) return;
      var vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh || video.readyState < 2 || !hero.classList.contains('is-playing')) return;
      lastRead = now;
      var tw = 192, th = Math.round(tw * vh / vw);
      if (thumb.width !== tw) thumb.width = tw;
      if (thumb.height !== th) thumb.height = th;
      var box = video.getBoundingClientRect();
      var scale = Math.max(box.width / vw, box.height / vh);
      var at = getComputedStyle(video).objectPosition.split(' ');
      var offX = (box.width - vw * scale) * ((parseFloat(at[0]) || 50) / 100);
      var offY = (box.height - vh * scale) * ((parseFloat(at[1]) || 50) / 100);
      var k = tw / vw / scale;
      var spots = tones.map(function (el) {
        var r = el.getBoundingClientRect();
        return [
          Math.max(0, Math.floor((r.left - box.left - offX) * k)),
          Math.max(0, Math.floor((r.top - box.top - offY) * k)),
          Math.min(tw, Math.ceil((r.right - box.left - offX) * k)),
          Math.min(th, Math.ceil((r.bottom - box.top - offY) * k))
        ];
      });
      var yMin = th, yMax = 0;
      spots.forEach(function (s) { if (s[2] > s[0] && s[3] > s[1]) { yMin = Math.min(yMin, s[1]); yMax = Math.max(yMax, s[3]); } });
      if (yMax <= yMin) return;
      try {
        tctx.drawImage(video, 0, 0, tw, th);
        var band = tctx.getImageData(0, yMin, tw, yMax - yMin).data;
        spots.forEach(function (s, n) {
          if (s[2] <= s[0] || s[3] <= s[1]) return;
          var sum = 0, count = 0;
          for (var y = s[1]; y < s[3]; y++) {
            for (var x = s[0]; x < s[2]; x++) {
              var i = ((y - yMin) * tw + x) * 4;
              sum += 0.2126 * lin(band[i]) + 0.7152 * lin(band[i + 1]) + 0.0722 * lin(band[i + 2]);
              count++;
            }
          }
          var lum = sum / count, el = tones[n];
          el.classList.toggle('on-dark', el.classList.contains('on-dark') ? lum < 0.24 : lum < 0.16);
        });
      } catch (e) {
        canRead = false;
      }
    };
    var perFrame = 'requestVideoFrameCallback' in video, framing = false;
    var onFrame = function () {
      framing = false;
      readTones(true);
      watchFrames();
    };
    var watchFrames = function () {
      if (!perFrame || framing || video.paused || video.ended) return;
      framing = true;
      video.requestVideoFrameCallback(onFrame);
    };

    var setDark = function (dark) {
      hero.classList.toggle('is-dark', dark);
      if (!canRead) tones.forEach(function (el) { el.classList.toggle('on-dark', dark); });
    };
    var sync = function () {
      var t = video.currentTime;
      setDark(t >= DARK_FROM && t < DARK_TO);
      if (!perFrame) readTones(false);
      if (!video.paused && !video.ended) raf = requestAnimationFrame(sync);
    };
    var pickSource = function () {
      var d = video.dataset;
      if (window.matchMedia('(max-aspect-ratio: 4/5)').matches) return d.srcPhone;
      var c = navigator.connection || {};
      var slow = c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '');
      var fast = !slow && !(c.downlink && c.downlink < 10);
      var need = Math.max(hero.offsetWidth, hero.offsetHeight * 16 / 9) * (window.devicePixelRatio || 1);
      if (slow) return d.srcSm;
      return need > 2800 && fast ? d.srcXxl : need > 2100 ? d.srcXl : need > 1400 ? d.srcLg : d.srcSm;
    };
    var attach = function () {
      if (video.getAttribute('src')) return;
      video.preload = 'auto';
      video.src = pickSource();
      video.load();
    };
    video.addEventListener('playing', function () {
      hero.classList.add('is-playing');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
      watchFrames();
    });
    video.addEventListener('pause', function () {
      cancelAnimationFrame(raf);
      readTones(true);
    });
    video.addEventListener('ended', function () {
      cancelAnimationFrame(raf);
      setDark(false);
      readTones(true);
    });
    video.addEventListener('seeked', function () { readTones(true); });
    window.addEventListener('resize', function () { readTones(true); }, { passive: true });
    if (header) {
      // Back at the top after scrolling, the words take their colours again.
      window.addEventListener('scroll', function () {
        if (window.scrollY < 10) readTones(true);
      }, { passive: true });
    }
    var play = function () {
      video.muted = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    };
    if (!reduceMotion) {
      attach();
      onReady(function () {
        if (video.readyState >= 3) play();
        else video.addEventListener('canplay', play, { once: true });
      });
    }

    /* Scrolling lifts the film away: the frame shrinks a little, rounds its
       corners and fades towards the white of the page. */
    var heroFrame = hero.querySelector('.hero__frame');
    if (heroFrame && !reduceMotion) {
      var lastP = -1;
      link(function (vh) {
        var h = hero.offsetHeight || vh;
        var y = window.scrollY;
        if (y > h * 1.2 && lastP === 1) return false;
        var p = clamp(y / (h * 0.9), 0, 1);
        if (p === lastP) return false;
        lastP = p;
        var e = easeOut(p);
        heroFrame.style.setProperty('--exit-s', (1 - 0.1 * e).toFixed(4));
        heroFrame.style.setProperty('--exit-r', (44 * e).toFixed(1) + 'px');
        heroFrame.style.setProperty('--exit-o', (1 - 0.35 * p).toFixed(3));
        return false;
      });
    }
  }

  /* ---- Scroll reveals ----------------------------------------------------- */
  root.classList.add('js-anim');
  var reveals = document.querySelectorAll('.rv');
  var rvo = null;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    rvo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        rvo.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) {
      if (el.getBoundingClientRect().bottom < 0) el.classList.add('in');
      else rvo.observe(el);
    });
  }

  /* ---- Parallax ------------------------------------------------------------- */
  /* A photo inside its frame drifts a little slower than the page: its
     offset follows where the frame is on screen, eased, so it settles after
     the scroll stops. */
  var drifts = [].slice.call(document.querySelectorAll('[data-parallax]'));
  if (drifts.length && !reduceMotion) {
    var items = drifts.map(function (el) {
      return { el: el, box: el.parentNode, k: parseFloat(el.getAttribute('data-parallax')) || 40, cur: 0, tgt: 0 };
    });
    link(function (vh) {
      var moving = false;
      items.forEach(function (it) {
        var r = it.box.getBoundingClientRect();
        if (r.bottom > -it.k && r.top < vh + it.k) {
          var p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
          it.tgt = clamp(p, -1, 1) * it.k;
        }
        if (Math.abs(it.tgt - it.cur) > 0.05) {
          it.cur = lerp(it.cur, it.tgt, 0.12);
          it.el.style.transform = 'translate3d(0,' + it.cur.toFixed(2) + 'px,0)';
          moving = true;
        }
      });
      return moving;
    });
  }

  /* ---- How it works: one continuous flow ---------------------------------- */
  /* On wide screens the section pins and the scroll plays it: first only
     the sound streams out of the picture and into the band; then, step by
     step, insight comes out of the band's other side, a new card with
     each step, the older ones rising; then the pin ends and the band goes
     on its journey to the next section. The sound itself always moves in
     time, so it never freezes between steps. On phones nothing pins: the
     flow runs on its own while the section is on screen, a card every
     few seconds. The paths come from where the parts are on this screen
     (geo), so the same flow runs down a phone. */
  var flow = document.querySelector('[data-flow]');
  var fCanvas = flow && flow.querySelector('.flow__canvas');
  var fx = fCanvas && fCanvas.getContext && fCanvas.getContext('2d');
  if (flow && fx && !reduceMotion && 'IntersectionObserver' in window) {
    flow.classList.add('is-live');
    var fPin = flow.querySelector('.flow__pin');
    var fStage = flow.querySelector('.flow__stage');
    var fCtx = flow.querySelector('.flow__context');
    var fDevice = flow.querySelector('.flow__device');
    var fOut = flow.querySelector('.flow__out');
    var fCards = [].slice.call(flow.querySelectorAll('.flow__card'));
    // The module's middle and half-width in the band's picture, as
    // fractions of its width and height.
    var F_MOD = [0.45, 0.558], F_HALF = 0.132;
    // In time (phones): the first card, then one every PERIOD, the pulse
    // running TRAVEL ahead of it. On the scroll: the first card at T0 of
    // the pin's progress, then one every STEP, the pulse running ahead.
    var PERIOD = 3.0, TRAVEL = 0.8, FIRST = 1.6, T0 = 0.3, STEP = 0.11;
    var F = null, fOn = false, fRaf = 0, t0 = 0, fCount = -1, fP = 0, fTgt = 0, fPinned = false;
    var fSpan = function (v, a, b) { return clamp((v - a) / (b - a), 0, 1); };
    var fSmooth = function (a, b, v) { var t = fSpan(v, a, b); return t * t * (3 - 2 * t); };
    var fEaseIO = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var fPx = function (v) { return v.toFixed(1) + 'px'; };

    // A quadratic path, sampled: points with the distance along it and
    // its normal, so a wave can ride on it.
    var fPath = function (S, C, T, N) {
      var pts = [], len = 0, prev = null;
      for (var j = 0; j <= N; j++) {
        var u = j / N, iu = 1 - u;
        var q = { x: iu * iu * S[0] + 2 * iu * u * C[0] + u * u * T[0], y: iu * iu * S[1] + 2 * iu * u * C[1] + u * u * T[1], u: u };
        var tx = 2 * iu * (C[0] - S[0]) + 2 * u * (T[0] - C[0]), ty = 2 * iu * (C[1] - S[1]) + 2 * u * (T[1] - C[1]);
        var tl = Math.sqrt(tx * tx + ty * ty) || 1;
        q.nx = -ty / tl; q.ny = tx / tl;
        if (prev) len += Math.sqrt((q.x - prev.x) * (q.x - prev.x) + (q.y - prev.y) * (q.y - prev.y));
        q.s = len; pts.push(q); prev = q;
      }
      pts.len = len;
      return pts;
    };
    var fAt = function (pts, u) {
      var i = Math.min(pts.length - 1, Math.max(0, Math.round(u * (pts.length - 1))));
      return pts[i];
    };

    // Pinned on wide screens with room for it; in time otherwise.
    var fMode = function () {
      var pinned = window.innerWidth >= 900 && window.innerHeight >= 640;
      if (pinned !== fPinned) {
        fPinned = pinned;
        flow.classList.toggle('is-pinned', pinned);
        fCount = -1;
      }
    };

    // Where the parts are on this screen: the picture's exit, the module's
    // ends, the newest slot; the sound's path and the insight's path.
    var fGeo = function () {
      fMode();
      var sr = fStage.getBoundingClientRect();
      if (!sr.width) return;
      var rel = function (r) { return { l: r.left - sr.left, t: r.top - sr.top, w: r.width, h: r.height }; };
      var narrow = window.innerWidth < 900;
      var c = rel(fCtx.getBoundingClientRect()), d = rel(fDevice.getBoundingClientRect()), o = rel(fOut.getBoundingClientRect());
      var mod = [d.l + F_MOD[0] * d.w, d.t + F_MOD[1] * d.h], half = F_HALF * d.w;
      var inEnd = [mod[0] - half * 0.9, mod[1]], outStart = [mod[0] + half * 0.9, mod[1]];
      var S, Cc, T, sound, line = null;
      if (narrow) {
        // Out of the picture's bottom, straight down into the module's top.
        S = [mod[0], c.t + c.h - 2];
        T = [mod[0], mod[1] - d.h * 0.06];
        Cc = [S[0], (S[1] + T[1]) / 2];
        sound = fPath(S, Cc, T, 220);
      } else {
        S = [c.l + c.w - 2, c.t + c.h / 2];
        T = inEnd;
        Cc = [(S[0] + T[0]) / 2, (S[1] + T[1]) / 2];
        sound = fPath(S, Cc, T, 220);
        // A clean line from the band to the newest slot's edge.
        var cardTop = fCards[0].offsetTop, cardH = fCards[0].offsetHeight;
        var e = [o.l - 10, o.t + cardTop + cardH / 2];
        line = fPath(outStart, [(outStart[0] + e[0]) / 2, (outStart[1] + e[1]) / 2], e, 60);
      }
      // Where a card is born: the module, relative to the newest slot.
      var c0 = fCards[0];
      var slotX = o.l + c0.offsetLeft, slotY = o.t + c0.offsetTop;
      fOut.style.setProperty('--ex', fPx(mod[0] - slotX - c0.offsetWidth / 2));
      fOut.style.setProperty('--ey', fPx(mod[1] - slotY - c0.offsetHeight / 2));

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      fCanvas.width = Math.round(sr.width * dpr);
      fCanvas.height = Math.round(sr.height * dpr);
      F = { W: sr.width, H: sr.height, dpr: dpr, sound: sound, line: line, narrow: narrow, amp: Math.min(sr.width * 0.028, 30) };
    };

    // The sound: a line and a fainter echo of it, crests and speech-like
    // bursts travelling along the path into the band, narrowing to nothing
    // at the module.
    var F_STRANDS = [[1, 0, 1.5, 0.9], [0.6, 2.1, 1, 0.28]];
    var F_SPEED = 110;
    var fDrawSound = function (t, amp) {
      if (amp <= 0.01) return;
      var pts = F.sound;
      var grad = fx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
      grad.addColorStop(0, 'rgba(21, 21, 21, 0)');
      grad.addColorStop(0.08, 'rgba(21, 21, 21, 1)');
      grad.addColorStop(0.9, 'rgba(21, 21, 21, 1)');
      grad.addColorStop(1, 'rgba(160, 190, 40, 1)');
      fx.strokeStyle = grad;
      fx.lineCap = 'round';
      fx.lineJoin = 'round';
      F_STRANDS.forEach(function (st) {
        fx.lineWidth = st[2];
        fx.globalAlpha = st[3];
        fx.beginPath();
        for (var j = 0; j < pts.length; j++) {
          var q = pts[j], u = q.u;
          var env = fSmooth(0, 0.08, u) * (1 - fSmooth(0.8, 1, u));
          var ph = q.s - F_SPEED * t;
          var burst = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(ph / 300 * Math.PI * 2 + st[1])), 2);
          var d = F.amp * amp * st[0] * env * burst * (0.6 * Math.sin(ph / 16 + st[1]) + 0.3 * Math.sin(ph / 7.4 + st[1] * 1.7) + 0.1 * Math.sin(ph / 3.6));
          var x = q.x + q.nx * d, y = q.y + q.ny * d;
          if (j) fx.lineTo(x, y); else fx.moveTo(x, y);
        }
        fx.stroke();
      });
      fx.globalAlpha = 1;
    };
    // The insight's path: a thin line, and a pulse running along it ahead
    // of each new card (u from 0 to 1, or less than 0 for none).
    var fDrawLine = function (amp, u) {
      var pts = F.line;
      if (!pts || amp <= 0.01) return;
      fx.strokeStyle = 'rgba(21, 21, 21, ' + (0.28 * amp).toFixed(3) + ')';
      fx.lineWidth = 1;
      fx.beginPath();
      fx.moveTo(pts[0].x, pts[0].y);
      fx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      fx.stroke();
      if (u < 0 || u > 1) return;
      var e = fEaseIO(u);
      for (var i = 5; i >= 0; i--) {
        var q = fAt(pts, Math.max(0, e - i * 0.035));
        fx.fillStyle = 'rgba(21, 21, 21, ' + (amp * (1 - i / 6) * (i ? 0.35 : 1)).toFixed(3) + ')';
        fx.beginPath();
        fx.arc(q.x, q.y, i ? 2 : 3.2, 0, Math.PI * 2);
        fx.fill();
      }
    };

    // How many insights are out. The newest takes the first slot, the
    // older ones move on; one taken back (scrolling up) eases back into
    // the band.
    var fSet = function (k) {
      if (k === fCount) return;
      var was = fCount;
      fCount = k;
      fCards.forEach(function (card, i) {
        var age = k - 1 - i;
        if (age < 0) {
          card.className = 'flow__card ' + (i === k && was > k ? 'is-back' : 'is-born');
        } else if (age === 0 && k > was) {
          card.className = 'flow__card is-born';
          void card.offsetWidth;
          requestAnimationFrame(function () { if (fCount === k) card.className = 'flow__card is-s0'; });
        } else {
          card.className = 'flow__card ' + (age < 3 ? 'is-s' + age : 'is-gone');
        }
      });
      flow.classList.toggle('is-out', k > 0);
    };

    var fFrame = function (now) {
      fRaf = 0;
      if (!fOn || !F) return;
      var t = (now - t0) / 1000;
      fx.setTransform(F.dpr, 0, 0, F.dpr, 0, 0);
      fx.clearRect(0, 0, F.W, F.H);
      var amp, lineA, k, u;
      if (fPinned) {
        var p = fP;
        amp = fSmooth(0.02, 0.14, p);
        lineA = fSmooth(T0 - 0.08, T0 - 0.02, p);
        k = clamp(Math.floor((p - T0) / STEP) + 1, 0, fCards.length);
        var next = T0 + k * STEP;
        u = k < fCards.length ? fSpan(p, next - STEP * 0.6, next) : -1;
        if (u >= 1) u = -1;
      } else {
        amp = fSmooth(0.4, 1.6, t);
        lineA = fSmooth(1.2, 2, t);
        // Six cards, a pause, then again.
        var kk = Math.floor((t - FIRST) / PERIOD) + 1, cyc = ((kk % 9) + 9) % 9;
        k = clamp(cyc, 0, fCards.length);
        var tn = FIRST + kk * PERIOD;
        u = k < fCards.length && t > FIRST - TRAVEL ? fSpan(t, tn - TRAVEL, tn) : -1;
        if (u >= 1) u = -1;
      }
      fDrawSound(t, amp);
      fDrawLine(lineA, u);
      fSet(k);
      if (t > 1.3 && !flow.classList.contains('is-lit')) flow.classList.add('is-lit');
      fRaf = requestAnimationFrame(fFrame);
    };

    var fStart = function () {
      if (fOn) return;
      fOn = true;
      flow.classList.add('is-in');
      t0 = performance.now();
      fCount = -1;
      fCards.forEach(function (el) { el.className = 'flow__card is-born'; });
      fGeo();
      if (!fRaf) fRaf = requestAnimationFrame(fFrame);
    };
    var fStop = function () {
      fOn = false;
      flow.classList.remove('is-in', 'is-lit');
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.clearRect(0, 0, fCanvas.width, fCanvas.height);
    };

    fGeo();
    window.addEventListener('resize', fGeo, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fGeo);
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) fStart(); else fStop(); });
    }, { threshold: 0.3 }).observe(fStage);

    // The pin's progress, eased so a flick never jumps.
    link(function (vh) {
      if (!fPinned) return false;
      var r = fPin.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return false;
      fTgt = clamp(-r.top / Math.max(1, fPin.offsetHeight - vh), 0, 1);
      if (Math.abs(fTgt - fP) < 0.0004) { fP = fTgt; return false; }
      fP = lerp(fP, fTgt, 0.16);
      return true;
    });
  }

  /* ---- The device: from the flow to the centre of the screen ------------- */
  /* Two movements. The journey: while the section's top crosses the
     screen, a fixed canvas carries the band from where it sits in the
     flow (wherever that is on screen right now) to its place under the
     words, and scroll turns it: 42 frames of the band lifting off and
     turning to a three-quarter view (cut out, with their shadows), the
     first of which is the flow's own picture; the flow recedes as it
     goes, and the section's own band (the last frame) takes over at the
     end. Then the pin: one eased progress value picks the point being
     made (its words above the band), draws the lines to the two
     microphones, and, while it listens, streams the sound in from both
     sides with moments of the day riding the waves into the band
     (time-animated). Places come from the screen (geo), so it fits a
     phone. */
  var devSec = document.querySelector('[data-dev]');
  var dCanvas = devSec && devSec.querySelector('.dev__canvas');
  var dx = dCanvas && dCanvas.getContext && dCanvas.getContext('2d');
  var dBandC = devSec && devSec.querySelector('.dev__bandc');
  var dTravel = document.querySelector('.dev__travel');
  var dTravelC = dTravel && dTravel.querySelector('canvas');
  if (devSec && dx && dBandC && dTravelC && !reduceMotion && 'IntersectionObserver' in window) {
    devSec.classList.add('is-live');
    var dPin = devSec.querySelector('.dev__pin');
    var dStage = devSec.querySelector('.dev__stage');
    var dBand = devSec.querySelector('.dev__band');
    var dCopy = devSec.querySelector('.dev__copy');
    var dParts = [].slice.call(devSec.querySelectorAll('.dev__part'));
    var dCalls = [].slice.call(devSec.querySelectorAll('.dev__call'));
    var dRides = [].slice.call(devSec.querySelectorAll('.dev__ride'));
    var srcBand = document.querySelector('.flow__device');
    var srcCanvas = document.querySelector('.flow__canvas');
    var srcStage = document.querySelector('.flow__stage');
    var bx2 = dBandC.getContext('2d'), tx2 = dTravelC.getContext('2d');
    // The frames: 16:9, the flow's picture (1100 wide, 520 tall) sits in
    // the first one scaled to its width with 72 of 900 above it. In the
    // last frame (the band floating, seen from a three-quarter angle
    // slightly below, its shadow under it): the box the band fills, the
    // module's two ends and its light, as fractions of the frame.
    var D_N = parseInt(devSec.getAttribute('data-frames'), 10) || 42;
    var D_SRC = devSec.getAttribute('data-src');
    var D_FW = 1600, D_FH = 900, D_PAD = 72 / 900;
    var D_BOX = { l: 0.152, r: 0.853, t: 0.156, b: 0.62 };
    var D_ENDS = [[0.28, 0.44], [0.595, 0.535]];
    var D_POINTS = [0, 0.37, 0.69];
    var dFrames = new Array(D_N), dLoading = false, dLastK = -1, dBandDrawn = false;
    var D = null, dP = 0, dTgt = 0, dPoint = -1, dRaf = 0, dOn = false, dLit = false;
    var dSpan = function (v, a, b) { return clamp((v - a) / (b - a), 0, 1); };
    var dSmooth = function (a, b, v) { var t = dSpan(v, a, b); return t * t * (3 - 2 * t); };
    var dEaseIO = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var dPx = function (v) { return v.toFixed(1) + 'px'; };

    var dNearest = function (i) {
      if (dFrames[i]) return dFrames[i];
      for (var d = 1; d < D_N; d++) {
        if (dFrames[i - d]) return dFrames[i - d];
        if (dFrames[i + d]) return dFrames[i + d];
      }
      return null;
    };
    var dLoad = function () {
      if (dLoading) return;
      dLoading = true;
      for (var i = 0; i < D_N; i++) {
        (function (i) {
          var im = new Image();
          im.decoding = 'async';
          im.onload = function () {
            dFrames[i] = im;
            if (i === D_N - 1) dDrawBand();
          };
          var n = String(i + 1);
          im.src = D_SRC.replace('{n}', n.length < 2 ? '0' + n : n);
        })(i);
      }
    };
    // The band at rest: the last frame, on its own canvas in the stage.
    var dDrawBand = function () {
      if (!D) return;
      var im = dNearest(D_N - 1);
      if (!im) return;
      bx2.clearRect(0, 0, dBandC.width, dBandC.height);
      bx2.drawImage(im, 0, 0, dBandC.width, dBandC.height);
      dBandDrawn = true;
    };

    // The layout for this screen: the words at the top, the frame under
    // them (its band box centred in the room that is left), the labels
    // and the lines' ends.
    var dGeo = function () {
      var W = dStage.clientWidth, H = dStage.clientHeight;
      if (!W || !H) return;
      var narrow = W < 700;
      var gut = parseFloat(getComputedStyle(dCopy).paddingLeft) || 16;
      var BW = Math.min(W * (narrow ? 0.94 : 0.72), 760);
      var FWd = BW / (D_BOX.r - D_BOX.l), FHd = FWd * D_FH / D_FW;
      var roomTop = dCopy.offsetTop + dCopy.offsetHeight + (narrow ? 8 : 12);
      var room = H - roomTop - (narrow ? 16 : 28);
      var cx = W / 2, cy = roomTop + room * (narrow ? 0.46 : 0.5);
      var left = cx - (D_BOX.l + D_BOX.r) / 2 * FWd, top = cy - (D_BOX.t + D_BOX.b) / 2 * FHd;
      dBand.style.width = dPx(FWd);
      dBand.style.left = dPx(left);
      dBand.style.top = dPx(top);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      dBandC.width = Math.min(D_FW, Math.round(FWd * dpr));
      dBandC.height = Math.round(dBandC.width * D_FH / D_FW);
      dTravelC.width = Math.min(D_FW, Math.round(FWd * dpr));
      dTravelC.height = Math.round(dTravelC.width * D_FH / D_FW);
      dLastK = -1;
      var bl = left + D_BOX.l * FWd, br = left + D_BOX.r * FWd, bt = top + D_BOX.t * FHd, bb = top + D_BOX.b * FHd;
      var ends = D_ENDS.map(function (e) { return [left + e[0] * FWd, top + e[1] * FHd]; });

      // The labels: one up and to the left, one down and to the right, each
      // line from the label's near corner to its microphone.
      var lines = [];
      dCalls.forEach(function (el, i) {
        var w = el.offsetWidth, h = el.offsetHeight, x, y, A;
        if (narrow) {
          if (i === 0) { x = gut; y = bt - h - 14; A = [x + w - 24, y + h]; }
          else { x = W - gut - w; y = bb + 4; A = [x + 24, y]; }
        } else {
          if (i === 0) { x = bl - w + 40; y = bt - h - 22; A = [x + w - 16, y + h]; }
          else { x = br - 40; y = bb - 20; A = [x + 16, y]; }
        }
        x = clamp(x, gut, W - gut - w);
        y = clamp(y, roomTop - 8, H - h - 8);
        el.style.setProperty('--x', dPx(x));
        el.style.setProperty('--y', dPx(y));
        lines.push([A, ends[i]]);
      });
      dRides.forEach(function (el) { el.style.setProperty('--w', dPx(el.offsetWidth)); });

      dCanvas.width = Math.round(W * dpr);
      dCanvas.height = Math.round(H * dpr);
      D = { W: W, H: H, dpr: dpr, narrow: narrow, FWd: FWd, FHd: FHd, left: left, top: top, cx: cx, cy: cy, lines: lines, ends: ends, bl: bl, br: br };
      dDrawBand();
    };

    // ---- On the canvas: the lines to the microphones, and the sound ----
    var D_STRANDS = [[1, 0, 1.5, 0.9], [0.6, 2.1, 1, 0.28]];
    var D_SPEED = 110, D_RIDE = 64;
    var dWave = function (side, t, amp, voice) {
      if (amp <= 0.01) return;
      var T = side < 0 ? D.ends[0] : D.ends[1];
      var xT = T[0], x0 = side < 0 ? -8 : D.W + 8;
      var L = Math.abs(xT - x0), y0 = T[1];
      var A = Math.min(D.H * 0.05, 30) * amp;
      var grad = dx.createLinearGradient(x0, 0, xT, 0);
      grad.addColorStop(0, 'rgba(21, 21, 21, 0)');
      grad.addColorStop(0.1, 'rgba(21, 21, 21, 1)');
      grad.addColorStop(0.9, 'rgba(21, 21, 21, 1)');
      grad.addColorStop(1, 'rgba(160, 190, 40, 1)');
      dx.strokeStyle = grad;
      dx.lineCap = 'round';
      dx.lineJoin = 'round';
      var N = Math.ceil(L / 3);
      D_STRANDS.forEach(function (st) {
        dx.lineWidth = st[2];
        dx.globalAlpha = st[3];
        dx.beginPath();
        for (var j = 0; j <= N; j++) {
          var u = j / N, s = u * L, x = x0 + (xT - x0) * u;
          var env = dSmooth(0, 0.1, u) * (1 - dSmooth(0.78, 1, u));
          var ph = s - D_SPEED * t + voice * 700;
          var burst = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(ph / 300 * Math.PI * 2 + st[1] + voice)), 2);
          var y = y0 + A * st[0] * env * burst * (0.6 * Math.sin(ph / 16 + st[1]) + 0.3 * Math.sin(ph / 7.4 + st[1] * 1.7 + voice) + 0.1 * Math.sin(ph / 3.6 + voice * 2));
          if (j) dx.lineTo(x, y); else dx.moveTo(x, y);
        }
        dx.stroke();
      });
      dx.globalAlpha = 1;
    };
    // Moments of the day ride the waves into the band: three on each side,
    // spaced along the way, each fading in at the edge and into the module.
    var dRide = function (t, amp) {
      dRides.forEach(function (el, i) {
        var side = el.getAttribute('data-side') === 'right' ? 1 : -1, lane = Math.floor(i / 2);
        var T = side < 0 ? D.ends[0] : D.ends[1];
        var x0 = side < 0 ? -40 : D.W + 40, L = Math.abs(T[0] - x0);
        var u = ((t * D_RIDE + lane * (L / 3)) % L) / L;
        var x = x0 + (T[0] - x0) * u, y = T[1] - 36 + Math.sin(t * 1.4 + i * 1.1) * 3;
        // Gone before the band's edge, so no label ever sits on the band.
        var edge = ((side < 0 ? D.bl : D.br) - x0) / (T[0] - x0);
        var o = amp * dSmooth(0.04, 0.16, u) * (1 - dSmooth(edge - 0.16, edge - 0.04, u));
        el.style.opacity = o.toFixed(3);
        el.style.transform = 'translate3d(' + dPx(x - parseFloat(el.style.getPropertyValue('--w') || el.offsetWidth) / 2) + ',' + dPx(y) + ',0)';
      });
    };
    var dPaint = function (now) {
      if (!D) return;
      var p = dP, t = now / 1000;
      dx.setTransform(D.dpr, 0, 0, D.dpr, 0, 0);
      dx.clearRect(0, 0, D.W, D.H);
      // The lines draw from the labels to the microphones, then fade.
      var draw = dSmooth(0.07, 0.19, p), fade = 1 - dSmooth(0.33, 0.37, p);
      if (draw > 0 && fade > 0) {
        dx.strokeStyle = 'rgba(21, 21, 21, ' + (0.5 * fade).toFixed(3) + ')';
        dx.fillStyle = 'rgba(255, 255, 255, ' + fade.toFixed(3) + ')';
        dx.lineWidth = 1.25;
        D.lines.forEach(function (ln) {
          var A = ln[0], T = ln[1], e = dEaseIO(draw);
          var mx = (A[0] + T[0]) / 2;
          dx.beginPath();
          dx.moveTo(A[0], A[1]);
          var N = 40;
          for (var j = 1; j <= Math.round(N * e); j++) {
            var u = j / N, iu = 1 - u;
            var x = iu * iu * A[0] + 2 * iu * u * mx + u * u * T[0];
            var y = iu * iu * A[1] + 2 * iu * u * (A[1] + (T[1] - A[1]) * 0.15) + u * u * T[1];
            dx.lineTo(x, y);
          }
          dx.stroke();
          if (draw > 0.95) {
            dx.beginPath();
            dx.arc(T[0], T[1], 4, 0, Math.PI * 2);
            dx.fill();
            dx.stroke();
          }
        });
      }
      // Listening: the sound streams in from both sides, the day riding it.
      var amp = dSmooth(0.4, 0.46, p) * (1 - dSmooth(0.86, 0.92, p));
      var turn = 0.5 + 0.5 * Math.sin(t * 0.7);
      dWave(1, t, amp * (0.35 + 0.65 * turn), 0);
      dWave(-1, t, amp * (0.35 + 0.65 * (1 - turn)), 1);
      dRide(t, amp);
    };
    var dSoundLive = function () { return D && dOn && dP > 0.38 && dP < 0.93; };
    var dLoop = function (now) {
      dRaf = 0;
      if (!dSoundLive()) return;
      dPaint(now);
      dRaf = requestAnimationFrame(dLoop);
    };

    var dRender = function () {
      if (!D) return;
      var p = dP;
      var pt = 0;
      for (var i = 0; i < D_POINTS.length; i++) if (p >= D_POINTS[i]) pt = i;
      if (pt !== dPoint) {
        dPoint = pt;
        dParts.forEach(function (el, j) { el.classList.toggle('is-on', j === pt); });
      }
      // At the very end the band and the words fade and lift, and the
      // next section rises over them.
      dStage.style.setProperty('--exit', dSmooth(0.9, 1, p).toFixed(3));
      var callO = dSmooth(0.04, 0.12, p) * (1 - dSmooth(0.33, 0.37, p));
      dCalls.forEach(function (el) { el.style.setProperty('--call', callO.toFixed(3)); });
      var lit = p > 0.37 && p < 0.9;
      if (lit !== dLit) { dLit = lit; devSec.classList.toggle('is-lit', lit); }
      if (dSoundLive()) { if (!dRaf) dRaf = requestAnimationFrame(dLoop); }
      else dPaint(performance.now());
    };

    // The journey's frame: the band turning as it travels.
    var dTravelDraw = function (k) {
      if (k === dLastK) return;
      var im = dNearest(k);
      if (!im) return;
      dLastK = k;
      tx2.clearRect(0, 0, dTravelC.width, dTravelC.height);
      tx2.drawImage(im, 0, 0, dTravelC.width, dTravelC.height);
    };

    dGeo();
    dRender();
    window.addEventListener('resize', function () { dGeo(); dRender(); }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dGeo(); dRender(); });
    // The frames load once the flow is a screen away.
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      dLoad();
    }, { rootMargin: '100% 0px' }).observe(srcStage || dPin);

    link(function (vh) {
      if (!D) return false;
      var r = dPin.getBoundingClientRect();
      // The journey, while the section's top crosses the screen: the frame
      // rides from over the flow's band to its place in the stage, turning.
      var q = clamp(1 - r.top / vh, 0, 1);
      if (q > 0 && q < 1 && srcBand) {
        var a = srcBand.getBoundingClientRect(), e = dEaseIO(q);
        var f0 = a.width / D_FW;
        dTravel.style.left = dPx(lerp(a.left, D.left, e));
        dTravel.style.top = dPx(lerp(a.top - D_PAD * D_FH * f0, D.top, e));
        dTravel.style.width = dPx(lerp(a.width, D.FWd, e));
        dTravel.classList.add('is-on');
        dTravelDraw(Math.round(e * (D_N - 1)));
        devSec.classList.remove('is-arrived');
        srcBand.style.visibility = 'hidden';
        dBand.style.visibility = 'hidden';
        if (srcCanvas) srcCanvas.style.opacity = (1 - dSmooth(0, 0.3, q)).toFixed(3);
        if (srcStage) srcStage.style.opacity = (1 - 0.9 * dSmooth(0.1, 0.7, q)).toFixed(3);
      } else {
        dTravel.classList.remove('is-on');
        if (srcBand) srcBand.style.visibility = q >= 1 ? 'hidden' : '';
        if (q >= 1 && !dBandDrawn) dDrawBand();
        dBand.style.visibility = q >= 1 ? '' : 'hidden';
        devSec.classList.toggle('is-arrived', q >= 1);
        if (srcCanvas) srcCanvas.style.opacity = q >= 1 ? '0' : '';
        if (srcStage) srcStage.style.opacity = q >= 1 ? '0.1' : '';
      }
      dOn = r.top < vh && r.bottom > 0;
      if (r.bottom < -vh || r.top > vh * 2) return false;
      dTgt = clamp(-r.top / Math.max(1, dPin.offsetHeight - vh), 0, 1);
      if (Math.abs(dTgt - dP) < 0.0004) { dP = dTgt; dRender(); return false; }
      dP = lerp(dP, dTgt, 0.16);
      dRender();
      return true;
    });
  }

  /* ---- Compare: a fade on the sticky column once the table is scrolled ---- */
  var cmpScroll = document.querySelector('.compare-scroll');
  if (cmpScroll) {
    var cmpMark = function () { cmpScroll.classList.toggle('is-scrolled', cmpScroll.scrollLeft > 4); };
    cmpScroll.addEventListener('scroll', cmpMark, { passive: true });
    cmpMark();
  }

  /* ---- Read-along statement ---------------------------------------------- */
  /* The statement pins while scroll lights it word by word, and the key
     phrase turns lime once the reading reaches it. */
  var pin = document.querySelector('.statement-pin');
  var reads = pin ? [].slice.call(pin.querySelectorAll('.statement__read')) : [];
  if (pin && reads.length && !reduceMotion) {
    root.classList.add('stmt-scrub');
    var DIM = 0.16, LEAD = 4;
    var words = [];
    var marker = null, markFrom = -1;
    reads.forEach(function (read) {
      var nodes = [].slice.call(read.childNodes);
      read.textContent = '';
      nodes.forEach(function (node) {
        var target = read;
        if (node.nodeType === 1) {
          target = node.cloneNode(false);
          read.appendChild(target);
          if (target.classList.contains('marker')) { marker = target; markFrom = words.length; }
        }
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { target.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          w.className = 'w';
          w.textContent = part;
          w.style.opacity = DIM;
          target.appendChild(w);
          words.push(w);
        });
      });
    });
    var N2 = words.length;
    if (marker) {
      var marked = marker.querySelectorAll('.w');
      for (var k = 0; k < marked.length; k++) {
        marked[k].style.setProperty('--d', (k / marked.length * 1.1).toFixed(2) + 's');
      }
    }
    var START = 0.06, END = 0.86;
    var paint = function () {
      var vh = window.innerHeight || root.clientHeight;
      var span = pin.offsetHeight - vh;
      var progress = span > 0 ? (-pin.getBoundingClientRect().top / span) : 0;
      progress = clamp(progress, 0, 1);
      var pr = clamp((progress - START) / (END - START), 0, 1);
      var reach = pr * (N2 + LEAD);
      for (var i = 0; i < N2; i++) {
        var wp = clamp((reach - i) / LEAD, 0, 1);
        words[i].style.opacity = DIM + (1 - DIM) * wp;
      }
      if (marker) marker.classList.toggle('is-on', reach >= markFrom + 2);
    };
    var scheduled = false, onView = false;
    var tick = function () { scheduled = false; paint(); };
    var onScroll = function () {
      if (!scheduled && onView) { scheduled = true; requestAnimationFrame(tick); }
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onView = entries[0].isIntersecting;
        if (onView) requestAnimationFrame(tick);
      }, { rootMargin: '200px 0px' }).observe(pin);
    } else {
      onView = true;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
  }

  /* ---- App chapters on phones: a swipeable row -------------------------- */
  var tour = document.querySelector('[data-tour]');
  var tourDots = tour ? [].slice.call(tour.parentNode.querySelectorAll('.tour-dots i')) : [];
  if (tour && tourDots.length) {
    var tiles = [].slice.call(tour.children);
    var asRow = window.matchMedia('(max-width: 699px)');
    var dotRaf = 0;
    var pickDot = function () {
      dotRaf = 0;
      var step = tiles[1] ? tiles[1].offsetLeft - tiles[0].offsetLeft : 1;
      var i = Math.round(tour.scrollLeft / step);
      if (tour.scrollLeft + tour.clientWidth >= tour.scrollWidth - 4) i = tiles.length - 1;
      i = clamp(i, 0, tiles.length - 1);
      tourDots.forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
    };
    tour.addEventListener('scroll', function () { if (!dotRaf) dotRaf = requestAnimationFrame(pickDot); }, { passive: true });
    var setRow = function () {
      if (asRow.matches) {
        tour.tabIndex = 0;
        tour.setAttribute('role', 'region');
        tour.setAttribute('aria-label', 'The app, in two parts');
      } else {
        tour.removeAttribute('tabindex');
        tour.removeAttribute('role');
        tour.removeAttribute('aria-label');
      }
    };
    setRow();
    if (asRow.addEventListener) asRow.addEventListener('change', setRow);
    else if (asRow.addListener) asRow.addListener(setRow);
  }

  /* ---- App chapters on wide screens: one tile, held ---------------------- */
  var chaps = tour ? [].slice.call(tour.querySelectorAll('.chap')) : [];
  if (chaps.length > 1) {
    var held = window.matchMedia('(min-width: 960px)');
    var copies = chaps.map(function (c) { return c.querySelector('.feat__copy'); });
    var shots = chaps.map(function (c) { return c.querySelector('.stage'); });
    var atChap = -1, heldOn = false, heldRaf = 0, resets = [];
    var markAt = function (i) {
      if (i === atChap) return;
      atChap = i;
      chaps.forEach(function (c, j) {
        var on = j === i;
        if (c.classList.contains('is-at') === on) return;
        c.classList.toggle('is-at', on);
        clearTimeout(resets[j]);
        if (!on) {
          resets[j] = setTimeout(function () {
            if (!c.classList.contains('is-at')) shots[j].classList.remove('in');
          }, 600);
        }
        shots[j].dispatchEvent(new CustomEvent('chapter:toggle'));
      });
    };
    var pickChap = function () {
      heldRaf = 0;
      var vh = window.innerHeight || root.clientHeight, i = 0;
      copies.forEach(function (el, j) { if (el.getBoundingClientRect().top <= vh / 2) i = j; });
      markAt(i);
      var r = shots[i].getBoundingClientRect();
      if (r.top < vh * 0.85 && r.bottom > vh * 0.15) shots[i].classList.add('in');
    };
    var onHeldScroll = function () { if (!heldRaf) heldRaf = requestAnimationFrame(pickChap); };
    var setHeld = function () {
      if (held.matches === heldOn) return;
      heldOn = held.matches;
      tour.classList.toggle('is-held', heldOn);
      if (heldOn) {
        if (rvo) shots.forEach(function (s) { rvo.unobserve(s); });
        shots.forEach(function (s) { s.classList.remove('in'); });
        atChap = -1;
        pickChap();
        window.addEventListener('scroll', onHeldScroll, { passive: true });
        window.addEventListener('resize', onHeldScroll, { passive: true });
      } else {
        window.removeEventListener('scroll', onHeldScroll);
        window.removeEventListener('resize', onHeldScroll);
        atChap = -1;
        chaps.forEach(function (c, j) {
          clearTimeout(resets[j]);
          c.classList.remove('is-at');
          shots[j].classList.add('in');
          shots[j].dispatchEvent(new CustomEvent('chapter:toggle'));
        });
      }
    };
    var bringForward = function (j) {
      return function () {
        if (!heldOn) return;
        markAt(j);
        shots[j].classList.add('in');
      };
    };
    chaps.forEach(function (c, j) {
      c.addEventListener('focusin', bringForward(j));
      copies[j].addEventListener('pointerdown', bringForward(j));
    });
    setHeld();
    if (held.addEventListener) held.addEventListener('change', setHeld);
    else if (held.addListener) held.addListener(setHeld);
  }

  /* ---- Mirror, over time --------------------------------------------------- */
  /* The pin holds the stage while its scroll plays three months: --gp runs 0
     to 1, data-stage marks week 1, month 1 and month 3, the counters climb,
     "That's me" is pressed halfway, and --g moves the goal through month 3.
     A little stillness at each end so the first and last states are seen.
     Never under reduced motion: the markup already shows month 3. */
  var grow = document.querySelector('[data-grow]');
  if (grow && !reduceMotion) {
    grow.classList.add('is-scrub');
    var gpin = grow.querySelector('.grow__pin');
    var gDay = grow.querySelector('[data-grow-day]');
    var gConv = grow.querySelector('[data-grow-convos]');
    var gKnows = grow.querySelector('[data-grow-knows]');
    var gLast = -1, gStage = 0;
    // Piecewise over the three stages: [value at 0, at 1/3, at 2/3, at 1].
    var along = function (t, v) {
      var seg = Math.min(2, Math.floor(t * 3)), f = t * 3 - seg;
      return Math.round(v[seg] + (v[seg + 1] - v[seg]) * f);
    };
    link(function (vh) {
      var r = gpin.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return false;
      var span = gpin.offsetHeight - vh;
      var p = span > 0 ? clamp(-r.top / span, 0, 1) : 1;
      var gp = clamp((p - 0.05) / 0.88, 0, 1);
      if (Math.abs(gp - gLast) < 0.0005) return false;
      gLast = gp;
      var stage = gp < 0.34 ? 1 : gp < 0.67 ? 2 : 3;
      grow.style.setProperty('--gp', gp.toFixed(4));
      grow.style.setProperty('--g', clamp((gp - 0.7) / 0.22, 0, 1).toFixed(3));
      if (stage !== gStage) { gStage = stage; grow.setAttribute('data-stage', stage); }
      grow.classList.toggle('is-yes', gp >= 0.5);
      gDay.textContent = 'Day ' + along(gp, [3, 7, 30, 90]);
      gConv.textContent = along(gp, [12, 31, 96, 268]);
      gKnows.textContent = gp >= 0.5 ? 12 : 11;
      return false;
    });
  }

  /* ---- Numbers that count themselves in ----------------------------------- */
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    var runCount = function (el) {
      var to = parseFloat(el.getAttribute('data-count')) || 0;
      var dur = 1500, t0 = null;
      var step = function (now) {
        if (t0 === null) t0 = now;
        var p = clamp((now - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 4);
        el.textContent = String(Math.round(to * e));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = String(to);
      };
      requestAnimationFrame(step);
    };
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        cio.unobserve(entry.target);
        runCount(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) {
      if (el.getBoundingClientRect().bottom < 0) return;
      el.textContent = '0';
      cio.observe(el);
    });
  }

  /* ---- Pre-order gallery ------------------------------------------------ */
  /* Advances on its own while on screen, a lime line filling under the photo
     on show over its time; hands over to the visitor for good on the first
     tap. Reduced motion never auto-advances. */
  document.querySelectorAll('[data-pgal]').forEach(function (gal) {
    var frames = [].slice.call(gal.querySelectorAll('.pgal__frame'));
    var thumbs = [].slice.call(gal.querySelectorAll('.pgal__thumbs button'));
    if (!frames.length || frames.length !== thumbs.length) return;
    var DWELL = 4200;
    var at = 0, timer = null, auto = !reduceMotion;
    gal.style.setProperty('--dwell', DWELL / 1000 + 's');
    var showFrame = function (i) {
      at = i;
      frames.forEach(function (f, j) { f.classList.toggle('is-active', j === i); });
      thumbs.forEach(function (t, j) {
        t.classList.toggle('is-active', j === i);
        t.setAttribute('aria-pressed', String(j === i));
      });
      if (timer) {
        gal.classList.remove('is-auto');
        void gal.offsetWidth;
        gal.classList.add('is-auto');
      }
    };
    var stop = function () { if (timer) { clearInterval(timer); timer = null; } gal.classList.remove('is-auto'); };
    var go = function () {
      if (timer) return;
      timer = setInterval(function () { showFrame((at + 1) % frames.length); }, DWELL);
      gal.classList.remove('is-auto');
      void gal.offsetWidth;
      gal.classList.add('is-auto');
    };
    thumbs.forEach(function (btn, i) {
      btn.addEventListener('click', function () { auto = false; stop(); showFrame(i); });
    });
    if (!auto) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (!auto) return;
        if (entries[0].isIntersecting) go(); else stop();
      }, { threshold: 0.3 }).observe(gal);
    } else {
      go();
    }
  });

  var segment = root.getAttribute('data-segment') || root.getAttribute('data-theme') || 'general';

  /* ---- Try the app ------------------------------------------------------ */
  document.querySelectorAll('[data-watch]').forEach(function (watch) {
    var v = watch.querySelector('video');
    if (!v || reduceMotion || !('IntersectionObserver' in window)) return;
    v.addEventListener('playing', function () { watch.classList.add('is-playing'); });
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        if (!v.src) v.src = v.getAttribute('data-src');
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    }, { threshold: 0.4 }).observe(watch);
  });

  document.querySelectorAll('[data-beta-form]').forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var msg = form.querySelector('[data-beta-msg]');
    var endpoint = form.getAttribute('data-endpoint');
    var say = function (text) { msg.textContent = text; };
    var done = function () {
      form.classList.add('is-done');
      say('You’re on the list. Your invite will come to ' + input.value.trim() + '.');
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: 'App beta', content_category: segment });
      if (window.posthog && window.posthog.capture) window.posthog.capture('beta_signup', { segment: segment });
    };
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid')) { input.removeAttribute('aria-invalid'); say(''); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.setAttribute('aria-invalid', 'true');
        say('That email doesn’t look right. Could you check it?');
        input.focus();
        return;
      }
      if (!endpoint) { done(); return; }
      button.disabled = true;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=' + encodeURIComponent(email) + '&userGroup=beta&source=' + encodeURIComponent('site-' + segment)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.status === 429) throw new Error('busy');
          if (!r.ok || data.success === false) throw new Error(data.message || r.status);
          done();
        });
      }).catch(function (err) {
        button.disabled = false;
        say(err && err.message === 'busy'
          ? 'Lots of sign-ups right now. Please try again in a minute.'
          : 'That didn’t go through. Please try again in a moment.');
      });
    });
  });

  /* ---- Magnetic buttons ------------------------------------------------- */
  /* Under a fine pointer the main buttons lean a few pixels towards it and
     settle back when it leaves; the CSS transition gives them their weight. */
  if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('[data-magnet]').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        btn.style.transform = 'translate(' + (clamp(x, -1, 1) * 6).toFixed(1) + 'px,' + (clamp(y, -1, 1) * 4 - 1).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });
  }

  /* ---- Checkout attribution -------------------------------------------- */
  document.querySelectorAll('a[data-reserve]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.posthog && window.posthog.capture) window.posthog.capture('reserve_clicked', { segment: segment });
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', {
          value: 10,
          currency: 'USD',
          content_name: 'Larkin Wristband (Reservation)',
          content_category: segment
        });
      }
    });
  });
})();
