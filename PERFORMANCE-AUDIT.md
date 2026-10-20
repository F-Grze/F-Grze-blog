# 性能审计报告 · F-Grze の光影日志

审计对象：重构后的静态站首页 `index.html`（`http://127.0.0.1:8081/`，本地静态服务器已开启 gzip 与长缓存，尽量贴近 GitHub Pages 的实际响应）。
审计时间：2026-10-20。

## 一、结论

| 类别 | 移动端 | 桌面端 |
|---|---|---|
| Performance | **100** | **100** |
| Accessibility | **100** | **100** |
| Best Practices | **100** | **100** |
| SEO | **100** | **100** |

Core Web Vitals 全部落在 "Good"：

| 指标 | 移动端 | 桌面端 | 阈值（Good） |
|---|---|---|---|
| FCP | 0.8 s | 0.2 s | < 1.8 s |
| **LCP** | **1.8 s** | **0.5 s** | < 2.5 s |
| **TBT** | **0 ms** | **0 ms** | < 200 ms |
| **CLS** | **0** | **0** | < 0.1 |
| Speed Index | 0.8 s | 0.2 s | < 3.4 s |
| Max Potential FID | 20 ms | 30 ms | — |
| 首屏总传输 | 309 KiB / 11 请求 | 276 KiB / 12 请求 | — |

单篇文章页（`/posts/gromacs-2025.html`）同样满分：LCP 1.4 s、TBT 0 ms、CLS 0、总传输 72 KiB。

## 二、方法

- **工具**：Lighthouse 12（`npx lighthouse`）+ Chromium 145 headless。本环境的 chrome-devtools MCP 未配置，因此走 Lighthouse CLI 通道；两者对 FCP/LCP/TBT/CLS 的定义与阈值一致，结论等价。
- **移动端**：Lighthouse 默认移动仿真（412×823、DPR 2.625、Slow 4G、CPU 4× 降速、simulated throttling）。
- **桌面端**：`--preset=desktop`（1350×940、无网络/CPU 降速）。
- **服务端**：`python3` 静态服务 + `Content-Encoding: gzip` + `Cache-Control`（assets `max-age=31536000, immutable`，HTML `max-age=600`）。GitHub Pages 默认会 gzip/brotli，且资产缓存是 `max-age=600`（这一点无法通过文件控制，见第四节）。
- **报告原文**：`audit/lighthouse-mobile.html`、`audit/lighthouse-desktop.html`（另附 JSON）。

复现：

```bash
cd /workspace
python3 /path/to/gzip-server.py 8081      # 任意带 gzip 的静态服务器
CHROME_PATH=/usr/bin/chromium npx lighthouse http://127.0.0.1:8081/ \
  --output=html --output-path=./audit/lighthouse-mobile.html \
  --chrome-flags="--headless=new --no-sandbox"
```

## 三、请求清单（移动端首屏，共 11 个）

| 类型 | 传输 | 资源 |
|---|---|---|
| Document | 6.8 KB | `/`（gzip 后） |
| Image | 58.9 KB | `hero-city-1024.webp`（LCP 元素，`fetchpriority=high` 预加载） |
| Stylesheet | 6.0 KB | `style.min.css`（gzip 后，压缩前 25.3 KB） |
| Script | 2.5 KB | `main.min.js`（gzip 后，压缩前 5.6 KB） |
| Image | 21.8 / 68.2 KB | `album-lamp-640/1024.webp`（相册、照片墙） |
| Image | 138.5 KB | `post-sunrise-768.webp`（海报卡，懒加载） |
| Image | 5.3 / 0.5 KB | `album-lamp-320.webp`、`avatar.svg` |
| Other | 0.4 KB | `favicon.svg` |

没有第三方域、没有字体请求、没有 preconnect 需要。

## 四、与原站对比（源码层面的事实）

原站在当前状态下**无法构建**，因此没有可信的 "优化前" 跑分，这里只列可核对的事实：

