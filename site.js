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
  /* Both videos sit below the fold and together weigh ~7MB, so the source is
     held in data-src and only attached once the element is near the viewport.
     Until then the poster stands in, and a visitor who never scrolls that far
     downloads nothing. Reduced-motion visitors get the poster plus controls. */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var startVideo = function (video) {
    if (video.dataset.started) return;
    video.dataset.started = '1';
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

  if (reduceMotion) {
    videos.forEach(function (video) {
      video.removeAttribute('autoplay');
      video.setAttribute('controls', '');
      // Attach the source so the controls have something to play, but leave
      // preload="none" in place so nothing downloads until it is asked for.
      video.src = video.dataset.src;
    });
  } else if ('IntersectionObserver' in window) {
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
