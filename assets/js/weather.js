/* 天气页：Open-Meteo（无需 Key）· 10 分钟缓存 · 城市记忆 · 骨架屏 · 错误兜底 */
(() => {
  'use strict';
  const app = document.getElementById('weather-app');
  if (!app) return;

  const form = document.getElementById('weather-form');
  const input = document.getElementById('weather-city');
  const statusEl = document.getElementById('weather-status');
  const CACHE_TTL = 10 * 60 * 1000;
  const DEFAULT_CITY = { name: '深圳', admin: '广东', lat: 22.5431, lon: 114.0579 };

  const WMO = {
    0: ['晴', '☀'], 1: ['大部晴朗', '☀'], 2: ['多云', '⛅'], 3: ['阴', '☁'],
    45: ['雾', '≈'], 48: ['雾凇', '≈'],
    51: ['毛毛雨', '☂'], 53: ['毛毛雨', '☂'], 55: ['毛毛雨', '☂'],
    56: ['冻雨', '☂'], 57: ['冻雨', '☂'],
    61: ['小雨', '☂'], 63: ['中雨', '☂'], 65: ['大雨', '☂'],
    66: ['冻雨', '☂'], 67: ['冻雨', '☂'],
    71: ['小雪', '❄'], 73: ['中雪', '❄'], 75: ['大雪', '❄'], 77: ['米雪', '❄'],
    80: ['阵雨', '☂'], 81: ['阵雨', '☂'], 82: ['强阵雨', '☂'],
    85: ['阵雪', '❄'], 86: ['阵雪', '❄'],
    95: ['雷阵雨', '⚡'], 96: ['雷暴伴冰雹', '⚡'], 99: ['雷暴伴冰雹', '⚡']
  };
  const describe = code => WMO[code] || ['未知', '·'];

  const cacheKey = (lat, lon) => `wx:v1:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const readCache = (lat, lon) => {
    try {
      const raw = localStorage.getItem(cacheKey(lat, lon));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.t > CACHE_TTL) return null;
      return obj.d;
    } catch (_) { return null; }
  };
  const writeCache = (lat, lon, data) => {
    try { localStorage.setItem(cacheKey(lat, lon), JSON.stringify({ t: Date.now(), d: data })); } catch (_) {}
  };
  const readStale = (lat, lon) => {
    try {
      const raw = localStorage.getItem(cacheKey(lat, lon));
      return raw ? JSON.parse(raw).d : null;
    } catch (_) { return null; }
  };
  const readCity = () => {
    try {
      const raw = localStorage.getItem('wx:city');
      if (raw) { const c = JSON.parse(raw); if (c && c.lat) return c; }
    } catch (_) {}
    return DEFAULT_CITY;
  };
  const saveCity = city => { try { localStorage.setItem('wx:city', JSON.stringify(city)); } catch (_) {} };

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
    app.innerHTML = `<div class="weather-error" role="alert">${msg}${retry ? ' <button type="button" id="wx-retry">重试</button>' : ''}</div>`;
    const btn = document.getElementById('wx-retry');
    if (btn) btn.addEventListener('click', retry);
    if (statusEl) statusEl.textContent = '请求失败 · 数据源 Open-Meteo';
  };

  const weekday = iso => {
    const d = new Date(iso + 'T00:00:00');
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  };

  const render = (city, data) => {
    const cur = data.current;
    const [desc, icon] = describe(cur.weather_code);
    const days = data.daily.time.map((t, i) => ({
      t,
      max: Math.round(data.daily.temperature_2m_max[i]),
      min: Math.round(data.daily.temperature_2m_min[i]),
      code: data.daily.weather_code[i]
    }));
    app.innerHTML = `
      <div class="weather-now">
        <div class="weather-head">
          <div>
            <div class="weather-city">${city.name}${city.admin ? ' · ' + city.admin : ''} <span aria-hidden="true">·</span> ${icon}</div>
            <div class="weather-temp">${Math.round(cur.temperature_2m)}<small>°C</small></div>
            <div class="weather-desc">${desc} · 体感 ${Math.round(cur.apparent_temperature)}°C</div>
          </div>
          <div class="mono" style="text-align:right">${data.timezone_abbreviation || ''}<br>更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="weather-facts">
          <div>湿度 <b>${cur.relative_humidity_2m}%</b></div>
          <div>风速 <b>${Math.round(cur.wind_speed_10m)} km/h</b></div>
          <div>降水 <b>${cur.precipitation ?? 0} mm</b></div>
        </div>
      </div>
      <div class="forecast" role="list" aria-label="未来七天">
        ${days.map(d => {
          const [dd, di] = describe(d.code);
          return `<div role="listitem" title="${dd}"><div class="d">${weekday(d.t)}</div><div class="t">${d.max}° <small>/ ${d.min}°</small></div><div class="ic" aria-hidden="true">${di}</div></div>`;
        }).join('')}
      </div>`;
    if (statusEl) statusEl.textContent = '数据来自 Open-Meteo · 无 Key · 不追踪';
  };

  let busy = false;
  const load = async (city, force) => {
    if (busy) return;
    busy = true;
    if (form) form.querySelector('button').disabled = true;
    skeleton();
    try {
      let data = force ? null : readCache(city.lat, city.lon);
      if (!data) {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
          '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m' +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7';
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(res.status === 429 ? '请求太频繁，请稍后再试' : '天气服务暂时不可用');
        data = await res.json();
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
      if (form) form.querySelector('button').disabled = false;
    }
  };

  const geocode = async name => {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) + '&count=5&language=zh&format=json';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
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
      if (!name) return;
      if (busy) return;
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
