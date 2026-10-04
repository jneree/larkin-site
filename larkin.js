/* Larkin — progressive enhancement only. The page is fully usable without this. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Header ------------------------------------------------------------- */
  /* A floating bar. At the very top it's clear over the hero (.over-hero; the
     film's light and dark are followed below). Once the page has scrolled
     it's a frosted pill (.is-floating). Scrolling down hides it (.is-hidden)
     and any scroll up brings it back, never while something in the bar has
     focus. The nav lights the link of the section
     that holds the middle of the screen. */
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('[data-hero]');
  var onHeroTop = null; // set by the hero film below
  if (header) {
    var lastY = window.scrollY, pending = false;
    var headLinks = [].slice.call(header.querySelectorAll('.nav a'));
    var headTargets = headLinks.map(function (a) {
      var h = a.getAttribute('href');
      return h && h.charAt(0) === '#' ? document.querySelector(h) : null;
    });
    var lit = -2, wasTop = null;
    var place = function () {
      pending = false;
      var y = window.scrollY;
      var atTop = y < 10;
      header.classList.toggle('is-floating', !atTop);
      header.classList.toggle('over-hero', atTop && !!hero);
      if (atTop && wasTop === false && onHeroTop) onHeroTop();
      wasTop = atTop;
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

  /* ---- Hero film ---------------------------------------------------------- */
  /* The film plays once and rests on its last frame, which is also the poster
     underneath it, so the end is seamless. It is the first thing on the page,
     so it is requested as soon as this script runs (right after the HTML is
     parsed) rather than after the load event: waiting for load held it back
     about 8 s on a 4G connection. The poster is preloaded at high priority in
     the head, so it still arrives first.

     The copy follows the film. Measured from the footage: the text side of
     the frame is bright for the first 0.7 s, dark until 5.1 s (a sleeve, then
     close-ups of the module), then bright again on the wrist. */
  var DARK_FROM = 0.7, DARK_TO = 5.1;

  var video = hero && hero.querySelector('.hero__video');
  var filmBtn = hero && hero.querySelector('.hero__toggle');
  if (hero && video) {
    var raf = 0;

    /* The header is clear over the film, so each of its words takes the
       colour that reads best against the frame right behind it. On every new
       frame of the film (requestVideoFrameCallback, else a quick timer) the
       frame is drawn into a small thumbnail, the patch behind the wordmark
       and behind each nav link is averaged, and a word turns white (.on-dark)
       where white out-contrasts ink. Switching on the frame itself keeps the
       words in step with the film's hard cuts. If the film can't be read,
       the timings above stand in. */
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
      // Where the frame sits under the page: object-fit: cover, positioned.
      var box = video.getBoundingClientRect();
      var scale = Math.max(box.width / vw, box.height / vh);
      var at = getComputedStyle(video).objectPosition.split(' ');
      var offX = (box.width - vw * scale) * ((parseFloat(at[0]) || 50) / 100);
      var offY = (box.height - vh * scale) * ((parseFloat(at[1]) || 50) / 100);
      var k = tw / vw / scale; // thumbnail pixels per CSS pixel
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
          // White and ink contrast equally at a luminance of about 0.2; a
          // little hysteresis keeps a word from flickering on the line.
          el.classList.toggle('on-dark', el.classList.contains('on-dark') ? lum < 0.24 : lum < 0.16);
        });
      } catch (e) {
        canRead = false;
      }
    };
    onHeroTop = function () { readTones(true); };
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
      // Portrait screens: the 720×1080 crop around the wrist (1.5 MB). Wide
      // screens: 1080p, or 720p when the browser says data is precious.
      // Autoplay itself is never withheld.
      if (window.matchMedia('(max-aspect-ratio: 4/5)').matches) return video.dataset.srcPhone;
      var c = navigator.connection || {};
      var slow = c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '');
      return (hero.offsetWidth >= 1100 && !slow) ? video.dataset.srcLg : video.dataset.srcSm;
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
      // Resting frame only; the film waits for a press.
      setBtn('paused');
    } else {
      video.addEventListener('canplay', play, { once: true });
      attach();
    }
  }

  /* ---- Scroll reveals --------------------------------------------------- */
  /* Hidden states only exist under .js-anim, added right here. Anything already
     scrolled past shows at once, so a mid-page reload never strands a blank
     section above the viewport. */
  root.classList.add('js-anim');
  var reveals = document.querySelectorAll('.rv');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var rvo = new IntersectionObserver(function (entries) {
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

  /* ---- How it works: the arm film and the day ---------------------------- */
  /* The film starts loading a screen before it arrives and plays once when
     the section is properly in view, resting on its last frame (the poster).
     .is-on raises the headline, .is-settled shows the pill once the arm has
     come to rest (data-settle, seconds into the film), and .is-still brings
     the poster back whenever the film can't play. The day card plays its line
     once, when most of the line is on screen. */
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
        // The smallest film with the pixels the screen needs: the frame runs
        // the full width (on phones it's cropped from one a third wider), times
        // the pixel density, so a retina laptop (~3000 across) gets the 4K one.
        // Slow connections keep the smallest.
        var d = howVideo.dataset;
        var need = howFilm.offsetWidth * (window.matchMedia('(max-width: 699px)').matches ? 1.34 : 1) * (window.devicePixelRatio || 1);
        howVideo.src = slow ? d.srcSm : need > 2800 ? d.srcXxl : need > 2100 ? d.srcXl : need > 1400 ? d.srcLg : d.srcSm;
        howVideo.load();
      };
      howVideo.addEventListener('playing', function () { howFilm.classList.add('is-playing'); });
      howVideo.addEventListener('timeupdate', function () {
        if (howVideo.currentTime >= settleAt) howFilm.classList.add('is-settled');
      });
      howVideo.addEventListener('ended', function () { howFilm.classList.add('is-settled'); });
      howVideo.addEventListener('error', still);

      if (howFilm.getBoundingClientRect().bottom < 0) {
        still(); // already scrolled past on a mid-page reload
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
          if (p && p.catch) p.catch(still); // Low Power Mode and friends: show the resting frame
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

  /* ---- Read-along statement -------------------------------------------- */
  /* The statement pins while scroll lights it word by word, and the marked
     key phrase gets its highlighter swept in once the reading reaches it
     (scrolling back up takes it off again). Without JS, or with reduced
     motion, the words are never wrapped or dimmed and the phrase simply
     stays highlighted. */
  var pin = document.querySelector('.statement-pin');
  var reads = pin ? [].slice.call(pin.querySelectorAll('.statement__read')) : [];
  if (pin && reads.length && !reduceMotion) {
    root.classList.add('stmt-scrub');
    var DIM = 0.18, LEAD = 4;
    var words = [];
    var marker = null, markFrom = -1;
    // Rebuild each paragraph word by word, keeping the <mark> around its words.
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
    var N = words.length;
    if (marker) {
      var marked = marker.querySelectorAll('.w');
      for (var k = 0; k < marked.length; k++) {
        marked[k].style.setProperty('--d', (k / marked.length * 1.3).toFixed(2) + 's');
      }
    }
    var START = 0.06, END = 0.86;
    var paint = function () {
      var vh = window.innerHeight || root.clientHeight;
      var span = pin.offsetHeight - vh;
      var progress = span > 0 ? (-pin.getBoundingClientRect().top / span) : 0;
      progress = Math.max(0, Math.min(1, progress));
      var pr = Math.max(0, Math.min(1, (progress - START) / (END - START)));
      var reach = pr * (N + LEAD);
      for (var i = 0; i < N; i++) {
        var wp = Math.max(0, Math.min(1, (reach - i) / LEAD));
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
  /* Below 700px the three chapters are tiles in a row that swipes, and the
     dots under it follow along. There the row also takes keyboard focus, so
     the arrow keys can scroll it. */
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
      i = Math.max(0, Math.min(tiles.length - 1, i));
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
  /* From 960px the chapters' words scroll past on the left while their
     screens share one tile on the right, held in place (.is-held, laid out in
     CSS). The chapter whose words have reached the middle of the screen is
     marked .is-at and its screen shows. Each screen's small animations (the
     days filing in, the dots finding their places) play when it arrives and
     reset once it has faded out, so they play again on the way back; the
     scroll reveals stop handing those out here. Clicking or tabbing into a
     chapter (Mirror's list, say, before its words reach the middle) brings
     its screen forward. Without this script the chapters stay rows. */
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
      // Its animations wait until the tile is actually on screen.
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
  /* Mirror's three parts each have a phone on the tile: the chosen part's in
     front, the other two barely there on either side. Picking a part from
     the list (the arrow keys move along it), or clicking a phone at the
     side, turns its phone to the front. While the tile is in view the parts
     also advance on their own every few seconds, a lime line filling beside
     the chosen part; the first tap, key or touch on the list or the phones
     hands control to the visitor for good. Never under reduced motion. */
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

    // On wide screens the tile is shared: Mirror's parts advance only while
    // Mirror is the chapter on show.
    var chap = stage && stage.closest('.chap');
    var shown = function () { return !chap || !tour || !tour.classList.contains('is-held') || chap.classList.contains('is-at'); };
    var running = function () { return auto && inView && shown() && !document.hidden; };
    var schedule = function () {
      clearTimeout(timer);
      list.classList.toggle('is-playing', auto);
      list.classList.remove('is-auto');
      if (!running()) return;
      void list.offsetWidth; // restart the lime line
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
          // The phone moving from one end of the fan to the other passes
          // behind the rest, fading out on the way (restarted each time).
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

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { stop(); show(i); });
    });
    // A phone at the side comes to the front when clicked. (Its screen is
    // inert, so the click lands on the phone itself.)
    phones.forEach(function (ph, i) {
      ph.addEventListener('click', function () { if (i !== at) { stop(); show(i); } });
    });
    list.addEventListener('keydown', function (e) {
      var n = tabs.length, to = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = (at + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = (at - 1 + n) % n;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = n - 1;
      if (to < 0) return;
      e.preventDefault();
      stop();
      show(to, true);
    });
    if (stage) {
      stage.addEventListener('pointerdown', stop);
      stage.addEventListener('focusin', stop);
      stage.addEventListener('chapter:toggle', schedule);
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
  /* The card can be answered. "That's me" files the fact at the top of What
     Larkin knows, tagged New, and the count goes up; "Not me" lets it go.
     Either way the next fact from the template takes its place, and after the
     last one the card says so and offers to start over. Before any answer,
     the lime button nudges each time Mirror shows this screen. */
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

  /* ---- Pre-order gallery ------------------------------------------------ */
  /* Auto-advances while on screen, hands over to the visitor for good on the
     first tap. Reduced motion never auto-advances. */
  document.querySelectorAll('[data-pgal]').forEach(function (gal) {
    var frames = [].slice.call(gal.querySelectorAll('.pgal__frame'));
    var thumbs = [].slice.call(gal.querySelectorAll('.pgal__thumbs button'));
    if (!frames.length || frames.length !== thumbs.length) return;
    var at = 0, timer = null, auto = !reduceMotion;
    var showFrame = function (i) {
      at = i;
      frames.forEach(function (f, j) { f.classList.toggle('is-active', j === i); });
      thumbs.forEach(function (t, j) {
        t.classList.toggle('is-active', j === i);
        t.setAttribute('aria-pressed', String(j === i));
      });
    };
    var stop = function () { if (timer) { clearInterval(timer); timer = null; } };
    var go = function () { if (!timer) timer = setInterval(function () { showFrame((at + 1) % frames.length); }, 3800); };
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

  /* ---- Checkout attribution -------------------------------------------- */
  /* Every reserve CTA goes to the Stripe Payment Link for the $10 deposit,
     tagged with the page as client_reference_id. Fire InitiateCheckout with
     the same segment so the pages stay distinguishable in Meta reporting. */
  var segment = root.getAttribute('data-theme') || 'general';
  document.querySelectorAll('a[data-reserve]').forEach(function (link) {
    link.addEventListener('click', function () {
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
