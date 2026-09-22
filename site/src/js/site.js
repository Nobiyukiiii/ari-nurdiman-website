/* Ari Nurdiman, official website. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Missing image fallback (never show a broken image) ---------- */
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG" || !img.dataset.title) return;
    var d = document.createElement("div");
    d.className = "cover-fallback";
    d.innerHTML = "<span></span>";
    d.firstChild.textContent = img.dataset.title;
    img.replaceWith(d);
  }, true);

  /* ---------- Torn paper edges (deterministic, per element) ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function edge(rand, steps, amp) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var x = (i / steps) * 100;
      var y = amp * (0.15 + rand() * 0.85);
      if (rand() > 0.86) y = amp * (1 + rand() * 0.9);
      pts.push([x, y]);
    }
    return pts;
  }
  function polygon(top, bottom, rim) {
    var p = [];
    top.forEach(function (t) { p.push(t[0].toFixed(2) + "% " + (t[1] + rim).toFixed(1) + "px"); });
    for (var i = bottom.length - 1; i >= 0; i--) {
      p.push(bottom[i][0].toFixed(2) + "% calc(100% - " + (bottom[i][1] + rim).toFixed(1) + "px)");
    }
    return "polygon(" + p.join(",") + ")";
  }
  $$("[data-tear]").forEach(function (el, idx) {
    var mode = el.getAttribute("data-tear");
    var r = rng(9173 + idx * 7919);
    var amp = 15;
    var steps = 46;
    var hasTop = mode.indexOf("top") > -1, hasBottom = mode.indexOf("bottom") > -1;
    var t = hasTop ? edge(r, steps, amp) : edge(r, steps, 0).map(function (p) { return [p[0], 0]; });
    var b = hasBottom ? edge(r, steps, amp) : edge(r, steps, 0).map(function (p) { return [p[0], 0]; });
    el.style.clipPath = polygon(t, b, 0);
    var paper = $(".torn__paper", el);
    if (paper) {
      var rim = function (pts, on) { return pts.map(function (p) { return [p[0], on ? p[1] + 3 + r() * 5 : 0]; }); };
      var inner = polygon(rim(t, hasTop), rim(b, hasBottom), 0);
      paper.style.clipPath = inner;
    }
  });

  /* ---------- Scroll progress, nav state, parallax (one rAF loop) ---------- */
  var progress = $(".progress");
  var nav = $(".nav");
  var parallax = $$("[data-parallax]");
  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    var max = doc.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
    if (nav) nav.classList.toggle("is-scrolled", y > 24);
    if (!reduce) {
      var vh = window.innerHeight;
      parallax.forEach(function (el) {
        var rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.1;
        var offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.setProperty("--py", offset.toFixed(1) + "px");
        el.style.transform = "translate3d(var(--mx, 0px), calc(var(--py, 0px) + var(--my, 0px)), 0)";
      });
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  frame();

  /* ---------- Reveal on scroll ---------- */
  $$("[data-stagger]").forEach(function (group) {
    var step = parseInt(group.getAttribute("data-stagger"), 10) || 90;
    Array.prototype.forEach.call(group.children, function (child, i) {
      if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", group.getAttribute("data-stagger-kind") || "up");
      child.style.setProperty("--d", (i * step) / 1000 + "s");
    });
  });
  var revealTargets = $$("[data-reveal], [data-write]");
  function settle(el) {
    // After the entrance, drop the reveal rules so hover transitions are snappy again.
    var delay = parseFloat(getComputedStyle(el).getPropertyValue("--d")) || 0;
    setTimeout(function () {
      el.removeAttribute("data-reveal");
      el.classList.remove("is-in");
      el.style.removeProperty("--d");
    }, (delay + 1.3) * 1000);
  }
  if (reduce || !("IntersectionObserver" in window)) {
    revealTargets.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        io.unobserve(en.target);
        if (en.target.hasAttribute("data-reveal")) settle(en.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
    revealTargets.forEach(function (el) {
      var hero = el.closest && el.closest(".hero");
      if (hero) { // hero entrance plays on load, staggered
        requestAnimationFrame(function () { setTimeout(function () { el.classList.add("is-in"); if (el.hasAttribute("data-reveal")) settle(el); }, 250); });
      } else io.observe(el);
    });
  }

  /* ---------- Hero: mouse depth ---------- */
  var hero = $(".hero");
  if (hero && fine && !reduce) {
    var depthEls = $$("[data-depth]", hero);
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5;
      var ny = (e.clientY - r.top) / r.height - 0.5;
      depthEls.forEach(function (el) {
        var d = parseFloat(el.getAttribute("data-depth")) || 10;
        el.style.setProperty("--mx", (nx * -d).toFixed(1) + "px");
        el.style.setProperty("--my", (ny * -d).toFixed(1) + "px");
        if (!el.hasAttribute("data-parallax")) el.style.transform = "translate3d(var(--mx), var(--my), 0)";
      });
    });
  }

  /* ---------- 3D tilt + glare ---------- */
  if (fine && !reduce) {
    $$("[data-tilt]").forEach(function (el) {
      var target = $(".card__cover", el) || el;
      var glare = $(".glare", el);
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        target.style.transition = "box-shadow .5s, transform .12s linear";
        target.style.transform = "rotate(0deg) rotateY(" + ((x - 0.5) * 14).toFixed(2) + "deg) rotateX(" + ((0.5 - y) * 14).toFixed(2) + "deg) translateY(-6px)";
        if (glare) { glare.style.setProperty("--gx", x * 100 + "%"); glare.style.setProperty("--gy", y * 100 + "%"); }
      });
      el.addEventListener("pointerleave", function () {
        target.style.transition = "";
        target.style.transform = "";
      });
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (fine && !reduce) {
    $$("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.transition = "transform .15s ease-out";
        el.style.transform = "translate(" + ((e.clientX - (r.left + r.width / 2)) * 0.22).toFixed(1) + "px," + ((e.clientY - (r.top + r.height / 2)) * 0.32).toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "";
      });
    });
  }

  /* ---------- Release rail: drag, arrow, progress ---------- */
  $$("[data-rail]").forEach(function (wrap) {
    var rail = $(".rail", wrap), next = $(".rail__next", wrap), bar = $(".rail__bar span", wrap);
    if (!rail) return;
    function update() {
      var max = rail.scrollWidth - rail.clientWidth;
      var p = max > 0 ? rail.scrollLeft / max : 1;
      var visible = rail.scrollWidth > 0 ? rail.clientWidth / rail.scrollWidth : 1;
      if (bar) { var w = Math.max(visible, 0.12); bar.style.width = w * 100 + "%"; bar.style.marginLeft = p * (1 - w) * 100 + "%"; }
      if (next) { next.disabled = max <= 4 || rail.scrollLeft >= max - 4; }
    }
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    if (next) next.addEventListener("click", function () {
      var card = $(".card", rail);
      var w = card ? card.getBoundingClientRect().width + 24 : 260;
      rail.scrollBy({ left: w * 1.5, behavior: reduce ? "auto" : "smooth" });
    });
    var down = false, sx = 0, sl = 0, moved = 0;
    rail.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) rail.classList.add("is-dragging");
      rail.scrollLeft = sl - dx;
    });
    window.addEventListener("pointerup", function () {
      if (!down) return; down = false;
      setTimeout(function () { rail.classList.remove("is-dragging"); }, 0);
    });
  });

  /* ---------- Song sleeve: tap to slide the record out (touch) ---------- */
  $$(".record").forEach(function (rec) {
    rec.addEventListener("click", function () { rec.classList.toggle("is-open"); });
  });

  /* ---------- Custom cursor ---------- */
  var cur = $(".cursor");
  if (cur && fine && !reduce) {
    doc.classList.add("has-cursor");
    var label = $(".cursor__label", cur);
    var x = -100, y = -100, cx = x, cy = y;
    window.addEventListener("pointermove", function (e) { x = e.clientX; y = e.clientY; cur.classList.remove("is-hidden"); }, { passive: true });
    document.addEventListener("mouseleave", function () { cur.classList.add("is-hidden"); });
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var art = t.closest("[data-cursor]");
      var link = t.closest("a, button, [role='button'], summary, input, textarea");
      cur.classList.toggle("is-art", !!art);
      cur.classList.toggle("is-link", !art && !!link);
      if (label) label.textContent = art ? art.getAttribute("data-cursor") : "";
    });
    (function loop() {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      cur.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- Mobile menu (focus trap, Escape, scroll lock) ---------- */
  var burger = $(".burger"), menu = $(".menu");
  if (burger && menu) {
    var openLabel = burger.getAttribute("data-open-label"), closeLabel = burger.getAttribute("data-close-label");
    var links = $$("a", menu);
    var setOpen = function (open) {
      menu.classList.toggle("is-open", open);
      nav.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? closeLabel : openLabel);
      document.body.style.overflow = open ? "hidden" : "";
      links.forEach(function (a, i) { a.style.transitionDelay = open ? 0.06 * i + 0.1 + "s" : "0s"; a.tabIndex = open ? 0 : -1; });
      if (open && links[0]) setTimeout(function () { links[0].focus(); }, 80); else if (!open) burger.focus({ preventScroll: true });
    };
    links.forEach(function (a) { a.tabIndex = -1; });
    burger.addEventListener("click", function () { setOpen(!menu.classList.contains("is-open")); });
    document.addEventListener("keydown", function (e) {
      if (!menu.classList.contains("is-open")) return;
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key !== "Tab") return;
      var f = [burger].concat(links), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.matchMedia("(min-width: 1024px)").addEventListener("change", function (m) { if (m.matches) setOpen(false); });
  }

  /* ---------- Page transition (paper wipe) ---------- */
  var wipe = $(".wipe");
  if (wipe && !reduce) {
    if (doc.classList.contains("wipe-in")) {
      requestAnimationFrame(function () {
        wipe.classList.add("is-out");
        doc.classList.remove("wipe-in");
        setTimeout(function () { wipe.classList.remove("is-out"); wipe.removeAttribute("style"); }, 700);
      });
    }
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin && location.protocol !== "file:") return;
      if (url.protocol !== location.protocol) return;
      if (url.pathname === location.pathname && (url.hash || url.search === location.search)) return;
      e.preventDefault();
      try { sessionStorage.setItem("wipe", "1"); } catch (err) { /* ignore */ }
      wipe.classList.add("is-leaving");
      setTimeout(function () { location.href = a.href; }, 520);
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted) wipe.classList.remove("is-leaving"); });
  }

  /* ---------- Lightbox (images and YouTube videos, only when content exists) ---------- */
  var box = $("dialog.lightbox");
  if (box && typeof box.showModal === "function") {
    var stage = $(".lightbox__inner .stage", box);
    var closeBtn = $(".lightbox__close", box);
    var closeBox = function () { box.close(); };
    closeBtn.addEventListener("click", closeBox);
    box.addEventListener("click", function (e) { if (e.target === box) closeBox(); });
    box.addEventListener("close", function () { stage.innerHTML = ""; });
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-lightbox]");
      if (!t) return;
      e.preventDefault();
      var kind = t.getAttribute("data-lightbox");
      stage.innerHTML = "";
      if (kind === "video") {
        var d = document.createElement("div");
        d.className = "ratio";
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(t.getAttribute("data-id")) + "?autoplay=1&rel=0";
        f.title = t.getAttribute("data-title") || "Video";
        f.allow = "autoplay; encrypted-media; picture-in-picture";
        f.allowFullscreen = true;
        d.appendChild(f); stage.appendChild(d);
      } else {
        var im = document.createElement("img");
        im.src = t.getAttribute("data-src"); im.alt = t.getAttribute("data-alt") || "";
        stage.appendChild(im);
      }
      box.showModal();
    });
  }

  doc.classList.add("is-ready");
})();
