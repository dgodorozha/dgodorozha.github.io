/* Page behaviour: menu, the curvature surface and its controls, section highlighting. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');
  var year = document.querySelector('.year'); if (year) year.textContent = String(new Date().getFullYear());

  var toggle = document.querySelector('.menu-toggle'), nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); toggle.textContent = open ? 'Close' : 'Menu';
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a') && nav.classList.contains('is-open')) toggle.click(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { toggle.click(); toggle.focus(); } });
  }

  /* highlight the section in view */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) current = en.target.id; });
      links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + current); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* --- the Hopf fibration -------------------------------------------------- */
  var canvas = document.getElementById('hopf');
  if (!canvas) return;
  if (!window.Hopf || !canvas.getContext || !canvas.getContext('2d')) { root.classList.add('no-surface'); return; }
  var slider = document.getElementById('eta'), pause = document.querySelector('.pause');
  var etaOut = document.querySelector('.surface__readout .eta'), degOut = document.querySelector('.surface__readout .deg');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function reflectEta(eta) {
    var deg = Math.round(2 * eta * 180 / Math.PI);
    if (etaOut) etaOut.textContent = eta.toFixed(2);
    if (degOut) degOut.textContent = deg + '\u00b0';
    if (slider) { slider.value = eta.toFixed(3); slider.setAttribute('aria-valuetext', 'eta ' + eta.toFixed(2) + ', base colatitude ' + deg + ' degrees'); }
  }
  var hopf;
  try {
    var narrow = window.matchMedia('(max-width: 54rem)').matches;
    hopf = Hopf.mount(canvas, { eta: 0.87, fibres: narrow ? 8 : 11, autoRotate: !reduce.matches, idle: !reduce.matches, onChange: reflectEta });
  } catch (err) { root.classList.add('no-surface'); return; }
  if (!hopf) { root.classList.add('no-surface'); return; }

  if (slider) slider.addEventListener('input', function () { hopf.setEta(parseFloat(slider.value)); });
  /* the size slider: the canvas outgrows its stage and draws behind the page */
  var sizeSlider = document.getElementById('size'), sizeOut = document.querySelector('.sizeval');
  function applySize(v) {
    canvas.style.setProperty('--figure-scale', v);
    if (sizeOut) sizeOut.textContent = '\u00d7' + v.toFixed(1);
    if (sizeSlider) { sizeSlider.value = v.toFixed(2); sizeSlider.setAttribute('aria-valuetext', 'size ' + v.toFixed(1)); }
  }
  if (sizeSlider) {
    sizeSlider.addEventListener('input', function () { applySize(parseFloat(sizeSlider.value)); });
    /* the page opens with the figure enlarged; less so on a phone, where it would swamp the text */
    applySize(window.matchMedia('(max-width: 54rem)').matches ? 1 : parseFloat(sizeSlider.value));
  }

  function reflectPause() {
    if (!pause) return;
    var p = hopf.isPaused(); pause.setAttribute('aria-pressed', p ? 'true' : 'false'); pause.textContent = p ? 'Resume' : 'Pause';
  }
  if (pause) pause.addEventListener('click', function () { if (hopf.isPaused()) hopf.play(); else hopf.pause(); reflectPause(); });
  if (reduce.matches) hopf.pause();
  reflectPause();
  var onPref = function () { hopf.setIdle(!reduce.matches); if (reduce.matches) hopf.pause(); reflectPause(); };
  if (reduce.addEventListener) reduce.addEventListener('change', onPref); else if (reduce.addListener) reduce.addListener(onPref);

  /* The figure draws behind the page, so a press anywhere over it (except on links,
     buttons and controls) turns it, even where text lies on top. */
  var INTERACTIVE = 'a, button, input, select, textarea, label, .site-header, .surface__controls';
  function overFigure(e) {
    var r = canvas.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  var pageDrag = null;
  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.target === canvas || e.target.closest(INTERACTIVE) || !overFigure(e)) return;
    pageDrag = e.pointerId; hopf.dragStart(e.clientX, e.clientY);
    e.preventDefault();                      /* no text selection while turning the figure */
  });
  document.addEventListener('pointermove', function (e) {
    if (pageDrag !== null && e.pointerId === pageDrag) { hopf.dragMove(e.clientX, e.clientY); return; }
    if (!hopf.isDragging()) document.body.style.cursor = (!e.target.closest(INTERACTIVE) && overFigure(e)) ? 'grab' : '';
  });
  function endPageDrag(e) { if (pageDrag !== null && e.pointerId === pageDrag) { pageDrag = null; hopf.dragEnd(); } }
  document.addEventListener('pointerup', endPageDrag); document.addEventListener('pointercancel', endPageDrag);

  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('aria-label', canvas.getAttribute('aria-label') + ' Use the arrow keys to turn it.');
  canvas.addEventListener('keydown', function (e) {
    var s = e.shiftKey ? 0.5 : 0.18;
    if (e.key === 'ArrowLeft') { hopf.nudge(-s, 0); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { hopf.nudge(s, 0); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hopf.nudge(0, -s); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { hopf.nudge(0, s); e.preventDefault(); }
  });
})();
