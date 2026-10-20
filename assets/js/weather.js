/* 天气页：和风天气（首选）→ Open-Meteo（兜底）
   10 分钟缓存 · 城市记忆 · 骨架屏 · 错误回落 */
(() => {
  'use strict';
  const app = document.getElementById('weather-app');
  if (!app) return;

  const form = document.getElementById('weather-form');
  const input = document.getElementById('weather-city');
  const statusEl = document.getElementById('weather-status');
  const CACHE_TTL = 10 * 60 * 1000;
  const DEFAULT_CITY = { name: '深圳', admin: '广东', lat: 22.5431, lon: 114.0579 };

  // 和风天气：host 需填控制台「项目管理 → API Host」
  const QW = { host: 'kkb33kqfr4.re.qweatherapi.com', key: '531a3e17c40e4a84b9915faaf7e8117d' };

  const glyph = text => {
    const t = String(text || '');
    if (/雷/.test(t)) return '⚡';
    if (/雪|冰雹/.test(t)) return '❄';
    if (/雨|毛毛/.test(t)) return '☂';
    if (/雾|霾|沙|尘/.test(t)) return '≈';
    if (/阴/.test(t)) return '☁';
    if (/云/.test(t)) return '⛅';
    if (/晴/.test(t)) return '☀';
    return '·';
  };

  const cacheKey = (lat, lon) => `wx:v2:${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  const readCache = (lat, lon) => {
    try {
      const raw = localStorage.getItem(cacheKey(lat, lon));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.t > CACHE_TTL) return null;
      return obj.d;
    } catch (_) { return null; }
  };
  const readStale = (lat, lon) => {
    try {
      const raw = localStorage.getItem(cacheKey(lat, lon));
      return raw ? JSON.parse(raw).d : null;
    } catch (_) { return null; }
  };
  const writeCache = (lat, lon, data) => {
    try { localStorage.setItem(cacheKey(lat, lon), JSON.stringify({ t: Date.now(), d: data })); } catch (_) {}
  };
  const readCity = () => {
    try {
      const raw = localStorage.getItem('wx:city');
      if (raw) { const c = JSON.parse(raw); if (c && c.lat) return c; }
    } catch (_) {}
    return DEFAULT_CITY;
  };
  const saveCity = city => { try { localStorage.setItem('wx:city', JSON.stringify(city)); } catch (_) {} };

  const withTimeout = (url, opts = {}, ms = 8000) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).finally(() => clearTimeout(id));
  };

  /* ---------- 和风天气 ---------- */
  const qweather = async city => {
    if (!QW.host || !QW.key) throw new Error('no-qweather');
    const loc = city.lon + ',' + city.lat;
    const headers = { 'X-QW-Api-Key': QW.key, Accept: 'application/json' };
    const base = 'https://' + QW.host;
    const [nowRes, dayRes] = await Promise.all([
      withTimeout(base + '/v7/weather/now?location=' + loc + '&lang=zh', { headers }),
      withTimeout(base + '/v7/weather/7d?location=' + loc + '&lang=zh', { headers })
    ]);
    if (!nowRes.ok || !dayRes.ok) throw new Error('qweather-http-' + (nowRes.status || dayRes.status));
    const now = await nowRes.json();
    const days = await dayRes.json();
    if (now.code !== '200' || days.code !== '200') throw new Error('qweather-code-' + (now.code || days.code));
    return {
      temp: Number(now.now.temp),
      feels: Number(now.now.feelsLike),
      text: now.now.text,
      humidity: Number(now.now.humidity),
      wind: Number(now.now.windSpeed),
      precip: Number(now.now.precip || 0),
      days: (days.daily || []).slice(0, 7).map(d => ({
        date: d.fxDate, max: Number(d.tempMax), min: Number(d.tempMin), text: d.textDay
      })),
      tz: 'GMT+8',
      source: '和风天气'
    };
  };

  /* ---------- Open-Meteo 兜底 ---------- */
  const WMO = {
    0: '晴', 1: '晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾',
    51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '冻雨', 57: '冻雨',
    61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
    80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪',
    95: '雷阵雨', 96: '雷暴冰雹', 99: '雷暴冰雹'
  };
  const openMeteo = async city => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7';
    const res = await withTimeout(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status === 429 ? '请求太频繁，请稍后再试' : '天气服务暂时不可用');
    const d = await res.json();
    return {
      temp: Math.round(d.current.temperature_2m),
      feels: Math.round(d.current.apparent_temperature),
      text: WMO[d.current.weather_code] || '未知',
      humidity: d.current.relative_humidity_2m,
      wind: Math.round(d.current.wind_speed_10m),
      precip: d.current.precipitation == null ? 0 : d.current.precipitation,
      days: d.daily.time.map((t, i) => ({
        date: t,
        max: Math.round(d.daily.temperature_2m_max[i]),
        min: Math.round(d.daily.temperature_2m_min[i]),
        text: WMO[d.daily.weather_code[i]] || '未知'
      })),
      tz: d.timezone_abbreviation || '',
      source: 'Open-Meteo（和风未连通，已回退）'
    };
  };

  /* ---------- 渲染 ---------- */
  const skeleton = () => {
    app.innerHTML = `
      <div class="weather-now" aria-busy="true">
        <div class="skeleton" style="width:6rem;height:.7rem"></div>
        <div class="skeleton" style="width:9rem;height:3.4rem;margin-top:1rem"></div>
        <div class="skeleton" style="width:12rem;height:.9rem;margin-top:1rem"></div>
        <div class="weather-facts" style="margin-top:1.75rem">
          <div class="skeleton" style="width:4.5rem;height:2.2rem"></div>
          <div class="skeleton" style="width:4.5rem;height:2.2rem"></div>
          <div class="skeleton" style="width:4.5rem;height:2.2rem"></div>
        </div>
      </div>
      <div class="forecast" style="margin-top:1.5rem">
        ${'<div><div class="skeleton" style="height:4rem"></div></div>'.repeat(7)}
      </div>`;
  };

  const fail = (msg, retry) => {
    app.innerHTML = '<div class="weather-error" role="alert">' + msg + (retry ? ' <button type="button" id="wx-retry">重试</button>' : '') + '</div>';
    const btn = document.getElementById('wx-retry');
    if (btn) btn.addEventListener('click', retry);
    if (statusEl) statusEl.textContent = '请求失败 · 可稍后重试';
  };

  const weekday = iso => {
    const d = new Date(iso + 'T00:00:00');
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] || '';
  };

  const render = (city, d) => {
    app.innerHTML = `
      <div class="weather-now">
        <div class="weather-head">
          <div>
            <div class="weather-city">${city.name}${city.admin ? ' · ' + city.admin : ''} <span aria-hidden="true">·</span> ${glyph(d.text)}</div>
            <div class="weather-temp">${Math.round(d.temp)}<small>°C</small></div>
            <div class="weather-desc">${d.text} · 体感 ${Math.round(d.feels)}°C</div>
          </div>
          <div class="mono" style="text-align:right">${d.tz || ''}<br>更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="weather-facts">
          <div>湿度 <b>${d.humidity}%</b></div>
          <div>风速 <b>${Math.round(d.wind)} km/h</b></div>
          <div>降水 <b>${d.precip} mm</b></div>
        </div>
      </div>
      <div class="forecast" role="list" aria-label="未来七天">
        ${d.days.map(x => `<div role="listitem" title="${x.text}">
            <div class="d">${weekday(x.date)}</div>
            <div class="t">${Math.round(x.max)}° <small>/ ${Math.round(x.min)}°</small></div>
            <div class="ic" aria-hidden="true">${glyph(x.text)}</div>
          </div>`).join('')}
      </div>`;
    if (statusEl) statusEl.textContent = '数据来自 ' + d.source + ' · 无追踪 · 缓存 10 分钟';
  };

  let busy = false;
  const load = async (city, force) => {
    if (busy) return;
    busy = true;
    const submit = form && form.querySelector('button');
    if (submit) submit.disabled = true;
    skeleton();
    try {
      let data = force ? null : readCache(city.lat, city.lon);
      if (!data) {
        try {
          data = await qweather(city);
        } catch (e) {
          data = await openMeteo(city);
        }
        writeCache(city.lat, city.lon, data);
      }
      saveCity(city);
      render(city, data);
    } catch (e) {
      const stale = readStale(city.lat, city.lon);
      if (stale) {
        render(city, stale);
        if (statusEl) statusEl.textContent = '网络异常 · 显示的是上次缓存的数据';
      } else {
        fail(String(e.message || '网络异常，请检查连接'), () => load(city, true));
      }
    } finally {
      busy = false;
      if (submit) submit.disabled = false;
    }
  };

  /* ---------- 城市查询：和风 geo → Open-Meteo geocoding ---------- */
  const geocode = async name => {
    if (QW.host && QW.key) {
      try {
        const res = await withTimeout('https://' + QW.host + '/geo/v2/city/lookup?location=' + encodeURIComponent(name) + '&lang=zh',
          { headers: { 'X-QW-Api-Key': QW.key, Accept: 'application/json' } }, 6000);
        if (res.ok) {
          const d = await res.json();
          if (d.code === '200' && d.location && d.location.length) {
            const r = d.location[0];
            return { name: r.name, admin: r.adm1 || r.country || '', lat: Number(r.lat), lon: Number(r.lon) };
          }
        }
      } catch (_) {}
    }
    const res = await withTimeout('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) + '&count=5&language=zh&format=json');
    if (!res.ok) throw new Error('城市查询服务暂时不可用');
    const data = await res.json();
    if (!data.results || !data.results.length) throw new Error('没找到这个城市，换个名字试试');
    const r = data.results[0];
    return { name: r.name, admin: r.admin1 || r.country || '', lat: r.latitude, lon: r.longitude };
  };

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name || busy) return;
      busy = true;
      skeleton();
      if (statusEl) statusEl.textContent = '正在查找 ' + name + ' …';
      try {
        const city = await geocode(name);
        busy = false;
        load(city, true);
      } catch (err) {
        busy = false;
        fail(String(err.message || '查询失败'), () => form.requestSubmit());
      }
    });
  }

  load(readCity(), false);
})();