| 项 | 原站 | 现站 |
|---|---|---|
| 首屏视频 | 1 个 `<video autoplay preload="auto">`，在 4 个 mp4 之间每 12 秒切换 | 0 |
| 字体请求 | Google Fonts 4 个族（Gelasio ×2、Ubuntu Mono、Noto Serif SC） | 0（系统衬线栈） |
| JS 框架 | Next.js 16 + React 19 + framer-motion + three + ogl + tiptap | 0，交互脚本 5.6 KB |
| 图片 | 外链 `bu.dusays.com` / `images.unsplash.com`，无尺寸、无 srcset | 本地 WebP 三档 + srcset + 显式尺寸 |
| 首屏渲染阻断 | 3 个 CSS + 4 个 JS（`defer`）+ 字体 | 1 个 CSS（6 KB gzip） |
| CLS 风险 | 所有卡片用 `min-h-*` 撑高，图片无 `width/height` | 全部图片带尺寸，`aspect-ratio` 固定容器 |

## 五、仍被标记、但不扣分的项

这些都是平台特性或可接受成本，记录在此避免以后误判：

1. **`uses-responsive-images` / `image-delivery-insight`（约 147 KB "可省"）**
   Lighthouse 按元素渲染框的像素面积估算，未考虑 `object-fit: cover` 的裁切。照片墙里 768px 的竖图被裁成 350×192 展示，但窄屏 DPR 3 仍需要 900px 宽的像素，实际没有 147 KB 可省。要再压只能减少图片本身的细节（提高压缩率），会看得出糊。

2. **`render-blocking-resources`（约 60 ms）**
   渲染阻断的只有那 1 个 6 KB 的 CSS。再往下走要做"内联首屏关键 CSS"，代价是 HTML 变大、多页缓存失效，收益 < 60 ms，不做。

3. **`cache-insight` / `uses-long-cache-ttl`**
   本地已给 `assets/*` 设成一年 immutable；GitHub Pages 固定返回 `max-age=600`，无法通过文件改。真要长缓存，需要套一层 Cloudflare（或换 Netlify/Cloudflare Pages）。

4. **`network-dependency-tree-insight`**
   HTML → CSS → 图片是标准链，没有可拆的串行请求。

5. **`forced-reflow-insight`（约 40 ms，滚动时一次性）**
   来自顶栏滚动隐藏时读写 `scrollY`。已经用 `requestAnimationFrame` 合帧，属于浏览器对"上一帧写样式、下一帧读布局"的必然计量。

## 六、下次可以做的（有明确收益才做）

| 优先级 | 事项 | 预期 |
|---|---|---|
| P2 | 给 `post-sunrise-768.webp` 单独导一张 16:9 的横版裁切（800×450，约 45 KB） | 首屏再省 ~90 KB |
| P2 | 引入 Cloudflare 前置，获得 brotli + 一年缓存 | 二次访问接近 0 请求 |
| P3 | 首屏关键 CSS 内联（约 4 KB） | 60 ms |
| P3 | 用 `content-visibility: auto` 包住照片墙与页脚 | 长页滚动更稳（需配 `contain-intrinsic-size`，否则会引入 CLS） |

## 七、无障碍与 SEO 明细

以下审计项均为满分，可作为回归基线：

`color-contrast`、`link-in-text-block`、`image-alt`、`heading-order`、`html-has-lang`、`html-lang-valid`、`viewport`、`font-size`、`crawlable-anchors`、`is-crawlable`、`robots-txt`、`canonical`、`meta-description`、`document-title`、`button-name`、`link-name`、`listitem`、`aria-allowed-attr`、`aria-valid-attr-value`、`aria-hidden-focus`、`bypass`、`errors-in-console`、`third-party-cookies`、`charset`、`doctype`。

`structured-data` 在本版 Lighthouse 中为提示项（`score: null`，不计入 SEO 分数）；页面已内置 `WebSite` JSON-LD，可在 [Schema Markup Validator](https://validator.schema.org/) 复核。

深色模式与浅色模式的对比度都单独核对过：正文 `#33383f` / `#d3d2ce`，弱化文本最低 `#5b6470` / `#a3a29e`，均 ≥ 4.5:1；Hero 白字压在深色照片上，配有顶部/底部渐变兜底。
