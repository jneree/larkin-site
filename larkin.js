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
      var bar = document.querySelector('.site-header');
      if (bar) bar.classList.toggle('menu-open', open);
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
  /* Clear while the hero is under the bar, solid once it has scrolled away. */
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('[data-hero]');
  if (header && hero && 'IntersectionObserver' in window) {
    header.classList.add('over-hero');
    new IntersectionObserver(function (entries) {
      header.classList.toggle('over-hero', entries[0].isIntersecting);
    }, { rootMargin: '-' + (header.offsetHeight || 76) + 'px 0px 0px 0px' }).observe(hero);
  }

  /* ---- Header hides on the way down (phones) ------------------------------ */
  /* Screen height is scarce on a phone, above all in the app section where a
     screen and its explanation must fit together. Past the hero, scrolling
     down slides the bar away and any scroll up brings it back. Never while
     the menu is open or something in the bar has focus. */
  if (header) {
    var narrow = window.matchMedia('(max-width: 899px)');
    var lastY = window.scrollY, pending = false;
    var place = function () {
      pending = false;
      var y = window.scrollY;
      var heroEnd = hero ? hero.offsetHeight * 0.7 : 200;
      if (!narrow.matches || y < heroEnd || header.classList.contains('menu-open') || header.contains(document.activeElement)) {
        header.classList.remove('is-hidden');
      } else if (y > lastY + 6) {
        header.classList.add('is-hidden');
      } else if (y < lastY - 6) {
        header.classList.remove('is-hidden');
      }
      lastY = y;
    };
    window.addEventListener('scroll', function () {
      if (!pending) { pending = true; requestAnimationFrame(place); }
    }, { passive: true });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
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

  /* ---- App tour: the nav that rides along ------------------------------- */
  /* The nav sticks while the three chapters pass; the chapter whose top has
     crossed the middle of the screen lights its link. The links are plain
     anchors, so they work without this. */
  var tourNav = document.querySelector('[data-tour-nav]');
  if (tourNav) {
    var navLinks = [].slice.call(tourNav.querySelectorAll('a'));
    var chapters = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    var lit = -2, navRaf = 0, navOn = !('IntersectionObserver' in window);
    var pickChapter = function () {
      navRaf = 0;
      var mid = window.innerHeight * 0.5, at = -1;
      chapters.forEach(function (c, i) { if (c && c.getBoundingClientRect().top <= mid) at = i; });
      if (at === lit) return;
      lit = at;
      navLinks.forEach(function (a, i) {
        a.classList.toggle('is-active', i === at);
        if (i === at) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };
    var queuePick = function () { if (navOn && !navRaf) navRaf = requestAnimationFrame(pickChapter); };
    if (!navOn) {
      new IntersectionObserver(function (entries) {
        navOn = entries[0].isIntersecting;
        if (navOn) queuePick();
      }, { rootMargin: '100px 0px' }).observe(document.getElementById('app') || tourNav);
    }
    window.addEventListener('scroll', queuePick, { passive: true });
    window.addEventListener('resize', queuePick, { passive: true });
    queuePick();
  }

  /* ---- Mirror: one screen at a time ------------------------------------- */
  /* Mirror's three parts share one phone. Picking a part from the list (the
     arrow keys move along it) shows its screen. While the phone is in view
     the screens also advance on their own every few seconds, a lime line
     filling over the chosen part; the first tap, key or touch on the list or
     the phone hands control to the visitor for good. Never under reduced
     motion. */
  document.querySelectorAll('[data-mtabs]').forEach(function (list) {
    var tabs = [].slice.call(list.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    if (!tabs.length || panels.indexOf(null) > -1) return;
    var stage = panels[0].closest('[data-mstage]');
    var note = list.parentNode.querySelector('[data-mtabs-note]');
    var DWELL = 6000;
    var at = 0, auto = !reduceMotion, inView = false, timer = 0;
    list.style.setProperty('--dwell', DWELL / 1000 + 's');

    var running = function () { return auto && inView && !document.hidden; };
    var schedule = function () {
      clearTimeout(timer);
      list.classList.remove('is-auto');
      if (!running()) return;
      void list.offsetWidth; // restart the lime line
      list.classList.add('is-auto');
      timer = setTimeout(function () { show((at + 1) % tabs.length); }, DWELL);
    };
    var show = function (i, focus) {
      at = i;
      tabs.forEach(function (t, j) {
        var on = j === i;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].classList.toggle('is-on', on);
        panels[j].inert = !on;
      });
      if (note) note.textContent = tabs[i].querySelector('.mtab__text').textContent;
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
