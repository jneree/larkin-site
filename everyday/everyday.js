/* Larkin, Everyday: motion on view, the beta form, and reserve tracking. */
(function () {
  'use strict';
  var segment = document.documentElement.getAttribute('data-segment') || 'everyday';
  var anim = document.documentElement.classList.contains('anim');

  /* ---- On view: curtains open, words rise, notes are written ---------- */
  var watched = [].slice.call(document.querySelectorAll('.curtain, .rise'));
  if (!anim || !('IntersectionObserver' in window)) {
    watched.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    // The hero's photo opens straight away, the page's first gesture.
    document.querySelectorAll('.curtain.is-now').forEach(function (el) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-in'); }); });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    watched.forEach(function (el) { if (!el.classList.contains('is-now')) io.observe(el); });
  }

  /* ---- The beta form, posted to the same list as the homepage --------- */
  document.querySelectorAll('[data-beta-form]').forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var msg = form.querySelector('[data-beta-msg]');
    var endpoint = form.getAttribute('data-endpoint');
    var say = function (text) { msg.textContent = text; };
    var done = function () {
      form.classList.add('is-done');
      say('You’re on the list. Your invite will come to ' + input.value.trim() + '.');
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

  /* ---- Reserve clicks, counted as on the homepage ----------------------- */
  document.querySelectorAll('a[data-reserve]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.posthog && window.posthog.capture) window.posthog.capture('reserve_clicked', { segment: segment });
    });
  });
})();
