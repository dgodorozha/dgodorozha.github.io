/*
 * The Hopf fibration. Points of the three-sphere are pairs of complex numbers
 * (z1, z2) with |z1|² + |z2|² = 1; the fibre over a point of the ordinary sphere
 * is the circle z1 = sin η e^{it}, z2 = cos η e^{i(t+ψ)}. Fibres over one circle
 * of latitude (fixed η, ψ varying) fill a torus, and tori over different
 * latitudes nest and link. Everything is projected stereographically to three
 * dimensions and drawn as hairlines on a 2D canvas.
 *
 *   const h = Hopf.mount(canvas, { onChange: eta => ... });
 *   h.setEta(0.9); h.pause(); h.play(); h.nudge(dyaw, dpitch); h.destroy();
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  function mount(canvas, options) {
    var o = options || {};
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var pal = o.palette || {
      warm: ['#f65255', '#fa9d4f', '#fde150'],
      blue: ['#1a3cb5', '#3c7edb', '#9ccff2'],
      teal: ['#1f6f6a', '#5ccdbb', '#b6f2e1']
    };
    var P = [pal.warm.map(hex), pal.blue.map(hex), pal.teal.map(hex)];   /* outer, middle, inner torus */
    var FIB = o.fibres || 11, SEG = o.samples || 150, DELTA = o.delta || 0.2;
    var ETA_MIN = 0.62, ETA_MAX = 1.12;
    var maxDpr = o.maxPixelRatio || 3, minDpr = o.minPixelRatio || 2;   /* always at least 2x: crisp lines on ordinary screens too */
    var autoRotate = o.autoRotate !== false, idle = o.idle !== false;
    var onChange = typeof o.onChange === 'function' ? o.onChange : null;

    var S = { yaw: o.startYaw != null ? o.startYaw : 0.3, pitch: o.startPitch != null ? o.startPitch : 0.95, vyaw: 0, vpitch: 0,
              eta: o.eta != null ? o.eta : 0.87, psi: 0, scale: 0 };
    var paused = false, visible = true, raf = 0, last = 0, sizeDirty = true, W = 0, H = 0, dpr = 1;
    var dragging = false, dragId = null, lastX = 0, lastY = 0, lastMove = 0;

    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(Math.max(global.devicePixelRatio || 1, minDpr), maxDpr);
      /* a pixel budget, so that an enlarged figure does not become a very large bitmap */
      var budget = o.pixelBudget || 9e6, need = r.width * r.height * dpr * dpr;
      if (need > budget) dpr = Math.max(1, dpr * Math.sqrt(budget / need));
      W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      sizeDirty = false;
    }

    /* Each fibre is drawn in runs: consecutive samples that fall in the same
       depth band are stroked as one path, so there are no overlapping caps to
       bead the line, and the runs are sorted back to front across all fibres. */
    var BANDS = 10;
    var px = new Float32Array(SEG + 1), py = new Float32Array(SEG + 1), pz = new Float32Array(SEG + 1);
    var runs = [];

    function draw() {
      if (sizeDirty) resize();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2, D = 4.6;
      var cyw = Math.cos(S.yaw), syw = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
      var maxn = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      var etas = [S.eta - DELTA, S.eta, S.eta + DELTA];
      var pts = [];
      for (var t3 = 0; t3 < 3; t3++) {
        var eta = etas[t3], se = Math.sin(eta), ce = Math.cos(eta);
        for (var f = 0; f < FIB; f++) {
          var psi = TAU * f / FIB + S.psi;
          for (var s = 0; s <= SEG; s++) {
            var t = TAU * s / SEG;
            var x1 = se * Math.cos(t), x2 = se * Math.sin(t), x3 = ce * Math.cos(t + psi), x4 = ce * Math.sin(t + psi);
            var d = 1.02 - x4;                       /* stereographic projection from (0,0,0,1) */
            var X = x1 / d, Y = x3 / d, Z = -x2 / d;  /* x right, y up, z toward the viewer */
            var X2 = cyw * X + syw * Z, Z2 = -syw * X + cyw * Z;
            var Y2 = cp * Y - sp * Z2; Z2 = sp * Y + cp * Z2;
            var nn = Math.sqrt(X2 * X2 + Y2 * Y2 + Z2 * Z2); if (nn > maxn) maxn = nn;
            if (X2 < minX) minX = X2; if (X2 > maxX) maxX = X2; if (Y2 < minY) minY = Y2; if (Y2 > maxY) maxY = Y2;
            pts.push(X2, Y2, Z2);
          }
        }
      }
      var half = Math.max(maxX - minX, maxY - minY) * 0.5 || 1;
      var target = Math.min(W, H) * 0.46 / half, tcx = (minX + maxX) * 0.5, tcy = (minY + maxY) * 0.5;
      S.target = target;
      if (!S.scale) { S.scale = target; S.ox = tcx; S.oy = tcy; }
      else { S.scale += (target - S.scale) * 0.12; S.ox += (tcx - S.ox) * 0.12; S.oy += (tcy - S.oy) * 0.12; }
      var R = S.scale, k = 0, inv = 1 / maxn, ox = S.ox, oy = S.oy;
      runs.length = 0;
      var zAll = [];
      for (t3 = 0; t3 < 3; t3++) {
        for (f = 0; f < FIB; f++) {
          var hval = 0.5 + 0.5 * Math.sin(TAU * f / FIB);
          for (s = 0; s <= SEG; s++) {
            var X = pts[k], Y = pts[k + 1], Z = pts[k + 2]; k += 3;
            var fp = D / (D - Z * inv);
            px[s] = cx + (X - ox) * R * fp; py[s] = cy - (Y - oy) * R * fp; pz[s] = Z * inv;
          }
          /* cut the fibre into runs by depth band */
          var band = Math.floor((pz[0] + 1) * 0.5 * BANDS), from = 0;
          for (s = 1; s <= SEG; s++) {
            var b = Math.floor((pz[s] + 1) * 0.5 * BANDS);
            if (b !== band || s === SEG) {
              var to = s;                                   /* the run includes the boundary sample */
              var arr = new Float32Array((to - from + 1) * 2), zsum = 0;
              for (var q = from; q <= to; q++) { arr[(q - from) * 2] = px[q]; arr[(q - from) * 2 + 1] = py[q]; zsum += pz[q]; }
              runs.push({ p: arr, z: zsum / (to - from + 1), c: t3, h: hval });
              band = b; from = s;
            }
          }
        }
      }
      runs.sort(function (a, b) { return a.z - b.z; });
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      for (var i = 0; i < runs.length; i++) {
        var r = runs[i], depth = clamp((r.z + 1) * 0.5, 0, 1), st = P[r.c], h = r.h;
        var c = h < 0.5 ? mix(st[0], st[1], h * 2) : mix(st[1], st[2], (h - 0.5) * 2);
        ctx.strokeStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (0.3 + 0.65 * depth).toFixed(2) + ')';
        ctx.lineWidth = dpr * (1.0 + 1.2 * depth);
        var a = r.p; ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        for (var j = 2; j < a.length; j += 2) ctx.lineTo(a[j], a[j + 1]);
        ctx.stroke();
      }
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (idle) S.psi += 0.12 * dt;                  /* fibres slide around their tori */
      if (!dragging) {
        if (autoRotate) S.yaw += 0.05 * dt;
        S.yaw += S.vyaw * dt; S.pitch = clamp(S.pitch + S.vpitch * dt, -1.2, 1.2);
        var damp = Math.exp(-3.2 * dt); S.vyaw *= damp; S.vpitch *= damp;
        if (Math.abs(S.vyaw) < 0.002) S.vyaw = 0;
        if (Math.abs(S.vpitch) < 0.002) S.vpitch = 0;
      }
      draw();
      var settling = Math.abs(S.scale - S.target) > 0.5;
      var moving = idle || autoRotate || dragging || S.vyaw || S.vpitch || settling;
      if (moving && !paused && visible) raf = global.requestAnimationFrame(frame); else last = 0;
    }
    function kick() { if (!raf && !paused && visible) raf = global.requestAnimationFrame(frame); }

    /* dragging, usable from the canvas itself or from anywhere the page forwards a pointer */
    function dragStart(x, y) {
      dragging = true; lastX = x; lastY = y; lastMove = performance.now();
      S.vyaw = S.vpitch = 0; canvas.classList.add('is-grabbing'); kick();
    }
    function dragMove(x, y) {
      if (!dragging) return;
      var r = canvas.getBoundingClientRect(), k = 3.0 / Math.max(1, r.width);
      var dx = x - lastX, dy = y - lastY, now = performance.now(), dt = Math.max(1, now - lastMove) / 1000;
      S.yaw += dx * k; S.pitch = clamp(S.pitch + dy * k, -1.2, 1.2);
      S.vyaw = dx * k / dt; S.vpitch = dy * k / dt;
      lastX = x; lastY = y; lastMove = now; kick();
    }
    function dragEnd() {
      if (!dragging) return;
      dragging = false; canvas.classList.remove('is-grabbing');
      if (performance.now() - lastMove > 90) S.vyaw = S.vpitch = 0;
      S.vyaw = clamp(S.vyaw, -6, 6); S.vpitch = clamp(S.vpitch, -6, 6);
      kick();
    }
    function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      dragId = e.pointerId; dragStart(e.clientX, e.clientY);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) { if (dragging && e.pointerId === dragId) dragMove(e.clientX, e.clientY); }
    function onUp(e) {
      if (!dragging || e.pointerId !== dragId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      dragId = null; dragEnd();
    }
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
    canvas.style.touchAction = 'none';

    var ro = null, io = null;
    if (global.ResizeObserver) { ro = new ResizeObserver(function () { sizeDirty = true; S.scale = 0; if (paused || !visible) draw(); else kick(); }); ro.observe(canvas); }
    if (global.IntersectionObserver) { io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }); io.observe(canvas); }

    draw(); kick();
    if (onChange) onChange(S.eta);

    return {
      setEta: function (v) { S.eta = clamp(v, ETA_MIN, ETA_MAX); if (onChange) onChange(S.eta); if (paused) draw(); else kick(); },
      getEta: function () { return S.eta; },
      range: [ETA_MIN, ETA_MAX],
      setIdle: function (v) { idle = !!v; autoRotate = !!v; kick(); },
      pause: function () { paused = true; if (raf) { global.cancelAnimationFrame(raf); raf = 0; } last = 0; },
      play: function () { paused = false; kick(); },
      isPaused: function () { return paused; },
      nudge: function (dy, dp) { S.yaw += dy || 0; S.pitch = clamp(S.pitch + (dp || 0), -1.2, 1.2); if (paused) draw(); else kick(); },
      dragStart: dragStart, dragMove: dragMove, dragEnd: dragEnd, isDragging: function () { return dragging; },
      renderNow: function () { sizeDirty = true; S.scale = 0; draw(); },
      destroy: function () {
        this.pause();
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
        if (ro) ro.disconnect(); if (io) io.disconnect();
      }
    };
  }
  global.Hopf = { mount: mount };
})(window);
