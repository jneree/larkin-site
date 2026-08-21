/* Larkin v1 trial — reveal + highlight sweep. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  if (reduce) { root.classList.add('no-anim'); return; }
  root.classList.add('js-anim');

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('.hl').forEach(function (m) { m.classList.add('on'); });
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

  /* highlights not inside an .rv (hero h1) sweep shortly after load */
  window.addEventListener('load', function () {
    setTimeout(function () {
      document.querySelectorAll('.hl').forEach(function (m) {
        if (!m.closest('.rv')) m.classList.add('on');
      });
    }, 350);
  });
})();
