/* Larkin — progressive enhancement only. The page is fully usable without this. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Mobile nav disclosure ------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var panel = document.getElementById('mobile-nav');
  if (toggle && panel) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Any link tap closes the panel, so anchor jumps land on a clean view.
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    var wide = window.matchMedia('(min-width: 900px)');
    var onWide = function (e) { if (e.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ---- Header over the hero --------------------------------------------- */
  /* Clear while the hero is under the bar, solid once it has scrolled away.
     The bar only goes clear on wide frames (see larkin.css); on phones it is
     always solid, so the class is harmless there. */
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('[data-hero]');
  if (header && hero && 'IntersectionObserver' in window) {
    header.classList.add('over-hero');
    new IntersectionObserver(function (entries) {
      header.classList.toggle('over-hero', entries[0].isIntersecting);
    }, { rootMargin: '-' + (header.offsetHeight || 76) + 'px 0px 0px 0px' }).observe(hero);
  }

  /* ---- Hero film ---------------------------------------------------------- */
  /* The film plays once and rests on its last frame, which is also the poster
     underneath it, so the end is seamless. It is fetched only after the page
     has loaded and the main thread is idle, so it never competes with the
     poster for first paint.

     The copy follows the film. Measured from the footage: the text side of
     the frame is bright for the first 0.7 s, dark until 5.1 s (a sleeve, then
     close-ups of the module), then bright again on the wrist. */
  var DARK_FROM = 0.7, DARK_TO = 5.1;

  var video = hero && hero.querySelector('.hero__video');
  var filmBtn = hero && hero.querySelector('.hero__toggle');
  if (hero && video) {
    var raf = 0;
    var setDark = function (dark) {
      hero.classList.toggle('is-dark', dark);
      if (header) header.classList.toggle('on-dark', dark);
    };
    var sync = function () {
      var t = video.currentTime;
      setDark(t >= DARK_FROM && t < DARK_TO);
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
      // 1080p for wide screens and dense phones, 720p when the browser says
      // data is precious. Autoplay itself is never withheld.
      var c = navigator.connection || {};
      var slow = c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || '');
      var big = hero.offsetWidth >= 900 || (window.devicePixelRatio || 1) >= 2;
      return (big && !slow) ? video.dataset.srcLg : video.dataset.srcSm;
    };

    var attach = function () {
      if (video.getAttribute('src')) return;
      video.src = pickSource();
      video.load();
    };

    video.addEventListener('playing', function () {
      hero.classList.add('is-playing');
      setBtn('playing');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    });
    video.addEventListener('pause', function () {
      cancelAnimationFrame(raf);
      if (!video.ended) setBtn('paused');
    });
    video.addEventListener('ended', function () {
      cancelAnimationFrame(raf);
      setDark(false);
      setBtn('ended');
    });

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
      var start = function () {
        attach();
        video.addEventListener('canplay', play, { once: true });
      };
      var whenIdle = function () {
        if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 1500 });
        else setTimeout(start, 200);
      };
      if (document.readyState === 'complete') whenIdle();
      else window.addEventListener('load', whenIdle, { once: true });
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

  /* ---- App showcase ----------------------------------------------------- */
  /* Wide screens: one phone holds still while the five screens' copy scrolls
     past; whichever item crosses the middle of the viewport owns the phone.
     Phones: the items are a swipeable row, and the dots follow the swipe. */
  var show = document.querySelector('[data-show]');
  if (show) {
    var items = [].slice.call(show.querySelectorAll('.show__item'));
    var shots = [].slice.call(show.querySelectorAll('.phone--stage img'));
    var tabs = [].slice.call(show.querySelectorAll('.show__tabs a'));
    var dots = [].slice.call(show.querySelectorAll('.show__dots i'));
    var list = show.querySelector('[data-show-list]');
    var current = 0;

    var activate = function (i) {
      if (i === current || i < 0 || i >= items.length) return;
      current = i;
      shots.forEach(function (img, j) { img.classList.toggle('is-active', j === i); });
      tabs.forEach(function (a, j) {
        a.classList.toggle('is-active', j === i);
        if (j === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      });
      dots.forEach(function (d, j) { d.classList.toggle('is-active', j === i); });
    };
    if (tabs[0]) tabs[0].setAttribute('aria-current', 'step');

    // The stage's pictures are fetched only as the section approaches.
    var loadShots = function () {
      shots.forEach(function (img) {
        if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;
      });
    };

    var stacked = window.matchMedia('(min-width: 960px)');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting && stacked.matches) { loadShots(); obs.disconnect(); }
      }, { rootMargin: '1200px 0px' }).observe(show);

      var io = new IntersectionObserver(function (entries) {
        if (!stacked.matches) return;
        entries.forEach(function (entry) {
          if (entry.isIntersecting) activate(items.indexOf(entry.target));
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      items.forEach(function (item) { io.observe(item); });
    } else {
      loadShots();
    }
    var onStacked = function (e) { if (e.matches) loadShots(); };
    if (stacked.addEventListener) stacked.addEventListener('change', onStacked);
    else if (stacked.addListener) stacked.addListener(onStacked);

    // Tabs scroll to their item; on phones they aren't shown.
    tabs.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var r = items[i].getBoundingClientRect();
        var y = window.scrollY + r.top + r.height / 2 - window.innerHeight / 2;
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    if (list) {
      var swipeRaf = 0;
      list.addEventListener('scroll', function () {
        if (stacked.matches || swipeRaf) return;
        swipeRaf = requestAnimationFrame(function () {
          swipeRaf = 0;
          var first = items[0].getBoundingClientRect().left;
          var step = items[1] ? items[1].getBoundingClientRect().left - first : 1;
          var i = Math.round((list.getBoundingClientRect().left - first + 1) / step);
          if (list.scrollLeft + list.clientWidth >= list.scrollWidth - 4) i = items.length - 1;
          activate(Math.max(0, Math.min(items.length - 1, i)));
        });
      }, { passive: true });
    }
  }

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
  /* Every reserve CTA leaves for /reserve, which mints a Stripe Checkout
     session. Fire InitiateCheckout tagged with the page's segment. */
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
