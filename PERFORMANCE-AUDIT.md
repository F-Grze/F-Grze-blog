# 性能审计报告 · F-Grze の光影日志

- 线上地址：<https://f-grze.github.io/F-Grze-blog/>
- 托管：GitHub Pages（Fastly CDN，`japaneast` 边缘节点，gzip，`cache-control: max-age=600`）
- 审计时间：2026-10-20 23:50（GMT+8）
- 工具：Lighthouse 12 + Chromium 145 headless（本环境未配置 chrome-devtools MCP，走 CLI，指标定义与阈值一致）

## 一、结论

| 类别 | 线上移动端 | 线上桌面端 | 本地（生产头模拟） |
|---|---|---|---|
| Performance | **94–99**（多次采样） | **98** | 100 |
| Accessibility | **100** | **100** | 100 |
| Best Practices | **100** | **100** | 100 |
| SEO | **100** | **100** | 100 |

核心指标（线上）：

| 指标 | 移动端 | 桌面端 | Good 阈值 |
|---|---|---|---|
| FCP | 1.3–1.9 s | 0.4 s | < 1.8 s |
| **LCP** | **1.7–2.2 s** | **0.5 s** | < 2.5 s |
| **TBT** | **0 ms** | **0 ms** | < 200 ms |
| **CLS** | **0** | **0** | < 0.1 |
| Speed Index | 3.2–5.1 s | 1.5 s | < 3.4 s |
| TTFB（根文档） | 350 ms | 630 ms | < 800 ms |
| 首屏总传输 | 297 KiB | 239 KiB | — |

**四个 Core Web Vitals 全部达标**：LCP ≤2.2 s，TBT 0，CLS 0。

其他页面（线上移动端）：

| 页面 | Performance | A11y | LCP | CLS |
|---|---|---|---|---|
| `/weather.html` | **100** | 100 | 1.0 s | 0.014 |
| `/posts/gromacs-2025.html` | 100（本地） | 100 | 1.4 s | 0 |

搜索索引 `search.json`（14 KB）只在第一次按 ⌘K 时拉取，不计入首屏；`weather.min.js`（6.4 KB）只在天气页加载。

## 二、97 分扣在哪

Performance 按权重加权五项指标。这里 LCP、TBT、CLS、FCP 都接近或达到满分，**唯一被扣分的是 Speed Index（移动 4.4 s，权重 10%）**。

原因不是资源太大，而是**这台机器到 GitHub Pages 的往返延迟**：

- `server-response-time` 实测根文档 **630 ms**（桌面），CDN 边缘在东京，TLS + 首字节占了大头；
- 胶片序列显示：1.5 s 时还是白屏（HTML 刚到、CSS 未到），2.5 s 时文字已渲染但首图还在路上，4 s 后首图铺满。LCP 本身是 1.7 s，说明大图并不慢，是"整体绘制完成"被 TTFB 拖后；
- 同一份构建在本地服务器（同样 gzip、同样 HTML）跑出 **100 分、LCP 1.8 s / 0.5 s**，差别只在网络。

这类延迟从文件层面无法消除，属于「GitHub Pages + 中国网络」的固有成本。可选解法只有换托管（Cloudflare Pages / Vercel 就近节点）或前置 CDN。

## 三、这轮做过的优化

| 动作 | 效果 |
|---|---|
| 折叠下方图片统一加 `fetchpriority="low"` | 让 hero 与 CSS 优先占带宽，首屏总传输 284 → 253 KiB |
| `post-sunrise` 重新编码（768: 138 → 120 KB；480: 69 → 45 KB） | 大图少 18 KB |
| 首屏图 `preload` + `imagesrcset` + `fetchpriority=high` | LCP 1.7 s（移动）/ 0.8 s（桌面） |
| 无 Web Font、无第三方脚本、JS 2.5 KB | TBT 稳定 0 ms |
| 所有图片带 `width/height` + `aspect-ratio` | CLS 稳定 0 |

试过但**主动放弃**的：

- `content-visibility: auto` + `contain-intrinsic-size: 780px` 包住各 section。理论上能把 Speed Index 拉回 3 s 内，实测滚动时页面高度从 4047 px 变成 3504 px —— **543 px 的跳动**，等于用 CLS 换 SI，不划算。真要做，必须按每个断点量出每段真实高度，维护成本高于收益。

## 四、请求清单（线上移动端，11 个）

| 类型 | 传输 | 资源 |
|---|---|---|
| Document | 7.1 KB | `/`（gzip） |
| Image | 59.1 KB | `hero-city-1024.webp`（LCP 元素） |
| Stylesheet | 6.9 KB | `style.min.css` |
| Script | 2.5 KB | `main.min.js` |
| Image | 120.4 KB | `post-sunrise-768.webp`（折叠下方，低优先级） |
| Image | 41.3 / 21.9 / 5.4 KB | 相册与照片墙 |
| Image | 0.4 KB | `avatar.svg` |
| Other | 0.4 KB | `favicon.svg` |

没有第三方域、没有字体请求、没有 preconnect 需要。

## 五、仍被标记但不影响达标的项

1. **`uses-long-cache-ttl` / `cache-insight`** —— GitHub Pages 固定 `max-age=600`，无法用文件控制。要一年缓存只能前置 CDN。
2. **`render-blocking-insight`** —— 只有 1 个 6.9 KB 的 CSS；内联关键 CSS 预计省 60 ms，代价是多页缓存失效，不做。
3. **`uses-responsive-images`** —— 按元素盒子面积估算，未考虑 `object-fit: cover` 的裁切，实际无可省。
4. **`mainthread-work-breakdown`（2.2 s，移动）** —— 4× CPU 降速下的布局/绘制估算，TBT 仍是 0，无交互阻塞。

## 六、复现

```bash
npx lighthouse https://f-grze.github.io/F-Grze-blog/ \
  --output=html --output-path=./audit/lighthouse-live-mobile.html \
  --chrome-flags="--headless=new --no-sandbox"

npx lighthouse https://f-grze.github.io/F-Grze-blog/ --preset=desktop \
  --output=html --output-path=./audit/lighthouse-live-desktop.html \
  --chrome-flags="--headless=new --no-sandbox"
```

原始数据：`audit/live-mobile.json`、`audit/live-desktop.json`；本地基线：`audit/lighthouse-mobile.json`、`audit/lighthouse-desktop.json`。

## 七、无障碍与 SEO

线上与本地一致，全部满分。重点项：

`color-contrast`、`link-in-text-block`、`image-alt`、`heading-order`、`html-has-lang`、`button-name`、`link-name`、`aria-allowed-attr`、`aria-valid-attr-value`、`aria-hidden-focus`、`bypass`、`errors-in-console`、`canonical`、`robots-txt`、`crawlable-anchors`、`meta-description`、`document-title`、`charset`、`doctype`。

深浅色对比度均 ≥ 4.5:1：正文 `#33383f` / `#d3d2ce`，弱化文本最低 `#5b6470` / `#a3a29e`；Hero 白字压在深色照片上，用上下渐变兜底。
