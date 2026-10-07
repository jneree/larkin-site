/* Larkin V5 — progressive enhancement only. The page is fully usable without this. */
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
    try { seen = sessionStorage.getItem('v5-intro') === '1'; } catch (e) {}
    if (reduceMotion || seen) {
      intro.hidden = true;
      ready();
    } else {
      try { sessionStorage.setItem('v5-intro', '1'); } catch (e) {}
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
    var place = function () {
      pending = false;
      var y = window.scrollY;
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
  var filmBtn = hero && hero.querySelector('.hero__toggle');
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
    var setBtn = function (state) {
      if (!filmBtn) return;
      filmBtn.hidden = false;
      filmBtn.setAttribute('data-state', state);
      filmBtn.setAttribute('aria-label',
        state === 'playing' ? 'Pause the film' : state === 'ended' ? 'Play the film again' : 'Play the film');
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
      setBtn('playing');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
      watchFrames();
    });
    video.addEventListener('pause', function () {
      cancelAnimationFrame(raf);
      readTones(true);
      if (!video.ended) setBtn('paused');
    });
    video.addEventListener('ended', function () {
      cancelAnimationFrame(raf);
      setDark(false);
      readTones(true);
      setBtn('ended');
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
      if (p && p.catch) p.catch(function () { setBtn('paused'); });
    };
    if (filmBtn) {
      filmBtn.addEventListener('click', function () {
        if (!video.getAttribute('src')) { attach(); play(); return; }
        if (video.ended) { video.currentTime = 0; play(); }
        else if (video.paused) play();
        else video.pause();
      });
    }
    if (reduceMotion) {
      setBtn('paused');
    } else {
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

  /* ---- The device: the module, scrubbed by scroll --------------------------- */
  /* 39 frames of the hero film's close-up, drawn onto a canvas that covers
     the pinned screen. Scroll through the track picks the frame; the drawn
     frame eases towards it so a flick never jumps. The frames load when the
     section is a screen and a half away; until the first is drawn the lit
     poster shows. Portrait screens get a portrait crop. */
  var scrub = document.querySelector('[data-scrub]');
  if (scrub && !reduceMotion && 'IntersectionObserver' in window) {
    var devSec = scrub.closest('.device') || scrub;
    var stage = scrub.querySelector('.device__stage');
    var canvas = scrub.querySelector('canvas');
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (ctx) {
      var N = parseInt(scrub.getAttribute('data-frames'), 10) || 39;
      var portrait = window.matchMedia('(max-aspect-ratio: 4/5)').matches;
      var tpl = portrait ? scrub.getAttribute('data-src-p') : scrub.getAttribute('data-src-l');
      var frames = new Array(N), started = false, cur = 0, tgt = 0, lastImg = null, live = false;
      var srcOf = function (i) { var n = String(i + 1); return tpl.replace('{n}', n.length < 2 ? '0' + n : n); };
      var nearest = function (i) {
        if (frames[i]) return frames[i];
        for (var d = 1; d < N; d++) {
          if (frames[i - d]) return frames[i - d];
          if (frames[i + d]) return frames[i + d];
        }
        return null;
      };
      var draw = function (force) {
        var im = nearest(Math.round(cur));
        if (!im || (!force && im === lastImg)) return;
        lastImg = im;
        var cw = canvas.width, ch = canvas.height;
        var s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
        var dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        ctx.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
        if (!live) { live = true; devSec.classList.add('is-live'); }
      };
      var size = function () {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        draw(true);
      };
      var load = function () {
        if (started) return;
        started = true;
        for (var i = 0; i < N; i++) {
          (function (i) {
            var im = new Image();
            im.decoding = 'async';
            im.onload = function () {
              frames[i] = im;
              if (!lastImg || i === Math.round(cur)) draw(true);
            };
            im.src = srcOf(i);
          })(i);
        }
      };
      size();
      window.addEventListener('resize', size, { passive: true });
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        load();
      }, { rootMargin: '150% 0px' }).observe(scrub);

      link(function (vh) {
        var r = scrub.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return false;
        var travel = Math.max(1, scrub.offsetHeight - vh);
        var p = clamp(-r.top / travel, 0, 1);
        tgt = p * (N - 1);
        devSec.classList.toggle('is-on', r.top < vh * 0.55);
        devSec.classList.toggle('is-lit', p > 0.3);
        if (Math.abs(tgt - cur) < 0.05) { cur = tgt; draw(false); return false; }
        cur = lerp(cur, tgt, 0.22);
        draw(false);
        return true;
      });
    }
  } else if (scrub) {
    scrub.closest('.device').classList.add('is-on', 'is-lit');
  }

  /* ---- How it works: the arm film and the day ------------------------------- */
  var howFilm = document.querySelector('[data-how-film]');
  if (howFilm) {
    var howVideo = howFilm.querySelector('video');
    var settleAt = parseFloat(howFilm.getAttribute('data-settle')) || 3.5;
    var still = function () { howFilm.classList.add('is-on', 'is-still', 'is-settled'); };

    if (reduceMotion || !('IntersectionObserver' in window) || !howVideo) {
      still();
    } else {
      var howAttach = function () {
        if (howVideo.getAttribute('src')) return;
        var c = navigator.connection || {};
        var slow = c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '');
        howVideo.preload = 'auto';
        var d = howVideo.dataset;
        var need = howFilm.offsetWidth * (window.matchMedia('(max-width: 699px)').matches ? 1.34 : 1) * (window.devicePixelRatio || 1);
        var fast = !slow && !(c.downlink && c.downlink < 10);
        howVideo.src = slow ? d.srcSm : need > 2800 && fast ? d.srcXxl : need > 2100 ? d.srcXl : need > 1400 ? d.srcLg : d.srcSm;
        howVideo.load();
      };
      howVideo.addEventListener('playing', function () { howFilm.classList.add('is-playing'); });
      howVideo.addEventListener('timeupdate', function () {
        if (howVideo.currentTime >= settleAt) howFilm.classList.add('is-settled');
      });
      howVideo.addEventListener('ended', function () { howFilm.classList.add('is-settled'); });
      howVideo.addEventListener('error', still);

      if (howFilm.getBoundingClientRect().bottom < 0) {
        still();
      } else {
        new IntersectionObserver(function (entries, obs) {
          if (!entries[0].isIntersecting) return;
          obs.disconnect();
          howAttach();
        }, { rootMargin: '100% 0px' }).observe(howFilm);

        new IntersectionObserver(function (entries, obs) {
          if (!entries[0].isIntersecting) return;
          obs.disconnect();
          howFilm.classList.add('is-on');
          howAttach();
          var p = howVideo.play();
          if (p && p.catch) p.catch(still);
        }, { threshold: 0.4 }).observe(howFilm.querySelector('.how-film__media'));
      }
    }
  }

  var day = document.querySelector('[data-day]');
  if (day) {
    if (reduceMotion || !('IntersectionObserver' in window) || day.getBoundingClientRect().bottom < 0) {
      day.classList.add('is-live');
    } else {
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        day.classList.add('is-live');
      }, { threshold: 0.6 }).observe(day.querySelector('.day__line'));
    }
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
        tour.setAttribute('aria-label', 'The app, in three parts');
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

  /* ---- Mirror: one screen at a time ------------------------------------- */
  document.querySelectorAll('[data-mtabs]').forEach(function (list) {
    var tabs = [].slice.call(list.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    if (!tabs.length || panels.indexOf(null) > -1) return;
    var phones = panels.map(function (p) { return p.closest('.mphone'); });
    if (phones.indexOf(null) > -1) phones = [];
    var stage = panels[0].closest('[data-mstage]');
    var DWELL = 4500;
    var at = 0, auto = !reduceMotion, inView = false, timer = 0;
    list.style.setProperty('--dwell', DWELL / 1000 + 's');

    var chap = stage && stage.closest('.chap');
    var shown = function () { return !chap || !tour || !tour.classList.contains('is-held') || chap.classList.contains('is-at'); };
    var isHeld = function () { return !!(chap && tour && tour.classList.contains('is-held')); };
    var running = function () { return auto && inView && shown() && !isHeld() && !document.hidden; };
    var schedule = function () {
      clearTimeout(timer);
      list.classList.toggle('is-playing', auto);
      list.classList.remove('is-auto');
      if (!running()) return;
      void list.offsetWidth;
      list.classList.add('is-auto');
      timer = setTimeout(function () { show((at + 1) % tabs.length); }, DWELL);
    };
    var show = function (i, focus) {
      var n = tabs.length;
      at = i;
      tabs.forEach(function (t, j) {
        var on = j === i;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].classList.toggle('is-on', on);
        panels[j].inert = !on;
        if (phones[j]) {
          var ph = phones[j], next = j === (i + 1) % n, prev = j === (i - 1 + n) % n;
          var wrap = (next && ph.classList.contains('is-prev')) || (prev && ph.classList.contains('is-next'));
          ph.classList.remove('is-wrap');
          if (wrap) { void ph.offsetWidth; ph.classList.add('is-wrap'); }
          ph.classList.toggle('is-on', on);
          ph.classList.toggle('is-next', next);
          ph.classList.toggle('is-prev', prev);
        }
      });
      if (focus) tabs[i].focus();
      panels[i].dispatchEvent(new CustomEvent('mirror:show'));
      schedule();
    };
    var stop = function () {
      if (!auto) return;
      auto = false;
      schedule();
    };

    var copy = chap && chap.querySelector('.feat__copy');
    var prevCopy = chap && chap.previousElementSibling && chap.previousElementSibling.querySelector('.feat__copy');
    var span = function () {
      var start = prevCopy ? prevCopy.getBoundingClientRect().bottom : copy.getBoundingClientRect().top;
      var top = parseFloat(getComputedStyle(copy).top) || 0;
      var travel = tour.getBoundingClientRect().bottom - start - copy.offsetHeight;
      return { start: start, top: top, travel: Math.max(travel, 1) };
    };
    var scrollRaf = 0;
    var follow = function () {
      scrollRaf = 0;
      if (!isHeld() || !copy) {
        if (list.classList.contains('is-scrolled')) { list.classList.remove('is-scrolled'); schedule(); }
        return;
      }
      list.classList.add('is-scrolled');
      var g = span(), n = tabs.length;
      var p = clamp((g.top - g.start) / g.travel, 0, 1);
      var i = Math.min(n - 1, Math.floor(p * n));
      if (i !== at) show(i);
      list.style.setProperty('--fill', String(Math.min(p * n - i, 1)));
    };
    var onScroll = function () { if (!scrollRaf) scrollRaf = requestAnimationFrame(follow); };
    var go = function (i) {
      var g = span();
      window.scrollBy({ top: g.start - g.top + (i / tabs.length) * g.travel + 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    var pick = function (i, focus) {
      stop();
      if (isHeld()) {
        go(i);
        if (focus) tabs[i].focus({ preventScroll: true });
      } else {
        show(i, focus);
      }
    };

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(i); });
    });
    phones.forEach(function (ph, i) {
      ph.addEventListener('click', function () { if (i !== at) pick(i); });
    });
    list.addEventListener('keydown', function (e) {
      var n = tabs.length, to = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = (at + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = (at - 1 + n) % n;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = n - 1;
      if (to < 0) return;
      e.preventDefault();
      pick(to, true);
    });
    if (stage) {
      stage.addEventListener('pointerdown', stop);
      stage.addEventListener('focusin', stop);
      stage.addEventListener('chapter:toggle', schedule);
    }
    if (chap && tour && copy) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      follow();
    }
    if (auto && stage && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.5 }).observe(stage);
      document.addEventListener('visibilitychange', schedule);
    }
  });

  /* ---- "Is this you?" ------------------------------------------------------ */
  document.querySelectorAll('[data-learn]').forEach(function (demo) {
    var card = demo.querySelector('[data-learn-card]');
    var q = card && card.querySelector('.ui-ask__q');
    var kicker = demo.querySelector('[data-learn-kicker]');
    var fact = demo.querySelector('[data-learn-fact]');
    var quote = demo.querySelector('[data-learn-quote]');
    var actions = card && card.querySelector('.ui-ask__actions');
    var list = demo.querySelector('[data-learn-list]');
    var total = demo.querySelector('[data-learn-total]');
    var status = demo.querySelector('[data-learn-status]');
    var tpl = demo.querySelector('template[data-learn-next]');
    var yes = demo.querySelector('[data-answer="yes"]');
    if (!card || !q || !fact || !list || !actions || !yes) return;

    var facts = [{ kicker: kicker.textContent, fact: fact.textContent, quote: quote.textContent }];
    if (tpl && tpl.content) {
      [].slice.call(tpl.content.querySelectorAll('[data-fact]')).forEach(function (p) {
        facts.push({ kicker: p.getAttribute('data-kicker'), fact: p.getAttribute('data-fact'), quote: p.getAttribute('data-quote') });
      });
    }
    var start = {
      list: list.innerHTML,
      all: parseInt(total ? total.textContent.replace(/\D+/g, '') : '0', 10) || 0
    };
    var chev = list.querySelector('svg');
    var max = list.querySelectorAll('li').length;
    var at = 0, all = start.all, busy = false, answered = false, ended = null;

    var counts = function () {
      if (total) total.textContent = 'See all ' + all;
    };
    var show = function (i) {
      kicker.textContent = facts[i].kicker;
      fact.textContent = facts[i].fact;
      quote.textContent = facts[i].quote;
    };
    var finish = function () {
      actions.hidden = true;
      q.hidden = true;
      ended = document.createElement('div');
      ended.className = 'ui-ask__q';
      ended.innerHTML = '<p class="ui-ask__fact">You’re all caught up.</p>' +
        '<p class="ui-ask__note">Larkin asks again when it hears something new.</p>' +
        '<button type="button" class="ui-ask__again">Start over</button>';
      card.appendChild(ended);
      ended.querySelector('button').addEventListener('click', reset);
      ended.querySelector('button').focus({ preventScroll: true });
    };
    var reset = function () {
      if (ended) { ended.remove(); ended = null; }
      list.innerHTML = start.list;
      all = start.all; at = 0;
      counts(); show(0);
      q.hidden = false; actions.hidden = false;
      yes.focus({ preventScroll: true });
      if (status) status.textContent = 'Started over.';
    };
    var answer = function (keep) {
      if (busy) return;
      busy = true; answered = true;
      yes.classList.remove('is-hint');
      var said = facts[at].fact;
      if (keep) {
        var li = document.createElement('li');
        li.className = 'is-new';
        var text = document.createElement('span');
        text.textContent = said;
        li.appendChild(text);
        var tag = document.createElement('span');
        tag.className = 'ui-chip';
        tag.textContent = 'New';
        li.appendChild(tag);
        if (chev) li.appendChild(chev.cloneNode(true));
        list.insertBefore(li, list.firstChild);
        var items = list.querySelectorAll('li');
        if (items.length > max) items[items.length - 1].remove();
        all += 1;
        counts();
      }
      if (status) status.textContent = keep ? 'Added to what Larkin knows: ' + said : 'Dropped. Larkin won’t use it.';
      at += 1;
      card.classList.add('is-swapping');
      setTimeout(function () {
        if (at < facts.length) show(at); else finish();
        card.classList.remove('is-swapping');
        busy = false;
      }, reduceMotion ? 0 : 320);
    };

    demo.classList.add('is-live');
    [].slice.call(demo.querySelectorAll('[data-answer]')).forEach(function (btn) {
      btn.addEventListener('click', function () { answer(btn.getAttribute('data-answer') === 'yes'); });
    });
    demo.addEventListener('mirror:show', function () {
      if (answered || reduceMotion) return;
      yes.classList.remove('is-hint');
      setTimeout(function () { if (!answered) yes.classList.add('is-hint'); }, 700);
    });
  });

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
