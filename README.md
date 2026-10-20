# F-Grze の光影日志 · 静态站

原站是一套 Next.js 16 App Router 项目（96 个文件）。这里是在**保留原有编辑风格（Editorial：白底、衬线斜体、mono 小标签、8pt 网格）**的前提下，重做的纯静态版本：`index.html` + 一份 CSS + 一份原生 JS，无框架、无 Web Font、无第三方请求。

- 首页：`index.html`
- 文章归档：`posts/index.html`
- 三篇正文：`posts/kinase-screening.html`、`posts/gromacs-2025.html`、`chatters/originium.html`
- 404：`404.html`
- 性能审计：`PERFORMANCE-AUDIT.md` + `audit/`

## 本地预览

```bash
cd /workspace
python3 -m http.server 8080        # 或任意静态服务器
# 打开 http://127.0.0.1:8080/
```

> 直接双击 `index.html` 也能看，但 `file://` 下 `fetch`/剪贴板等 API 会受限。

## 部署到 GitHub Pages

目标地址：**`https://f-grze.github.io/F-Grze-blog/`**

> 仓库名不能用中文 —— GitHub 规定仓库名只能包含 ASCII 字母、数字和 `.` `-` `_`（[官方文档](https://docs.github.com/zh/repositories/creating-and-managing-repositories/creating-a-new-repository)）。所以仓库用 `F-Grze-blog`，仓库描述写「个人博客」。

```bash
cd /workspace
git init -b main
git add -A
git commit -m "init: F-Grze 个人博客（静态重构版）"
git remote add origin https://github.com/F-Grze/F-Grze-blog.git
git push -u origin main
```

推送后在仓库里设置：**Settings → Pages → Build and deployment**
- Source: `Deploy from a branch`
- Branch: `main` / `/ (root)` → Save

约 1 分钟生效。`.nojekyll` 已就位，避免 Jekyll 忽略下划线开头的文件。全站已经按 `https://f-grze.github.io/F-Grze-blog/` 配好 canonical / og:url / sitemap / robots / 404 链接，**不用再改任何地址**。

### 如果之后换仓库名

```bash
cd /workspace
grep -rl "f-grze.github.io/F-Grze-blog" . --include="*.html" --include="*.xml" --include="*.txt" \
  | xargs sed -i 's#https://f-grze.github.io/F-Grze-blog#https://f-grze.github.io/新名字#g'
sed -i 's#/F-Grze-blog/#/新名字/#g' 404.html
```

### 自定义域名（可选）

放一个 `CNAME` 文件（内容为裸域名），DNS 加 `CNAME → f-grze.github.io`，再在 Pages 里勾选 Enforce HTTPS。此时还要把上面的 `f-grze.github.io/F-Grze-blog` 一并换成域名。

## 目录结构

```
/
├── index.html                 首页（hero / 01 自我 / 02 内容 / 03 摄影 / 04 状态）
├── 404.html                   自带样式的 404（不依赖外部资源）
├── posts/
│   ├── index.html             归档
│   ├── gromacs-2025.html
│   └── kinase-screening.html
├── chatters/originium.html    碎碎念详情
├── assets/
│   ├── css/style.css          可读源文件
│   ├── css/style.min.css      页面实际引用（esbuild 压缩）
│   ├── js/main.js             可读源文件
│   ├── js/main.min.js         页面实际引用
│   └── img/                   WebP 多尺寸 + 头像 + og 图
├── audit/                     Lighthouse 报告（仅本地，已 gitignore）
├── favicon.svg  feed.xml  robots.txt  sitemap.xml  .nojekyll  .gitignore
└── README.md  PERFORMANCE-AUDIT.md
```

## 内容怎么改

**改首页文案/统计**：直接编辑 `index.html`。统计数字（03 文章 / 01 杂谈 / 03 照片）是硬编码的，加文章时记得同步。

**加一篇文章**：复制 `posts/gromacs-2025.html`，改 `<title>`、`<h1>`、`.article-meta`、`.article-body`、上下篇链接；再到 `posts/index.html` 和 `index.html` 的轮播里加一条。轮播每条是 `.feature-slide`，靠 `data-title` / `data-desc` / `data-date` / `data-href` 驱动，JS 会自动读。

**换图**：新图放到 `assets/img/`，导出 WebP 三个宽度（640 / 1024 / 1376），保持 `width` / `height` 属性与实际像素一致，`srcset` 里加一项即可。命令示例：

```bash
python3 - <<'PY'
from PIL import Image
im = Image.open('原图.jpg').convert('RGB')
for w in (640, 1024, 1376):
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)\
      .save(f'assets/img/名字-{w}.webp', 'WEBP', quality=72, method=6)
PY
```

**改样式后重新压缩**（页面引用的是 `.min` 文件）：

```bash
cd /workspace
npx --yes esbuild@0.25.0 assets/css/style.css --minify --outfile=assets/css/style.min.css --target=chrome100,safari15,firefox100
npx --yes esbuild@0.25.0 assets/js/main.js  --minify --outfile=assets/js/main.min.js  --target=chrome100,safari15,firefox100
```

## 相比原站修了什么

原站的问题按严重程度列，前四条属于"跑不起来/跑不对"。

### 1. 构建与运行（阻断级）

| # | 问题 | 位置 | 处理 |
|---|---|---|---|
| 1 | 引用了不存在的组件 `DanmakuBackground` | `app/page.tsx` | 移除，弹幕背景改由静态 HUD 装饰承担 |
| 2 | 引用了不存在的组件 `TomatoClock` | `components/GlobalToolbox.tsx` | 移除该工具入口 |
| 3 | 404 页放在 `app/not-found/page.tsx`，不是 App Router 的约定文件（应为 `app/not-found.tsx`），错误路径不会命中 | `app/not-found/` | 改为根目录 `404.html`（GitHub Pages 会自动使用） |
| 4 | 静态导出 `output: 'export'` 下 `/api/music` 路由不可用，播放器只剩降级分支 | `next.config.ts` + `MusicProvider` | 播放器改为"正在听"歌单卡，直接外链网易云，不做假播放 |

### 2. 性能

| # | 问题 | 依据 | 处理 |
|---|---|---|---|
| 5 | Hero 的 `<video>` 是 `autoplay` + `preload="auto"`，并在 4 个 mp4 之间每 12 秒轮换；源码注释写着"不再有视频"，代码仍在播 | `EditorialSciFiHero.tsx` | 换成 1 张 WebP（96KB / 640·1024·1376 三档），`fetchpriority=high` 预加载 |
| 6 | `next/font` 拉 4 个 Google 字体族（含 Noto Serif SC 中文） | `app/layout.tsx` | 改用系统衬线栈，字体请求 0 个 |
| 7 | 卡片大量 `backdrop-blur-3xl` + `rounded-3xl` + `shadow-xl`，大面积合成层 | 各 Card 组件 | 改为 1px 描边 + 3px 圆角，只有顶栏保留 blur |
| 8 | 图片全部外链 `bu.dusays.com` / `images.unsplash.com`，无尺寸、无 srcset | `data/albums.ts`、轮播 | 本地 WebP + `srcset/sizes` + 显式 `width/height` |
| 9 | 轮播、菜单、页面过渡都依赖 `framer-motion`；`three` / `ogl` / `tiptap` / `openai` 也在依赖里 | `package.json` | 原生 JS 5.6KB 覆盖全部交互 |
| 10 | 时钟 `setInterval(1000)` 每秒触发两处组件重渲染 | `SiteDashboard`、`ThemeToggleBlock` | 统一 30 秒一跳，只有仪表盘显示秒 |

### 3. 可访问性

| # | 问题 | 处理 |
|---|---|---|
| 11 | Hero 文字 `#F97316` / `#EAB308` 在白底上对比度 2.9:1 / 1.9:1，远低于 AA 4.5:1 | 改为黑底白字 + 棕橙 `#B45309` 点缀（5.0:1） |
| 12 | 入场动画 `.reveal` 在没有 JS 时会让整页停在 `opacity:0` | 加 `.js` 前置类，无 JS 时内容照常显示 |
| 13 | 手机导航是可拖拽旋转的 320px 圆盘，键盘不可达 | 改为抽屉菜单，44px 触控目标，Esc 可关 |
| 14 | 轮播圆点用 `role="tab"` 但没有 `tabpanel` | 改为 `button` + `aria-current` |
| 15 | 页脚链接只靠颜色区分（1.59:1） | 加 1px 下划线 |
| 16 | 大量 10px/11px 的 mono 文本用 `#9ca3af` | 提到 `#5b6470`（浅色）/ `#a3a29e`（深色） |

### 4. 隐私与安全

| # | 问题 | 处理 |
|---|---|---|
| 17 | `siteConfig.amapKey`、`caiyunToken` 明文写在客户端配置，会随 JS 打包公开 | 新站不含任何第三方 key |
| 18 | 关于页与页脚公开手机号 `19885094963` | 移除，只留邮箱 / QQ / 抖音 |
| 19 | QQ 号 `2513810032` 与邮箱前缀 `2513810332` 不一致 | 按 `siteConfig` 统一为 `2513810032`，邮箱保持不变 |
| 20 | 高德/彩云请求全部发往第三方，且没有配额保护 | 天气模块整体移除（依赖实时 API，静态站无法缓存） |

### 5. SEO 与部署

| # | 问题 | 处理 |
|---|---|---|
| 21 | 无 canonical / og:image / sitemap / robots | 全部补齐，含 JSON-LD `WebSite` |
| 22 | 资源用 `/avatar.jpg`、`/bg/hero.jpg` 这类根路径，部署到 `/repo/` 全部 404 | 全部改相对路径，加 `.nojekyll` |
| 23 | `feed.xml` 与 `scripts/generate-rss.mjs` 双份维护，容易不同步 | 保留静态 `feed.xml`，作为唯一来源 |
| 24 | 没有 404 页 | 新增自带样式的 `404.html` |

### 6. 内容

- 原 `posts/first.md` 与 `posts/2222.md` 是同一篇的两个副本，正文只有一句 "..."；`long-test-article.md` 结尾直接是 "## 测试用文章"。现在三篇合并为两篇可读正文，保留原标题与原意，并明确标注"待续"。
- 相册、友链里的图片都指向 `bu.dusays.com` 的测试图，友链指向 PRTS wiki。新站只保留提供的三张照片，不做虚构内容。

## 没有搬过来的部分（可按需补）

原站还有 `/weather`、`/tree`（灵境，WebGL 炼金实验室）、`/music`、`/moments`、`/friends`、`/projects`、`/timeline`、`/status`、`/about` 共 9 个页面。没搬的原因分别是：

- **weather**：依赖高德 + 彩云两个带 key 的实时接口，静态站只能用假数据；
- **tree / music**：`DijiangModel.tsx`(52KB) + `AlchemyLab.tsx`(44KB) 是 three.js 场景，单页 JS 体积和 GPU 开销与"秒开"目标冲突；
- **moments / friends / projects / timeline / about**：数据量很小（1 条项目、1 条友链），单独开页收益低。

需要的话可以按页补：`projects` 和 `about` 最适合先做（纯静态、有真实数据）；`tree` 建议单独做懒加载路由，只在进入时下载 three.js。

## 浏览器支持

Chrome/Edge 100+、Safari 15+、Firefox 100+。用到的现代特性：`color-mix()`、`aspect-ratio`、`svh`、`text-wrap: balance`、`IntersectionObserver`。不支持时降级为纯白/纯黑背景与静态布局，内容不受影响。
