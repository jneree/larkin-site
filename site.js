/* Larkin — progressive enhancement only. The page is fully usable without this. */
(function () {
  'use strict';

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

    // Leaving the mobile breakpoint should never strand an open panel.
    var wide = window.matchMedia('(min-width: 900px)');
    var onWide = function (e) { if (e.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ---- Sticky header shadow -------------------------------------------- */
  var header = document.querySelector('.site-header');
  if (header && 'IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);

    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* ---- Background video ------------------------------------------------ */
  /* The two videos weigh ~7MB together, so the source is held in data-src and
     attached only when it is actually wanted.

     Two gates, because an earlier version got this wrong: the hero video is
     NOT below the fold on a desktop viewport, so an IntersectionObserver alone
     fired on the first frame and pulled 5.75MB into the initial load of the
     page ads land on.
       1. never before the load event, so video never competes with LCP;
       2. then, and only then, when the element is actually near the viewport. */
  /* Autoplay is unconditional apart from the OS-level reduced-motion setting:
     an earlier connection heuristic (saveData / 2g / 3g) turned autoplay off
     for anyone on a link the browser merely guessed was slow, which read as
     the video being broken. The weight gates stay: nothing is fetched before
     the load event, and only when the element comes near the viewport. */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The poster is the section's visible content until the clip is attached, so
     it must arrive before the reader does — but a `poster` attribute in the
     markup is fetched eagerly no matter what, which is why it lives in
     data-poster. Bring it in on approach: far enough ahead that the frame is
     never empty on screen, late enough that it costs nothing on first paint. */
  var showPoster = function (video) {
    if (video.dataset.poster && !video.getAttribute('poster')) {
      video.setAttribute('poster', video.dataset.poster);
    }
  };

  var startVideo = function (video) {
    if (video.dataset.started) return;
    video.dataset.started = '1';
    showPoster(video);
    video.src = video.dataset.src;

    var tries = 0;
    var play = function () {
      if (tries > 5 || !video.paused) return;
      tries++;
      video.muted = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    };

    // Some browsers refuse the first play() until the media is decodable.
    video.addEventListener('loadeddata', play, { once: true });
    video.addEventListener('canplay', play, { once: true });
    play();
  };

  var videos = document.querySelectorAll('video[data-src]');

  if ('IntersectionObserver' in window) {
    var po = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        showPoster(entry.target);
        po.unobserve(entry.target);
      });
    }, { rootMargin: '600px 0px' });
    videos.forEach(function (video) { po.observe(video); });
  } else {
    videos.forEach(showPoster);
  }

  var armVideos = function () {
    // Floor: whatever the observers do, every poster is in place once the page
    // has loaded. On the segment pages the exploded view IS the section's
    // content, so an empty frame is never an acceptable resting state.
    videos.forEach(showPoster);

    if (reduceMotion) {
      // Poster plus controls: nothing moves until the visitor asks for it.
      videos.forEach(function (video) {
        video.removeAttribute('autoplay');
        video.setAttribute('controls', '');
        showPoster(video);
        video.src = video.dataset.src;
      });
      return;
    }

    if ('IntersectionObserver' in window) {
      var vo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          startVideo(entry.target);
          vo.unobserve(entry.target);
        });
      }, { rootMargin: '200px 0px' });
      videos.forEach(function (video) { vo.observe(video); });
    } else {
      videos.forEach(startVideo);
    }
  };

  // Hold everything until the page has finished loading, then until the main
  // thread is idle. This is what keeps the hero video out of the critical path.
  var whenIdle = function () {
    if (window.requestIdleCallback) window.requestIdleCallback(armVideos, { timeout: 2000 });
    else setTimeout(armVideos, 200);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });

  /* ---- Carousels (features, privacy) ----------------------------------- */
  /* Each track scrolls natively (touch, trackpad, keyboard); the buttons are
     an extra affordance for mouse users and are hidden on small screens. A
     page can hold several carousels — each section's buttons drive only the
     track they share the section with. */
  document.querySelectorAll('[data-car]').forEach(function (car) {
    var scope = car.closest('section') || document;
    var step = function () {
      var card = car.querySelector('.car__card');
      // card width + the flex gap
      return card ? card.getBoundingClientRect().width + 24 : 404;
    };

    scope.querySelectorAll('[data-car-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-car-nav') === 'prev' ? -1 : 1;
        var max = car.scrollWidth - car.clientWidth;
        car.scrollTo({ left: Math.max(0, Math.min(max, car.scrollLeft + dir * step())) });
      });
    });
  });

  /* ---- Scroll reveals --------------------------------------------------- */
  /* Hidden states only exist under .js-anim, added right here — if this file
     never runs, nothing on the page is ever hidden. Elements already scrolled
     past reveal instantly, so a mid-page reload or anchor jump never strands a
     blank section above the viewport. */
  document.documentElement.classList.add('js-anim');
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
  /* The big statement starts dim and lights word by word as it scrolls past a
     reading line, so the visitor is paced through the sentence instead of
     skimming it. The page scrolls normally — this only maps scroll position to
     per-word brightness, there is no pinning. Without JS, or with reduced
     motion, the words are never wrapped, so the sentence stays plainly bright
     and readable. */
  var revEl = document.querySelector('.statement--reveal');
  var reads = revEl ? [].slice.call(revEl.querySelectorAll('.statement__read')) : [];
  if (reads.length && !reduceMotion) {
    var DIM = 0.24;   // resting brightness of an unread word
    var LEAD = 4;     // words in the soft edge between dim and lit
    var words = [];   // every word, in document order, across all paragraphs
    reads.forEach(function (read) {
      var parts = read.textContent.trim().split(/\s+/);
      read.textContent = '';
      parts.forEach(function (part, i) {
        var w = document.createElement('span');
        w.className = 'w';
        w.textContent = part;
        w.style.opacity = DIM;
        read.appendChild(w);
        if (i < parts.length - 1) read.appendChild(document.createTextNode(' '));
        words.push(w);
      });
    });
    var N = words.length;

    var paint = function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var first = reads[0].getBoundingClientRect();
      var last = reads[reads.length - 1].getBoundingClientRect();
      // Drive the reveal off the centre of the whole statement, so it finishes
      // lighting just as the block settles into the middle of the screen. Words
      // light straight through the paragraph break, so the pause reads too.
      var center = (first.top + last.bottom) / 2;
      var p = (vh * 0.85 - center) / (vh * 0.42);
      if (p < 0) p = 0; else if (p > 1) p = 1;
      var reach = p * (N + LEAD);
      for (var i = 0; i < N; i++) {
        var wp = (reach - i) / LEAD;
        if (wp < 0) wp = 0; else if (wp > 1) wp = 1;
        words[i].style.opacity = DIM + (1 - DIM) * wp;
      }
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
      }, { rootMargin: '120px 0px' }).observe(revEl);
    } else {
      onView = true;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
  }

  /* ---- Checkout attribution -------------------------------------------- */
  /* Every reserve CTA leaves for Shopify. Fire InitiateCheckout tagged with the
     segment so the five pages are distinguishable in Meta reporting — the
     checkout URL itself is shared. */
  var segment = document.documentElement.getAttribute('data-theme') || 'general';
  document.querySelectorAll('a[href*="myshopify.com/cart"]').forEach(function (link) {
    link.addEventListener('click', function () {
      /* Deliberately no value/currency: the pages quote "$10" but the Shopify
         store still charges SGD. Reporting a currency that does not match the
         charge would corrupt ROAS. Add both back once the store currency is
         settled. */
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', {
          content_name: 'Larkin Wristband (Reservation)',
          content_category: segment
        });
      }
    });
  });
})();
