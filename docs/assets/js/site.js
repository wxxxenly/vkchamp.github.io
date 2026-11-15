/* ==========================================================================
   VK Market Analytics 2026 — interactions
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var docEl = document.documentElement;

  function on(el, type, fn, opts) {
    if (el) el.addEventListener(type, fn, opts);
  }

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function prefersReduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- Theme ------------------------------------------------------ */

  var themeBtn = $('#themeBtn');

  function setTheme(theme, persist) {
    docEl.setAttribute('data-theme', theme);
    if (persist) store('vk-theme', theme);
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
      themeBtn.setAttribute('title', theme === 'dark' ? 'Светлая тема' : 'Тёмная тема');
    }
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#080f1c' : '#f5f8fd');
  }

  setTheme(docEl.getAttribute('data-theme') || 'light', false);

  on(themeBtn, 'click', function () {
    setTheme(docEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  });

  /* ---------- Mobile menu ------------------------------------------------ */

  var menuBtn = $('#menuBtn');
  var mobileNav = $('#mobileNav');

  function closeMenu() {
    if (!mobileNav) return;
    mobileNav.classList.remove('is-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
  }

  function toggleMenu() {
    if (!mobileNav) return;
    var open = !mobileNav.classList.contains('is-open');
    mobileNav.classList.toggle('is-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  }

  on(menuBtn, 'click', toggleMenu);
  $$('a', mobileNav).forEach(function (a) { on(a, 'click', closeMenu); });

  /* ---------- Compact mode ---------------------------------------------- */

  function setCompact(onFlag, persist) {
    document.body.classList.toggle('compact', onFlag);
    $$('[data-compact-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(onFlag));
      var label = btn.querySelector('[data-compact-label]');
      if (label) label.textContent = onFlag ? 'Показать пояснения' : 'Скрыть пояснения';
    });
    if (persist) store('vk-compact', onFlag ? '1' : '0');
  }

  if (read('vk-compact') === '1') setCompact(true, false);
  $$('[data-compact-toggle]').forEach(function (btn) {
    on(btn, 'click', function () {
      setCompact(!document.body.classList.contains('compact'), true);
    });
  });

  on($('[data-print]'), 'click', function () { window.print(); });

  /* ---------- Progress and back-to-top ---------------------------------- */

  var progress = $('#progressBar span');
  var toTop = $('#toTop');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var max = docEl.scrollHeight - window.innerHeight;
      var y = window.pageYOffset || docEl.scrollTop;
      if (progress) progress.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
      if (toTop) toTop.classList.toggle('is-visible', y > 720);
      updateSpy();
      ticking = false;
    });
  }

  on(window, 'scroll', onScroll, { passive: true });
  on(window, 'resize', onScroll, { passive: true });
  on(toTop, 'click', function () {
    window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
  });

  /* ---------- Scrollspy -------------------------------------------------- */

  var spyLinks = $$('[data-spy]');
  var spyTargets = [];
  var currentSpy = '';

  function rebuildSpy() {
    var seen = {};
    spyTargets = [];
    spyLinks.forEach(function (a) {
      var id = (a.getAttribute('href') || '').replace('#', '');
      if (!id || seen[id]) return;
      seen[id] = true;
      var el = document.getElementById(id);
      if (el) spyTargets.push(el);
    });
    spyTargets.sort(function (a, b) {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });
  }

  function updateSpy() {
    if (!spyTargets.length) return;
    var offset = (parseInt(getComputedStyle(docEl).getPropertyValue('--header-h'), 10) || 66) + 34;
    var active = spyTargets[0].id;
    for (var i = 0; i < spyTargets.length; i++) {
      if (spyTargets[i].getBoundingClientRect().top <= offset) active = spyTargets[i].id;
    }
    var atBottom = window.innerHeight + window.pageYOffset >= docEl.scrollHeight - 4;
    if (atBottom) active = spyTargets[spyTargets.length - 1].id;
    if (active === currentSpy) return;
    currentSpy = active;
    spyLinks.forEach(function (a) {
      var isActive = a.getAttribute('href') === '#' + active;
      a.classList.toggle('is-active', isActive);
      if (isActive) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }

  rebuildSpy();

  /* ---------- Lightbox --------------------------------------------------- */

  var triggers = $$('.chart-open');
  var lightbox = $('#lightbox');
  var lbImg = $('#lbImage');
  var lbTitle = $('#lbTitle');
  var lbCounter = $('#lbCounter');
  var lbLegend = $('#lbLegend');
  var lbTag = $('#lbTag');
  var lbDownload = $('#lbDownload');
  var lbClose = $('#lbClose');
  var lbPrev = $('#lbPrev');
  var lbNext = $('#lbNext');
  var lbIndex = -1;
  var lastFocus = null;

  function legendFor(cardId) {
    var card = document.getElementById(cardId);
    var legend = card ? card.querySelector('.legend') : null;
    return legend ? legend.innerHTML : '';
  }

  function tagFor(cardId) {
    var card = document.getElementById(cardId);
    var tag = card ? card.querySelector('.viz-head .tag') : null;
    if (!tag) return '';
    var span = document.createElement('span');
    span.className = tag.className;
    span.textContent = tag.textContent;
    return span.outerHTML;
  }

  function openLightbox(index) {
    if (!lightbox || !triggers.length) return;
    if (index < 0) index = triggers.length - 1;
    if (index >= triggers.length) index = 0;
    lbIndex = index;
    var a = triggers[index];
    var cardId = a.getAttribute('data-card');
    var title = a.getAttribute('data-title') || 'График';
    lbImg.src = a.getAttribute('href');
    lbImg.alt = title;
    if (lbTitle) lbTitle.textContent = title;
    if (lbCounter) lbCounter.textContent = 'График ' + (index + 1) + ' из ' + triggers.length;
    if (lbLegend) lbLegend.innerHTML = legendFor(cardId) || '<p>Пояснение к графику смотрите в разделе отчёта.</p>';
    if (lbTag) lbTag.innerHTML = tagFor(cardId);
    if (lbDownload) {
      lbDownload.href = a.getAttribute('href');
      var file = (a.getAttribute('href') || '').split('/').pop() || 'chart.png';
      lbDownload.setAttribute('download', file);
    }
    lastFocus = document.activeElement;
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
    if (lbClose) lbClose.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.classList.remove('is-locked');
    lbIndex = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  triggers.forEach(function (a, i) {
    on(a, 'click', function (ev) {
      ev.preventDefault();
      openLightbox(i);
    });
  });

  on(lbClose, 'click', closeLightbox);
  on(lbPrev, 'click', function () { openLightbox(lbIndex - 1); });
  on(lbNext, 'click', function () { openLightbox(lbIndex + 1); });
  on(lightbox, 'click', function (ev) {
    if (ev.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (ev) {
    if (!lightbox || lightbox.hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeLightbox(); }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); openLightbox(lbIndex - 1); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); openLightbox(lbIndex + 1); }
    if (ev.key === 'Tab') {
      var focusables = $$('button, a[href]', lightbox).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Search ----------------------------------------------------- */

  var searchModal = $('#searchModal');
  var searchInput = $('#searchInput');
  var searchResults = $('#searchResults');
  var searchBtn = $('#searchBtn');
  var searchIndex = [];
  var searchActive = 0;
  var searchTicking = null;

  function stripMarkup(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function buildSearchIndex() {
    $$('.viz-card').forEach(function (card) {
      var title = card.getAttribute('data-title') || '';
      var section = card.getAttribute('data-section') || '';
      var legend = card.querySelector('.legend');
      searchIndex.push({
        type: 'card',
        id: card.id,
        title: title,
        section: section,
        text: legend ? stripMarkup(legend.innerHTML) : ''
      });
    });
    $$('.report-section[id]').forEach(function (sec) {
      var h2 = sec.querySelector('.section-head h2');
      var deck = sec.querySelector('.section-deck, .section-lead');
      if (!h2) return;
      searchIndex.push({
        type: 'section',
        id: sec.id,
        title: h2.textContent.trim(),
        section: 'Раздел отчёта',
        text: deck ? stripMarkup(deck.textContent) : ''
      });
    });
    var thesis = $('.thesis-card');
    if (thesis) {
      var th = thesis.querySelector('h2');
      searchIndex.push({
        type: 'section',
        id: 'thesis',
        title: th ? th.textContent.trim() : 'Главный вывод',
        section: 'Обзор',
        text: stripMarkup(thesis.textContent).slice(0, 600)
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    var safe = escapeHtml(text);
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    terms.forEach(function (t) {
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      safe = safe.replace(re, '<mark>$1</mark>');
    });
    return safe;
  }

  function searchItems(query) {
    var q = query.trim().toLowerCase();
    if (!q) {
      return searchIndex.filter(function (x) { return x.type === 'section'; }).slice(0, 7);
    }
    var terms = q.split(/\s+/).filter(Boolean);
    var scored = [];
    searchIndex.forEach(function (item) {
      var hay = (item.title + ' ' + item.section + ' ' + item.text).toLowerCase();
      var ok = terms.every(function (t) { return hay.indexOf(t) !== -1; });
      if (!ok) return;
      var score = 0;
      var title = item.title.toLowerCase();
      terms.forEach(function (t) {
        if (title.indexOf(t) === 0) score += 12;
        else if (title.indexOf(t) !== -1) score += 7;
        if (item.section.toLowerCase().indexOf(t) !== -1) score += 2;
        if (item.text.toLowerCase().indexOf(t) !== -1) score += 1;
      });
      if (item.type === 'section') score += 1;
      scored.push({ item: item, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 12).map(function (x) { return x.item; });
  }

  function renderSearch(query) {
    if (!searchResults) return;
    var items = searchItems(query);
    searchActive = 0;
    if (!items.length) {
      searchResults.innerHTML = '<div class="search-empty">Ничего не найдено. Попробуйте «конверсия», «регионы» или «средний чек».</div>';
      return;
    }
    searchResults.innerHTML = items.map(function (item, i) {
      var snippet = item.text || '';
      var q = query.trim().toLowerCase();
      if (q && snippet) {
        var pos = snippet.toLowerCase().indexOf(q.split(/\s+/)[0]);
        if (pos > 70) snippet = '…' + snippet.slice(pos - 55);
        snippet = snippet.slice(0, 150) + (snippet.length > 150 ? '…' : '');
      }
      return '<button type="button" class="search-result' + (i === 0 ? ' is-first' : '') +
        '" data-target="' + escapeHtml(item.id) + '">' +
        '<b>' + highlight(item.title, query) + '</b>' +
        '<span>' + escapeHtml(item.section) + (snippet ? ' · ' + escapeHtml(snippet) : '') + '</span>' +
        '</button>';
    }).join('');
    $$('.search-result', searchResults).forEach(function (btn) {
      on(btn, 'click', function () { goToSearchTarget(btn.getAttribute('data-target')); });
    });
  }

  function goToSearchTarget(id) {
    closeSearch();
    var el = document.getElementById(id);
    if (!el) return;
    if (window.history && history.replaceState) history.replaceState(null, '', '#' + id);
    el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
    if (el.classList.contains('viz-card')) {
      el.classList.add('is-flashing');
      setTimeout(function () { el.classList.remove('is-flashing'); }, 1700);
    }
  }

  function openSearch() {
    if (!searchModal) return;
    searchModal.hidden = false;
    document.body.classList.add('is-locked');
    if (searchInput) {
      searchInput.value = '';
      renderSearch('');
      setTimeout(function () { searchInput.focus(); }, 20);
    }
  }

  function closeSearch() {
    if (!searchModal || searchModal.hidden) return;
    searchModal.hidden = true;
    document.body.classList.remove('is-locked');
    if (searchBtn) searchBtn.focus();
  }

  on(searchBtn, 'click', openSearch);
  on(searchModal, 'click', function (ev) { if (ev.target === searchModal) closeSearch(); });
  on(searchInput, 'input', function () {
    if (searchTicking) clearTimeout(searchTicking);
    searchTicking = setTimeout(function () { renderSearch(searchInput.value); }, 70);
  });

  document.addEventListener('keydown', function (ev) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (searchModal && !searchModal.hidden) closeSearch(); else openSearch();
      return;
    }
    if (ev.key === '/' && !typing) {
      ev.preventDefault();
      openSearch();
      return;
    }
    if (!searchModal || searchModal.hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeSearch(); }
    var results = $$('.search-result', searchResults);
    if (!results.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      searchActive = (searchActive + (ev.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      results.forEach(function (r, i) { r.classList.toggle('is-active', i === searchActive); });
      results[searchActive].focus();
    }
    if (ev.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('search-result')) {
      ev.preventDefault();
      goToSearchTarget(document.activeElement.getAttribute('data-target'));
    }
  });

  buildSearchIndex();
  renderSearch('');

  /* ---------- Reveal on scroll ------------------------------------------ */

  if ('IntersectionObserver' in window && !prefersReduced()) {
    var revealEls = $$('.viz-card, .kpi-card, .thesis-card, .compare-board');
    revealEls.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Init ------------------------------------------------------ */

  onScroll();
  window.setTimeout(onScroll, 80);
})();
