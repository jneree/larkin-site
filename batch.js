/* Founder batch: the live reserved number, from /batch.json (kept in step with Stripe by
   .github/workflows/batch-count.yml). The number written in each page is the fallback.
   Marks it reads:
     [data-reserved]       text becomes the number, e.g. 712
     [data-reserved-bar]   width becomes the share of the batch; aria-valuenow too
     [data-reserved][data-count]  the homepage meter's count-up target
     <html data-batch-count>  the pip page's meter
   Then fires "larkin:batch" on window with { reserved, size }. */
(function () {
  if (!window.fetch) return;
  fetch('/batch.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.reserved !== 'number') return;
      var size = d.size || 1000, n = Math.max(0, Math.min(size, Math.round(d.reserved)));
      var txt = n.toLocaleString('en-US'), pct = (n / size * 100).toFixed(1) + '%';
      document.querySelectorAll('[data-reserved]').forEach(function (el) {
        if (el.closest('.is-armed:not(.is-on)')) return;   /* the homepage meter shows 0 until it counts up */
        el.textContent = el.hasAttribute('data-count') ? String(n) : txt;
      });
      document.querySelectorAll('[data-reserved-bar]').forEach(function (el) {
        el.style.width = pct;
        var pb = el.closest('[aria-valuenow]'); if (pb) pb.setAttribute('aria-valuenow', n);
      });
      document.querySelectorAll('[data-reserved][data-count]').forEach(function (el) { el.setAttribute('data-count', n); });
      document.documentElement.setAttribute('data-batch-count', n);
      window.dispatchEvent(new CustomEvent('larkin:batch', { detail: { reserved: n, size: size } }));
    })
    .catch(function () {});
})();
