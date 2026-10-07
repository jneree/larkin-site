/* Website analytics: PostHog, cookieless, loaded by every page.
   Counts visitors, pages and referrers without setting cookies or storing
   anything in the browser, so no consent banner is needed. Unique visitors
   rely on "Cookieless server hash mode" being on in the PostHog project
   (Settings › Web analytics). Runs on getlarkin.com only, so local previews
   don't pollute the numbers. */
(function () {
  var KEY = 'phc_rzWEgYNNgxcqisvkagzWbGsHeWSNJKz5UMGREqVaqAof';
  if (location.hostname !== 'getlarkin.com' || KEY.indexOf('phc_') !== 0) return;

  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister identify reset get_distinct_id set_config opt_in_capturing opt_out_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  window.posthog.init(KEY, {
    api_host: 'https://us.i.posthog.com',
    cookieless_mode: 'always',
    person_profiles: 'identified_only',
    disable_session_recording: true
  });
})();
