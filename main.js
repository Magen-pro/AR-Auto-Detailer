/* ================================================================
   AR AUTO DETAILER CHENNAI — main.js
   Covers:
     1. Nav — scroll glass effect + mobile drawer
     2. Scroll reveal (IntersectionObserver)
     3. Before / After slider (mouse + touch, label fade)
     4. Before / After tab switcher
     5. Reviews carousel (JS transform, swipe, infinite loop,
        arrow buttons, dot nav — NO auto-scroll)
     6. Smooth anchor scroll (offset for fixed nav)
     7. Floating WhatsApp button (show after scroll)
   ================================================================ */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  /* ============================================================
       1. NAV — glass effect on scroll
       ============================================================ */
  const nav = document.getElementById("nav");

  function syncNav() {
    nav.classList.toggle("scrolled", window.scrollY > 50);
  }

  window.addEventListener("scroll", syncNav, {
    passive: true,
  });
  syncNav(); // run once on load

  /* ============================================================
       2. MOBILE DRAWER
       ============================================================ */
  const burger = document.getElementById("navBurger");
  const drawer = document.getElementById("drawer");
  const drawerClose = document.getElementById("drawerClose");
  const drawerLinks = document.querySelectorAll(".drawer-link");

  function openDrawer() {
    drawer.classList.add("open");
    document.body.style.overflow = "hidden"; // prevent bg scroll
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    document.body.style.overflow = "";
  }

  burger?.addEventListener("click", openDrawer);
  drawerClose?.addEventListener("click", closeDrawer);

  // Close when any link is tapped
  drawerLinks.forEach((link) => link.addEventListener("click", closeDrawer));

  // Close on backdrop tap (outside drawer content)
  drawer?.addEventListener("click", (e) => {
    if (e.target === drawer) closeDrawer();
  });

  /* ============================================================
       3. SCROLL REVEAL
       Adds .visible to each .reveal element when it enters view.
       Siblings stagger by 70ms each.
       ============================================================ */
  const revealEls = document.querySelectorAll(".reveal");

  const revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const parent = el.parentElement;
        const siblings = Array.from(parent.querySelectorAll(".reveal"));
        const index = siblings.indexOf(el);

        el.style.transitionDelay = `${index * 70}ms`;
        el.classList.add("visible");
        revealObs.unobserve(el);
      });
    },
    {
      threshold: 0.12,
    },
  );

  revealEls.forEach((el) => revealObs.observe(el));

  /* ============================================================
       4. BEFORE / AFTER SLIDER
       - Works with mouse drag and touch drag
       - touch-action: none on the element (set in CSS) prevents
         the page from scrolling while the user drags the handle
       - Labels fade when the divider moves away from centre
       ============================================================ */

  function initBASlider(sliderId, handleId, lblBeforeId, lblAfterId) {
    const slider = document.getElementById(sliderId);
    const handle = document.getElementById(handleId);
    const knob = handle?.querySelector(".ba-knob"); // drag target — knob only
    const lblBefore = lblBeforeId ? document.getElementById(lblBeforeId) : null;
    const lblAfter = lblAfterId ? document.getElementById(lblAfterId) : null;
    const after = slider?.querySelector(".ba-after");

    if (!slider || !handle || !after || !knob) return;

    // Slider body: allow normal vertical page scroll (pan-y).
    // Only the knob will intercept touch for dragging.
    slider.style.touchAction = "pan-y";
    knob.style.touchAction = "none"; // knob owns horizontal drag
    knob.style.cursor = "col-resize";
    knob.style.pointerEvents = "auto"; // override handle's pointer-events:none

    let isDragging = false;

    function setPosition(pct) {
      pct = Math.min(97, Math.max(3, pct));
      after.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      handle.style.left = `${pct}%`;
      if (lblBefore) lblBefore.style.opacity = Math.min(1, (pct - 5) / 20);
      if (lblAfter) lblAfter.style.opacity = Math.min(1, (95 - pct) / 20);
    }

    function clientXtoPct(clientX) {
      const rect = slider.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * 100;
    }

    // ── Mouse — knob only ─────────────────────────────────
    knob.addEventListener("mousedown", (e) => {
      isDragging = true;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (isDragging) setPosition(clientXtoPct(e.clientX));
    });
    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // ── Touch — knob only ─────────────────────────────────
    knob.addEventListener(
      "touchstart",
      () => {
        isDragging = true;
      },
      {
        passive: true,
      },
    );

    // passive:false on window so we can preventDefault to block
    // page scroll only while the user is actively dragging the knob
    window.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging) return;
        e.preventDefault();
        setPosition(clientXtoPct(e.touches[0].clientX));
      },
      {
        passive: false,
      },
    );

    window.addEventListener("touchend", () => {
      isDragging = false;
    });
    window.addEventListener("touchcancel", () => {
      isDragging = false;
    });

    setPosition(50);
  }

  initBASlider("baSlider1", "baHandle1", "lblBefore1", "lblAfter1");
  initBASlider("baSlider2", "baHandle2", "lblBefore2", "lblAfter2");

  /* ============================================================
       5. BEFORE / AFTER TAB SWITCHER
       ============================================================ */
  const baTabs = document.querySelectorAll(".ba-tab");
  const baPanels = document.querySelectorAll(".ba-panel");

  baTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      baTabs.forEach((t) => t.classList.remove("active"));
      baPanels.forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      const targetId = `ba-${tab.dataset.tab}`;
      document.getElementById(targetId)?.classList.add("active");
    });
  });

  /* ============================================================
       6. REVIEWS CAROUSEL
       Architecture:
         - .rv-viewport clips the visible area
         - .rv-track is a flex row positioned by CSS translateX
           via a CSS custom property --offset
         - No auto-scroll — only arrows + swipe
         - Infinite loop: we clamp with modulo
         - Active card gets .is-active (full opacity + scale)
         - Touch swipe with velocity-based snap

       CSS required (already in style.css):
         .rv-track { transition: transform .38s ease-out; }
         .rv-card  { opacity: .65; transform: scale(.97); transition: ... }
         .rv-card.is-active { opacity: 1; transform: scale(1); }
       ============================================================ */
  const viewport = document.getElementById("rvViewport");
  const track = document.getElementById("rvTrack");
  const prevBtn = document.getElementById("rvPrev");
  const nextBtn = document.getElementById("rvNext");
  const dotsBox = document.getElementById("rvDots");

  if (track && viewport) {
    const cards = Array.from(track.querySelectorAll(".rv-card"));
    const count = cards.length;
    let current = 0; // active card index (0-based)
    let dots = [];

    // ── Build pagination dots ──────────────────────────────
    if (dotsBox) {
      cards.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className = "rv-dot";
        dot.setAttribute("aria-label", `Go to review ${i + 1}`);
        dot.addEventListener("click", () => goTo(i));
        dotsBox.appendChild(dot);
      });
      dots = Array.from(dotsBox.querySelectorAll(".rv-dot"));
    }

    // ── Core: position track and update active states ──────
    function applyPosition(animated = true) {
      // Card width + gap (gap is 1rem = 16px from CSS)
      const cardW = cards[0].offsetWidth;
      const gap = parseFloat(getComputedStyle(track).gap) || 16;

      // Peek offset: centre the active card in the viewport
      const viewW = viewport.offsetWidth;
      // How far left to move the track so card[current] centres
      // track has padding-left = var(--pad-x), so account for that
      const padX = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const offset = padX + current * (cardW + gap) - (viewW - cardW) / 2;

      // Apply via transform (GPU composited, no layout thrash)
      track.style.transition = animated
        ? "transform .38s cubic-bezier(.16,1,.3,1)"
        : "none";
      track.style.transform = `translateX(${-Math.max(0, offset)}px)`;

      // Update active card
      cards.forEach((c, i) => c.classList.toggle("is-active", i === current));

      // Update dots
      dots.forEach((d, i) => d.classList.toggle("active", i === current));
    }

    // ── Navigate to a card index (with infinite wrap) ──────
    function goTo(idx) {
      current = ((idx % count) + count) % count; // modulo, always positive
      applyPosition(true);
    }

    // ── Arrow buttons ──────────────────────────────────────
    prevBtn?.addEventListener("click", () => goTo(current - 1));
    nextBtn?.addEventListener("click", () => goTo(current + 1));

    // ── Touch swipe ────────────────────────────────────────
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartT = 0;
    let isSwiping = false; // horizontal swipe in progress
    let swipeDecided = false; // have we locked horizontal or vertical?

    viewport.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartT = Date.now();
        isSwiping = false;
        swipeDecided = false;
      },
      {
        passive: true,
      },
    );

    viewport.addEventListener(
      "touchmove",
      (e) => {
        if (!swipeDecided) {
          const dx = Math.abs(e.touches[0].clientX - touchStartX);
          const dy = Math.abs(e.touches[0].clientY - touchStartY);
          swipeDecided = true;
          isSwiping = dx > dy; // horizontal wins
        }
        // If we're in a horizontal swipe, block vertical scroll
        if (isSwiping) e.preventDefault();
      },
      {
        passive: false,
      },
    ); // passive: false to allow preventDefault

    viewport.addEventListener(
      "touchend",
      (e) => {
        if (!isSwiping) return;

        const dx = e.changedTouches[0].clientX - touchStartX;
        const dt = Date.now() - touchStartT;
        const velocity = Math.abs(dx) / dt; // px/ms

        // Snap if moved more than 40px OR fast flick (>0.3 px/ms)
        if (Math.abs(dx) > 40 || velocity > 0.3) {
          goTo(dx < 0 ? current + 1 : current - 1);
        } else {
          // Not enough movement — snap back
          applyPosition(true);
        }

        isSwiping = false;
      },
      {
        passive: true,
      },
    );

    // ── Recalculate on resize ──────────────────────────────
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => applyPosition(false), 120);
    });

    // ── Init ──────────────────────────────────────────────
    // Wait one frame to ensure card widths are painted
    requestAnimationFrame(() => applyPosition(false));
  }

  /* ============================================================
       7. SMOOTH ANCHOR SCROLL
       Offsets for the fixed nav bar height.
       ============================================================ */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (href === "#") return; // skip logo link to top

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      // Read --nav-h from CSS (adapts if breakpoints change it)
      const navH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--nav-h",
          ),
        ) || 60;

      const top = target.getBoundingClientRect().top + window.scrollY - navH;

      window.scrollTo({
        top,
        behavior: "smooth",
      });
    });
  });

  /* ============================================================
       8. FLOATING WHATSAPP BUTTON
       Appears after user scrolls 400px down.
       ============================================================ */
  const floatWa = document.getElementById("floatWa");

  if (floatWa) {
    function syncFloatWa() {
      floatWa.classList.toggle("show", window.scrollY > 400);
    }
    window.addEventListener("scroll", syncFloatWa, {
      passive: true,
    });
    syncFloatWa();
  }
}); // end DOMContentLoaded
