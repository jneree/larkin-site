/* The story remains readable without JavaScript. Load films only when needed. */
(function () {
  'use strict';
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var stages = Array.from(document.querySelectorAll('[data-motion]'));
  var observer = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var stage = entry.target;
      stage.visible = entry.isIntersecting;
      update(stage);
    });
  }, { threshold: 0.25 }) : null;

  function update(stage) {
    var video = stage.querySelector('video');
    var button = stage.querySelector('button');
    var shouldPlay = stage.visible && !document.hidden && !stage.userPaused && (!motion.matches || stage.userPlaying);
    if (!shouldPlay) { video.pause(); return; }
    if (!video.getAttribute('src')) { video.src = video.dataset.src; video.load(); }
    video.muted = true;
    var attempt = video.play();
    if (attempt) attempt.catch(function () { button.textContent = 'Play animation'; });
  }

  stages.forEach(function (stage) {
    var video = stage.querySelector('video');
    var button = stage.querySelector('button');
    button.hidden = false;
    video.addEventListener('playing', function () {
      stage.classList.add('is-playing', 'has-played');
      button.textContent = 'Pause animation';
    });
    video.addEventListener('pause', function () {
      stage.classList.remove('is-playing');
      button.textContent = 'Play animation';
    });
    video.addEventListener('error', function () {
      stage.classList.remove('is-playing', 'has-played');
      button.hidden = true;
    });
    button.addEventListener('click', function () {
      if (!video.paused) { stage.userPaused = true; video.pause(); }
      else {
        stage.userPaused = false;
        stage.userPlaying = true;
        stage.classList.add('user-playing');
        update(stage);
      }
    });
    if (observer) observer.observe(stage);
    else { stage.visible = true; update(stage); }
  });
  document.addEventListener('visibilitychange', function () { stages.forEach(update); });
  function onMotionChange() {
    stages.forEach(function (stage) {
      stage.userPlaying = false;
      stage.classList.remove('user-playing');
      if (motion.matches) stage.classList.remove('has-played');
      update(stage);
    });
  }
  if (motion.addEventListener) motion.addEventListener('change', onMotionChange);
  else motion.addListener(onMotionChange);
})();
