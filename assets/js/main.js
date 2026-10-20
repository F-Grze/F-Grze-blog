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

  /* ---------- 8. 图片灯箱 ---------- */
  const lb = $('#lightbox');
  if (lb) {
    const lbImg = $('img', lb);
    const lbCap = $('figcaption', lb);
    let opener = null;
    const open = btn => {
      opener = btn;
      lbImg.src = btn.dataset.full;
      lbImg.alt = btn.dataset.alt || '';
      lbImg.width = btn.dataset.w || 1376;
      lbImg.height = btn.dataset.h || 768;
      lbCap.textContent = btn.dataset.caption || '';
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.lightbox-close', lb).focus();
    };
    const close = () => {
      lb.hidden = true;
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };
    $$('[data-lightbox]').forEach(btn => btn.addEventListener('click', () => open(btn)));
    $('.lightbox-close', lb).addEventListener('click', close);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) close(); });
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
