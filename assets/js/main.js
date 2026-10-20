/* F-Grze の光影日志 — 无依赖脚本 (~4KB gzip) */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. 顶部导航：滚动隐藏 / 状态切换 ---------- */
  const head = $('.site-head');
  if (head) {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY;
      head.classList.toggle('is-scrolled', y > 8);
      if (!document.body.classList.contains('menu-open') && !head.contains(document.activeElement)) {
        head.classList.toggle('is-hidden', y > lastY && y > 220);
      }
      lastY = y;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
  }

  /* ---------- 2. 移动端菜单 ---------- */
  const menuBtn = $('#menu-btn');
  const menu = $('#mobile-menu');
  const closeMenu = (restore = false) => {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.removeAttribute('data-open');
    document.body.classList.remove('menu-open');
    if (restore) menuBtn.focus();
  };
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.toggleAttribute('data-open', open);
      document.body.classList.toggle('menu-open', open);
      if (open) $('a', menu).focus();
    });
    $$('a', menu).forEach(a => a.addEventListener('click', () => closeMenu()));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(true); });
  }

  /* ---------- 3. 主题切换（记忆 + 跟随系统） ---------- */
  const themeBtn = $('#theme-toggle');
  const root = document.documentElement;
  const syncThemeBtn = () => {
    if (!themeBtn) return;
    const dark = root.dataset.theme === 'dark';
    themeBtn.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
    themeBtn.setAttribute('title', dark ? '浅色模式' : '深色模式');
    $('svg.sun', themeBtn).style.display = dark ? 'block' : 'none';
    $('svg.moon', themeBtn).style.display = dark ? 'none' : 'block';
  };
  if (themeBtn) {
    syncThemeBtn();
    themeBtn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (_) {}
      syncThemeBtn();
    });
  }

  /* ---------- 4. 时区 / 时段 ---------- */
  const SLOTS = [
    { from: 6, name: 'dawn', label: '破晓', desc: '日出前的柔光', swatch: '#fbf1da' },
    { from: 9, name: 'morning', label: '上午', desc: '清浅天光', swatch: '#dceafa' },
    { from: 12, name: 'noon', label: '正午', desc: '最亮的一段白', swatch: '#fff7c2' },
    { from: 15, name: 'afternoon', label: '午后', desc: '藕粉色的斜光', swatch: '#f2dce8' },
    { from: 18, name: 'sunset', label: '黄昏', desc: '橘橙晚霞', swatch: '#f9c8a8' },
    { from: 21, name: 'night', label: '夜色', desc: '藏蓝与灯', swatch: '#0d1b2a' }
  ];
  const slotOf = h => {
    if (h >= 21 || h < 6) return SLOTS[5];
    if (h >= 18) return SLOTS[4];
    if (h >= 15) return SLOTS[3];
    if (h >= 12) return SLOTS[2];
    if (h >= 9) return SLOTS[1];
    return SLOTS[0];
  };

  const clockEls = $$('[data-clock]');
  const uptimeEl = $('[data-uptime]');
  const slotEls = $$('[data-slot-label]');
  const slotDescEl = $('[data-slot-desc]');
  const swatchEl = $('[data-slot-swatch]');
  const timeLocalEl = $('[data-slot-time]');
  const BUILD = Date.UTC(2026, 2, 23); // 2026-03-23 站点上线

  const tick = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    clockEls.forEach(el => { el.textContent = el.dataset.clock === 'short' ? `${hh}:${mm}` : `${hh}:${mm}:${ss}`; });

    const slot = slotOf(now.getHours());
    root.dataset.slot = slot.name;
    slotEls.forEach(el => { el.textContent = slot.label; });
    if (timeLocalEl) timeLocalEl.textContent = `LOCAL · ${hh}:${mm}`;
    if (swatchEl) swatchEl.style.backgroundColor = slot.swatch;
    if (slotDescEl) slotDescEl.textContent = slot.desc;

    if (uptimeEl) {
      const days = Math.max(0, Math.floor((Date.now() - BUILD) / 864e5));
      uptimeEl.textContent = `${days} 天`;
    }
  };
  tick();
  setInterval(tick, 1000 * 30); // 30s 足够，减少主线程唤醒

  /* ---------- 5. 滚动入场 ---------- */
  const reveals = $$('.reveal');
  if (reveals.length) {
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      reveals.forEach(el => el.classList.add('is-in'));
    } else {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
      reveals.forEach(el => io.observe(el));
    }
  }

  /* ---------- 6. 当前区块高亮 ---------- */
  const navLinks = $$('.nav a[href^="#"]');
  const sections = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
  if (sections.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(a => a.removeAttribute('aria-current'));
        const link = navLinks.find(a => a.getAttribute('href') === `#${entry.target.id}`);
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  /* ---------- 7. 文章轮播 ---------- */
  const feature = $('[data-carousel]');
  if (feature) {
    const slides = $$('.feature-slide', feature);
    const dots = $$('.feature-dots button', feature);
    const titleEl = $('[data-slide-title]', feature);
    const descEl = $('[data-slide-desc]', feature);
    const dateEl = $('[data-slide-date]', feature);
    const linkEl = $('[data-slide-link]', feature);
    let index = 0;
    let timer = null;

    const show = i => {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, n) => s.classList.toggle('is-active', n === index));
      dots.forEach((d, n) => {
        if (n === index) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      const slide = slides[index];
      if (titleEl) titleEl.textContent = slide.dataset.title;
      if (descEl) descEl.textContent = slide.dataset.desc;
      if (dateEl) dateEl.textContent = slide.dataset.date;
      if (linkEl) { linkEl.href = slide.dataset.href; linkEl.setAttribute('aria-label', `阅读：${slide.dataset.title}`); }
    };
    const play = () => {
      if (reduceMotion.matches || slides.length < 2) return;
      stop();
      timer = setInterval(() => show(index + 1), 6500);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    dots.forEach((d, n) => d.addEventListener('click', () => { show(n); play(); }));
    feature.addEventListener('mouseenter', stop);
    feature.addEventListener('mouseleave', play);
    feature.addEventListener('focusin', stop);
    feature.addEventListener('focusout', play);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : play());
    show(0);
    play();
  }

  /* ---------- 8. 图片灯箱（支持左右翻图） ---------- */
  const lb = $('#lightbox');
  if (lb) {
    const lbImg = $('img', lb);
    const lbCap = $('figcaption', lb);
    const triggers = $$('[data-lightbox]');
    let index = 0;
    let opener = null;

    // 补齐控件（左右箭头 + 计数）
    if (!$('.lightbox-nav', lb)) {
      const nav = document.createElement('div');
      nav.className = 'lightbox-nav';
      nav.innerHTML = '<button type="button" class="lightbox-arrow" data-dir="-1" aria-label="上一张">←</button>' +
        '<span class="lightbox-count" aria-live="polite"></span>' +
        '<button type="button" class="lightbox-arrow" data-dir="1" aria-label="下一张">→</button>';
      lb.appendChild(nav);
    }
    const counter = $('.lightbox-count', lb);

    const render = i => {
      index = (i + triggers.length) % triggers.length;
      const btn = triggers[index];
      lbImg.src = btn.dataset.full;
      lbImg.alt = btn.dataset.alt || '';
      lbImg.width = btn.dataset.w || 1376;
      lbImg.height = btn.dataset.h || 768;
      lbCap.textContent = btn.dataset.caption || '';
      if (counter) counter.textContent = `${index + 1} / ${triggers.length}`;
      const multi = triggers.length > 1;
      $$('.lightbox-arrow', lb).forEach(a => { a.hidden = !multi; });
    };
    const open = (btn, i) => {
      opener = btn;
      render(i);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.lightbox-close', lb).focus();
    };
    const close = () => {
      lb.hidden = true;
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };

    triggers.forEach((btn, i) => btn.addEventListener('click', () => open(btn, i)));
    $('.lightbox-close', lb).addEventListener('click', close);
    lb.addEventListener('click', e => {
      const arrow = e.target.closest('.lightbox-arrow');
      if (arrow) { render(index + Number(arrow.dataset.dir)); return; }
      if (e.target === lb) close();
    });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') render(index - 1);
      else if (e.key === 'ArrowRight') render(index + 1);
    });
  }

  /* ---------- 8b. 阅读进度 + 自动目录 ---------- */
  const body = $('.article-body');
  if (body) {
    const bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let ticking = false;
    const paint = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = `scaleX(${p})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    paint();

    const heads = $$('h2, h3', body).filter(h => h.textContent.trim());
    if (heads.length >= 2) {
      const toc = document.createElement('nav');
      toc.className = 'toc';
      toc.setAttribute('aria-label', '文章目录');
      toc.innerHTML = '<span class="toc-label">// CONTENTS</span>';
      heads.forEach((h, i) => {
        if (!h.id) h.id = `sec-${i + 1}`;
        const a = document.createElement('a');
        a.href = `#${h.id}`;
        a.textContent = h.textContent.trim();
        a.className = h.tagName === 'H3' ? 'lv3' : '';
        toc.appendChild(a);
      });
      document.body.appendChild(toc);

      if ('IntersectionObserver' in window) {
        const links = $$('a', toc);
        const spy = new IntersectionObserver(entries => {
          entries.forEach(en => {
            if (!en.isIntersecting) return;
            links.forEach(l => l.classList.toggle('is-current', l.getAttribute('href') === `#${en.target.id}`));
          });
        }, { rootMargin: '-20% 0px -70% 0px' });
        heads.forEach(h => spy.observe(h));
      }
    }
  }

  /* ---------- 8c. 代码块复制 ---------- */
  $$('.article-body pre').forEach(pre => {
    pre.parentElement.classList.add('code-block');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'COPY';
    btn.setAttribute('aria-label', '复制代码');
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      try {
        await navigator.clipboard.writeText((code || pre).innerText);
        btn.textContent = 'COPIED';
        btn.setAttribute('data-copied', '');
        setTimeout(() => { btn.textContent = 'COPY'; btn.removeAttribute('data-copied'); }, 1600);
      } catch (_) {}
    });
    pre.parentElement.appendChild(btn);
  });

  /* ---------- 8d. 标签筛选 ---------- */
  const filter = $('.tag-filter');
  if (filter) {
    const items = $$('.archive-item');
    const buttons = $$('button', filter);
    const apply = tag => {
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tag === tag)));
      let shown = 0;
      items.forEach(it => {
        const tags = (it.dataset.tags || '').split(/\s+/);
        const ok = !tag || tag === 'all' || tags.includes(tag);
        it.hidden = !ok;
        if (ok) shown++;
      });
      const count = $('#tag-count');
      if (count) count.textContent = shown;
    };
    buttons.forEach(b => b.addEventListener('click', () => {
      const tag = b.dataset.tag;
      apply(tag);
      const url = new URL(location.href);
      if (tag === 'all') url.searchParams.delete('tag');
      else url.searchParams.set('tag', tag);
      history.replaceState(null, '', url);
    }));
    apply(new URL(location.href).searchParams.get('tag') || 'all');
  }

  /* ---------- 8e. 站内搜索 ---------- */
  const modal = $('#search');
  if (modal) {
    const input = $('#search-input');
    const list = $('#search-results');
    const base = document.body.dataset.base || '';
    let index = null;
    let results = [];
    let active = -1;
    let loaded = false;

    const openSearch = async () => {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      input.value = '';
      list.innerHTML = '<li><p class="search-empty">正在读取索引…</p></li>';
      input.focus();
      if (!loaded) {
        try {
          const res = await fetch(`${base}search.json`);
          index = await res.json();
          loaded = true;
        } catch (_) {
          list.innerHTML = '<li><p class="search-empty">索引读取失败，可以直接去 <a href="' + base + 'timeline.html">归档</a> 翻。</p></li>';
          return;
        }
      }
      search('');
    };
    const closeSearch = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      const btn = $('#search-open');
      if (btn) btn.focus();
    };
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const mark = (text, q) => {
      const safe = esc(text);
      if (!q) return safe;
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return safe;
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
    };
    const search = q => {
      const query = q.trim().toLowerCase();
      results = (!index ? [] : index.filter(it => {
        if (!query) return true;
        return (it.title + ' ' + it.desc + ' ' + it.tags + ' ' + it.text).toLowerCase().includes(query);
      }).sort((a, b) => {
        if (!query) return a.order - b.order;
        const at = a.title.toLowerCase().includes(query) ? 0 : 1;
        const bt = b.title.toLowerCase().includes(query) ? 0 : 1;
        return at - bt || a.order - b.order;
      })).slice(0, 8);
      active = results.length ? 0 : -1;
      renderResults(query);
    };
    const renderResults = query => {
      if (!results.length) {
        list.innerHTML = `<li><p class="search-empty">没有匹配「${esc(query)}」的内容。</p></li>`;
        return;
      }
      list.innerHTML = results.map((it, i) =>
        `<li><a href="${base}${it.url}" class="search-result${i === 0 ? ' is-active' : ''}" data-i="${i}">
           <div class="r-title">${mark(it.title, query)}</div>
           <div class="r-meta">${esc(it.meta)}</div>
         </a></li>`).join('');
      list.querySelectorAll('a').forEach(a => a.addEventListener('mousemove', () => setActive(Number(a.dataset.i))));
    };
    const setActive = i => {
      const links = $$('a.search-result', list);
      if (!links.length) return;
      active = (i + links.length) % links.length;
      links.forEach((l, n) => l.classList.toggle('is-active', n === active));
      links[active].scrollIntoView({ block: 'nearest' });
    };

    const openBtn = $('#search-open');
    if (openBtn) openBtn.addEventListener('click', openSearch);
    $('#search-close').addEventListener('click', closeSearch);
    modal.addEventListener('click', e => { if (e.target === modal) closeSearch(); });
    input.addEventListener('input', e => search(e.target.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); $$('a.search-result', list)[active].click(); }
      else if (e.key === 'Escape') closeSearch();
    });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.hidden ? openSearch() : closeSearch(); }
    });
  }

  /* ---------- 9. 复制联系方式 ---------- */
  $$('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        btn.setAttribute('data-copied', 'true');
        btn.setAttribute('aria-label', '已复制');
        setTimeout(() => { btn.removeAttribute('data-copied'); btn.setAttribute('aria-label', `复制 ${text}`); }, 1600);
      } catch (_) {}
    });
  });
})();
