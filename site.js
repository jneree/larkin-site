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

     Three gates, because an earlier version got this wrong: the hero video is
     NOT below the fold on a desktop viewport, so an IntersectionObserver alone
     fired on the first frame and pulled 5.75MB into the initial load of the
     page ads land on.
       1. never before the load event, so video never competes with LCP;
       2. never on a metered or slow connection;
       3. then, and only then, when the element is actually near the viewport. */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var conn = navigator.connection || {};
  var slowLink = conn.saveData === true ||
                 /(^|-)2g$/.test(conn.effectiveType || '') ||
                 conn.effectiveType === '3g';

  var startVideo = function (video) {
    if (video.dataset.started) return;
    video.dataset.started = '1';
    // Posters held in data-poster are deferred too — the parser fetches a
    // poster attribute immediately, even with preload="none".
    if (video.dataset.poster && !video.getAttribute('poster')) {
      video.setAttribute('poster', video.dataset.poster);
    }
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

  var armVideos = function () {
    if (reduceMotion || slowLink) {
      // Poster plus controls: nothing downloads until the visitor asks for it.
      videos.forEach(function (video) {
        video.removeAttribute('autoplay');
        video.setAttribute('controls', '');
        if (video.dataset.poster && !video.getAttribute('poster')) {
          video.setAttribute('poster', video.dataset.poster);
        }
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

  /* ---- Privacy carousel ------------------------------------------------ */
  /* The track scrolls natively (touch, trackpad, keyboard); the buttons are an
     extra affordance for mouse users and are hidden on small screens. */
  var car = document.querySelector('[data-car]');
  if (car) {
    var step = function () {
      var card = car.querySelector('.car__card');
      // card width + the flex gap
      return card ? card.getBoundingClientRect().width + 24 : 404;
    };

    document.querySelectorAll('[data-car-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-car-nav') === 'prev' ? -1 : 1;
        var max = car.scrollWidth - car.clientWidth;
        car.scrollTo({ left: Math.max(0, Math.min(max, car.scrollLeft + dir * step())) });
      });
    });
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
