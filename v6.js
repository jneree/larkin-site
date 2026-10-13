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

  /* ---- The story: one continuous flow, the title narrating it ------------ */
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
    var F_MOD = [0.45, 0.558];
    // In time (phones): the first card, then one every PERIOD, the pulse
    // running TRAVEL ahead of it. On the scroll: the first card at T0 of
    // the pin's progress, then one every STEP, the pulse running ahead.
    // On the scroll, three parts in turn: the conversation alone, the band
    // from F_S1 (the sound soon after), the insights' side from F_S2, the
    // first card at T0 and one every STEP after it.
    var PERIOD = 3.0, TRAVEL = 0.8, FIRST = 1.6, T0 = 0.34, STEP = 0.095, F_S1 = 0.14, F_S2 = 0.26;
    var fStepIdx = -1;
    var F = null, fOn = false, fRaf = 0, t0 = 0, fCount = -1, fP = 0, fTgt = 0, fPinned = false;
    var fParts = flow.querySelectorAll('.flow__part');
    var fWords = [].slice.call(flow.querySelectorAll('.flow__word'));
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
        fStepIdx = -1;
        fStage.style.removeProperty('--shift');
        flow.classList.remove('is-dev');
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
      var mod = [d.l + F_MOD[0] * d.w, d.t + F_MOD[1] * d.h];
      // The band's picture has air around the ring: where the ring itself
      // is, as fractions of the picture. The sound and the line stop short
      // of it, with air of their own.
      var ringL = d.l + 0.209 * d.w, ringR = d.l + 0.786 * d.w, ringT = d.t + 0.25 * d.h;
      var S, Cc, T, sound;
      if (narrow) {
        // Out of the picture's bottom, straight down towards the band, with
        // air before the ring.
        S = [mod[0], c.t + c.h + 14];
        T = [mod[0], ringT - 16];
        Cc = [S[0], (S[1] + T[1]) / 2];
        sound = fPath(S, Cc, T, 220);
      } else {
        // Level with the module, from a little after the picture to a
        // little before the ring.
        S = [c.l + c.w + 18, mod[1]];
        T = [ringL - 22, mod[1]];
        Cc = [(S[0] + T[0]) / 2, mod[1]];
        sound = fPath(S, Cc, T, 220);
      }
      // The link: a lime thread from the band to where the next card
      // appears (from under the ring to the card's top on phones; from the
      // ring's edge, level with the module, to the card's left edge on wide
      // screens). v6.js floats it each frame.
      var c0 = fCards[0], ledX = d.l + 0.5245 * d.w, ringB = d.t + 0.663 * d.h, out, oS, oEnd;
      if (narrow) {
        oS = [ledX, ringB + 6];
        oEnd = [o.l + c0.offsetLeft + c0.offsetWidth / 2, o.t + c0.offsetTop - 6];
        out = fPath(oS, [ledX + 22, (oS[1] + oEnd[1]) / 2], oEnd, 120);
      } else {
        oS = [ringR + 4, mod[1]];
        oEnd = [o.l + c0.offsetLeft - 6, o.t + c0.offsetTop + c0.offsetHeight / 2];
        out = fPath(oS, [(oS[0] + oEnd[0]) / 2, mod[1] - 18], oEnd, 120);
      }

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      fCanvas.width = Math.round(sr.width * dpr);
      fCanvas.height = Math.round(sr.height * dpr);
      F = { W: sr.width, H: sr.height, dpr: dpr, sound: sound, out: out, narrow: narrow, amp: narrow ? 12 : Math.min(sr.width * 0.016, 18) };
      // The words on the sound: one every so many pixels along it.
      F.wgap = Math.max(96, sound.len / 2.4);
      F.ww = fWords.map(function (el) { return el.offsetWidth || 100; });
      // How far the stage moves to centre the parts shown so far: the
      // picture alone, the picture and the band, the whole row.
      F.shift = [sr.width / 2 - (c.l + c.w / 2), sr.width / 2 - (c.l + d.l + d.w) / 2, sr.width / 2 - (c.l + o.l + o.w) / 2];
      if (fStepIdx >= 0) fStage.style.setProperty('--shift', fPx(F.shift[fStepIdx]));
    };
    var fStep = function (i) {
      if (i === fStepIdx) return;
      fStepIdx = i;
      fStage.style.setProperty('--shift', fPx(F.shift[i]));
      flow.classList.toggle('is-dev', i >= 1);
      flow.classList.toggle('is-out', i >= 2);
    };

    // The sound: a waveform, bars across the path mirrored about it, their
    // heights a speech-like envelope that travels along it into the
    // module, swelling in from the picture and narrowing to nothing at the
    // module's end, ink turning lime as it enters.
    var F_SPEED = 110;
    var fHash = function (k) { var x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
    var fEnv = function (u) {
      var syl = 0.5 + 0.5 * Math.sin(u / 17.5);
      var wrd = 0.5 + 0.5 * Math.sin(u / 54 + 1.3);
      var fine = 0.5 + 0.5 * Math.sin(u / 3.7);
      var r = 0.5 + 0.5 * fHash(Math.floor(u / 110));
      return 0.08 + 0.92 * (0.6 * syl + 0.3 * wrd + 0.1 * fine) * r;
    };
    var fDrawSound = function (t, amp) {
      if (amp <= 0.01) return;
      var pts = F.sound, L = pts.len, step = 4, A = F.amp * amp;
      fx.lineCap = 'round';
      fx.lineWidth = 1.5;
      for (var sPos = 2; sPos <= L - 2; sPos += step) {
        var v = sPos / L, q = fAt(pts, v);
        var h = A * fEnv(sPos - F_SPEED * t) * fSmooth(0, 0.12, v) * (1 - fSmooth(0.78, 1, v));
        if (h < 0.5) h = 0.5;
        var g = fSpan(v, 0.94, 1), o = 0.72 - 0.25 * fSmooth(0.85, 1, v);
        fx.strokeStyle = 'rgba(' + Math.round(21 + (160 - 21) * g) + ',' + Math.round(21 + (190 - 21) * g) + ',' + Math.round(21 + (40 - 21) * g) + ',' + o.toFixed(2) + ')';
        fx.beginPath();
        fx.moveTo(q.x - q.nx * h, q.y - q.ny * h);
        fx.lineTo(q.x + q.nx * h, q.y + q.ny * h);
        fx.stroke();
      }
    };
    // The words: pieces of the conversation set out from the picture one
    // after another and ride the sound at its speed, above and below it
    // in turn (left and right of it on phones), fading as they enter the
    // module.
    var fPlaceWords = function (t, amp) {
      var N = fWords.length, L = F.sound.len, gap = F.wgap, head = F_SPEED * t;
      var kmax = Math.floor(head / gap), kmin = Math.max(0, Math.ceil((head - L) / gap));
      for (var i = 0; i < N; i++) fWords[i].style.opacity = '0';
      if (amp < 0.3) return;
      var off = F.amp + 10;
      for (var k = kmin; k <= kmax; k++) {
        var sPos = head - k * gap;
        if (sPos < 0 || sPos > L) continue;
        var el = fWords[k % N], v = sPos / L, q = fAt(F.sound, v), side = k % 2 ? 1 : -1;
        // A word fades in once it has cleared the picture and out before it
        // reaches the module: by its own half-width along the sound (its
        // half-height on phones, where it rides the sound itself).
        var half = F.narrow ? 12 : F.ww[k % N] / 2;
        var o = fSmooth(0, 36, sPos - half) * (1 - fSmooth(L - half - 56, L - half - 4, sPos)) * amp;
        var sc = 1 - 0.25 * fSmooth(L - half - 70, L - half, sPos);
        var x = F.narrow ? q.x : q.x + q.nx * off * side, y = F.narrow ? q.y : q.y + q.ny * off * side;
        el.style.opacity = o.toFixed(3);
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%, -50%) scale(' + sc.toFixed(3) + ')';
      }
    };
    // The link from the band to the insight: three fine lines of the
    // brand's lime, close together as they leave the band and opening a
    // little towards the card, each drifting slightly with time, their
    // ends held. Nothing else.
    var F_LINES = [-1, 0, 1];
    var fDrawLink = function (t, a, u) {
      var pts = F.out;
      if (!pts || a <= 0.01) return;
      var gap = F.narrow ? 5 : 6, A = F.narrow ? 2.5 : 3;
      fx.lineCap = 'round';
      fx.lineJoin = 'round';
      fx.lineWidth = 1.5;
      fx.strokeStyle = 'rgba(210, 237, 40, ' + (0.95 * a).toFixed(3) + ')';
      F_LINES.forEach(function (n, li) {
        fx.beginPath();
        for (var i = 0; i < pts.length; i++) {
          var q = pts[i], spread = 0.45 + 0.55 * q.u;
          var w = n * gap * spread + A * Math.sin(q.s / 110 - t * (1.1 + 0.25 * li) + li * 2.1) * Math.sin(Math.PI * q.u);
          var x = q.x + q.nx * w, y = q.y + q.ny * w;
          if (i) fx.lineTo(x, y); else fx.moveTo(x, y);
        }
        fx.stroke();
      });
    };

    // How many insights are out. The newest takes the first slot, the
    // older ones move on; one taken back (scrolling up) folds away.
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
      if (!fPinned) flow.classList.toggle('is-out', k > 0);
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
        fStep(p < F_S1 ? 0 : p < F_S2 ? 1 : 2);
        amp = fSmooth(F_S1 + 0.04, F_S1 + 0.12, p);
        lineA = fSmooth(T0 - 0.08, T0 - 0.02, p);
        k = clamp(Math.floor((p - T0) / STEP) + 1, 0, fCards.length);
        var next = T0 + k * STEP;
        u = k < fCards.length ? fSpan(p, next - STEP * 0.6, next) : -1;
        if (u >= 1) u = -1;
        // The title's pieces, each staying once said: always with you (the
        // conversation), it recalls every conversation (the band and the
        // sound), insight about you (the cards come out). Then the exit.
        var pt = p < F_S1 ? 0 : p < T0 ? 1 : 2;
        fParts.forEach(function (el, j) { el.classList.toggle('is-on', j <= pt); });
        flow.style.setProperty('--exit', fSmooth(0.9, 1, p).toFixed(3));
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
      fPlaceWords(t, amp);
      fDrawLink(t, lineA, u);
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
      fWords.forEach(function (el) { el.style.opacity = '0'; });
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

  /* ---- The app in seven cards: arrows and dots follow the row ---------- */
  var arail = document.querySelector('[data-arail]');
  if (arail) {
    var acards = [].slice.call(arail.children);
    var adots = [].slice.call(document.querySelectorAll('.arail-dots i'));
    var aprev = document.querySelector('[data-arail-prev]');
    var anext = document.querySelector('[data-arail-next]');
    var aRaf = 0;
    var aStep = function () { return acards[1] ? acards[1].offsetLeft - acards[0].offsetLeft : arail.clientWidth; };
    var aMark = function () {
      aRaf = 0;
      var end = arail.scrollLeft + arail.clientWidth >= arail.scrollWidth - 4;
      var i = end ? acards.length - 1 : clamp(Math.round(arail.scrollLeft / aStep()), 0, acards.length - 1);
      adots.forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
      if (aprev) aprev.disabled = arail.scrollLeft <= 4;
      if (anext) anext.disabled = end;
    };
    arail.addEventListener('scroll', function () { if (!aRaf) aRaf = requestAnimationFrame(aMark); }, { passive: true });
    window.addEventListener('resize', function () { if (!aRaf) aRaf = requestAnimationFrame(aMark); }, { passive: true });
    var aGo = function (dir) { arail.scrollBy({ left: dir * aStep(), behavior: reduceMotion ? 'auto' : 'smooth' }); };
    if (aprev) aprev.addEventListener('click', function () { aGo(-1); });
    if (anext) anext.addEventListener('click', function () { aGo(1); });
    aMark();
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
