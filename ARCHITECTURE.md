# Warframe Taskboard Web — 架构文档

> 本文件是项目的**唯一权威架构参考**，涵盖完整目录结构、每个文件的职责与关键实现、数据流、设计系统、响应式策略与硬性约束。阅读本文件即可完全理解项目，无需翻阅其他文档。

---

## 一、项目定位

- **来源**：由 Flutter 版 Warframe Taskboard 迁移至 Web 平台（纯 HTML + CSS + 原生 JS，无构建工具）
- **设计语言**：奥罗金暗色科幻美学（深灰底色 + 金/蓝/黄强调色，拟物金属质感）
- **目标平台**：桌面浏览器（≥900px）、移动端浏览器（<900px），响应式自适应
- **字体**：`"STZhongsong", serif`（华文中宋 + 浏览器默认衬线字体回退）
- **图标**：Google Material Icons（CDN 加载）

---

## 二、完整目录结构

```
wf-taskboard-web/
├── index.html                    # SPA 入口，定义所有页面容器与资源加载顺序
├── dev-server.bat                # Windows 开发服务器启动脚本
├── dev-server-proxy.py           # 带 CORS 代理的 Python 开发服务器
├── README.md                     # 项目介绍（面向用户）
├── ARCHITECTURE.md               # 本文件
│
├── css/
│   ├── theme.css                 # 主题变量 + Reset + 滚动条（~115行）
│   ├── orokin.css                # 奥罗金拟物材质工具类（~84行）
│   ├── animations.css            # 所有 @keyframes 动画定义（~45行）
│   ├── layout.css                # App Shell / 顶栏 / 侧栏 / 抽屉 / 底栏（~375行）
│   ├── components.css            # 通用组件：wf-card / wf-chip / wf-btn / 对话框 / Snackbar（~1056行）
│   ├── responsive.css            # 所有 @media 响应式适配（~137行）
│   └── pages/
│       ├── taskboard.css         # 看板页：双栏 / TabBar / 翻页（~187行）
│       ├── browser.css           # 浏览器页：工具栏 / iframe / URL输入（~139行）
│       ├── settings.css          # 设置页：卡片布局 / 开关样式引用（~135行）
│       ├── reminder.css          # 提醒页：卡片 / 状态徽章 / 快捷按钮（~364行）
│       └── arbitration.css       # 仲裁页：评级标签 / 状态标签 / 契形开关（~594行）
│
├── js/
│   ├── utils.js                  # 全局工具函数：日期 / DOM / Snackbar（~106行）
│   ├── store.js                  # localStorage 持久化 + 自动重置逻辑（~152行）
│   ├── components.js             # 可复用组件工厂：按钮 / 任务卡片 / 面板 / 编辑对话框（~608行）
│   ├── taskboard.js              # 看板页控制器（~353行）
│   ├── reminder.js               # 提醒页控制器（~588行）
│   ├── arbitration_data.js       # 仲裁数据加载与查询（多数据源降级）（~253行）
│   ├── arbitration.js            # 仲裁页控制器（~439行）
│   ├── browser.js                # 浏览器页控制器（~163行）
│   ├── settings.js               # 设置页控制器：导入 / 导出 / 仲裁开关（~331行）
│   └── main.js                   # 应用入口：导航 / 路由 / 状态协调（~375行）
│
├── data/
│   ├── arbys.nodes.zh.json       # 仲裁节点定义（地点 / 任务类型 / 阵营）
│   ├── arbys.schedule.v2.json    # 仲裁轮换调度表（起始时间戳 + 节点序列）
│   └── tierlist.default.json     # 仲裁节点评级表（S/A+/A/A-/B/C 桶）
│
└── .github/workflows/
    └── sync-arbi-data.yml        # 每日自动同步仲裁数据（UTC 4:00）
```

---

## 三、CSS 架构

### 3.1 加载顺序（index.html 中不可调整）

```
theme.css → orokin.css → animations.css → layout.css → components.css
→ pages/taskboard.css → browser.css → settings.css → reminder.css → arbitration.css
→ responsive.css
```

**原则**：越具体的样式越靠后，`responsive.css` 必须最后加载。

### 3.2 各文件职责

| 文件 | 职责 | 关键内容 |
|------|------|----------|
| `theme.css` | 主题令牌与全局基础 | `:root` CSS 变量（颜色/间距/过渡时间/卡片系统变量/拟物纹理变量）；全局 reset；`body` 字体；滚动条样式 |
| `orokin.css` | 奥罗金拟物材质工具类 | 切角变量 `--chamfer-sm/md/lg`；`.orokin-inner`（碳纤维+玻璃反光材质层）；`.orokin-content`（内容层 z-index:2）；`.orokin-corner-decor`（四角铆点装饰） |
| `animations.css` | 所有 `@keyframes` | `spin`/`triggerGlow`/`reminderPulse`/`tempReminderPulse`/`cardBorderFlow`/`glowLineBreathe` |
| `layout.css` | 应用级骨架 | `#app` flex布局；`.app-header`（宽屏顶栏：brand + header-center + header-right）；`.page-header::after`（金→蓝渐变彩线）；`.glow-divider`；`.sidebar`；`.content-panel`；`.page-view`；窄屏抽屉系统（`.nav-trigger-inline`/`.drawer-overlay`/`.drawer-panel`） |
| `components.css` | 可跨页面复用的组件 | **核心基底类**（见 3.3）；任务面板与卡片；编辑器对话框；Snackbar；加载动画；拖拽占位符 |
| `responsive.css` | 所有 `@media` | 3个断点：≥900px / <900px / <480px |
| `pages/*.css` | 单一页面专属样式 | 各页面内部布局与元素 |

### 3.3 卡片设计系统（核心）

项目通过两个基底类 + CSS 变量实现统一的金属质感卡片样式，**所有卡片无需手动调配渐变**：

**`.wf-card`** — 大型契形卡片：
- 结构：`clip-path` 切角外框 + `::before` 金属渐变边框层(z-index:0) + `::after` 拟物内填充层(z-index:1) + `> *` 内容层(z-index:2)
- 颜色驱动：通过 `--card-accent`（亮色）和 `--card-accent-deep`（暗色）自动派生边框渐变与填充色
- 预设变体：`.silver` / `.gold` / `.yellow` / `.blue` / `.green`
- 流光修饰：加 `.flow` 类启用 3.5s 横向流光扫过动画

**`.wf-chip`** — 小型契形元素（徽章/按钮/标签）：
- 共享 `.wf-card` 的颜色变量系统，但默认切角更小
- 额外含 `.danger` 变体
- 使用 `--chip-chamfer` / `--chip-inset` 控制切角

**使用方式**：
```html
<div class="wf-card gold flow" style="--card-chamfer:12px">...</div>
<div class="wf-chip silver">...</div>
```

### 3.4 通用按钮 `.wf-btn`

- 拟物材质填充（`::before`）+ 金属边框（`::after`）
- 变体：`.primary`（金色实心）/ `.outline`（描边）/ `.sidebar-tile`（侧栏导航，激活态带斜向高光扫光）/ `.wf-icon-btn`
- 纯文本内容必须包裹在 `<span>` 中（否则会被伪元素覆盖不可见）

---

## 四、JS 架构

### 4.1 加载顺序（index.html 中不可调整）

```
utils.js → store.js → components.js → taskboard.js → reminder.js
→ arbitration_data.js → arbitration.js → browser.js → settings.js → main.js
```

**依赖方向**：`main.js` 依赖所有模块；各页面模块依赖 `utils.js`/`store.js`/`components.js`；`arbitration.js` 依赖 `arbitration_data.js`；模块间通信通过 `window.App` 协调。

### 4.2 各模块详解

#### `utils.js` — 全局工具函数（无对象封装）

| 函数 | 说明 |
|------|------|
| `DAILY_RESET_HOUR=8` | 每日重置小时（UTC+8） |
| `WEEKLY_RESET_WEEKDAY=1` | 每周重置日（周一） |
| `formatDate(now)` | → "yyyy.MM.dd 周X" |
| `formatDateKey(dt)` | → "yyyy-MM-dd" |
| `formatDuration(ms)` | → "HH:MM:SS" |
| `countdownText(now)` | → "日常 HH:MM:SS · 周常 HH:MM:SS" |
| `mostRecentWeekday(from, weekday)` | 计算最近的目标工作日 |
| `clearEl(el)` | 清空 DOM 子元素 |
| `showSnackbar(msg, duration)` | 显示底部 Snackbar |

#### `store.js` — 数据持久化

**localStorage 键**：`wf_daily_state` / `wf_weekly_state` / `wf_last_daily_reset` / `wf_last_weekly_reset` / `wf_reminders_state`

**默认任务**：
- 日常（4项）：突击、每日献礼、大傻/三傻、执政官裂缝
- 周常（4项）：执政官猎杀、卡尔驻军、虚空商人、钢铁之路

**核心方法**：`loadDailyTasks()` / `loadWeeklyTasks()` / `saveDailyTasks()` / `saveWeeklyTasks()` / `loadReminders()` / `saveReminders()` / `checkAndPerformReset()` / `generateId()`

#### `components.js` — 可复用组件工厂

| 函数 | 说明 |
|------|------|
| `mi(name, extraClass)` | 创建 Material Icon 的 `<span>` |
| `createBtn(opts)` | 通用按钮工厂（支持 icon/text/active/primary/outline/className/onClick） |
| `createTaskCard(task, callbacks, isManageMode, showDragHandle)` | 任务卡片（未完成银色/已完成金色，含拖拽手柄+图标徽章+管理按钮+勾选框；管理模式绑定 HTML5 dragstart/dragend） |
| `createTaskPanel(opts, taskType, initialProgress)` | 任务面板（含进度条灵动过渡：`requestAnimationFrame` 从 `initialProgress` 平滑到目标值；列表区 HTML5 Drag&Drop + 移动端 touch 拖拽排序 + `navigator.vibrate(20)` 震动反馈） |
| `createTaskEditorDialog(task, isDaily, onSubmit)` | 任务编辑对话框（名称/描述/15图标选择/5色选择） |
| `fieldLabel/sizedBox/dividerEl` | 内部工具函数 |

#### `taskboard.js` — 看板页（`Taskboard` 对象）

- `init(container, isManageMode)`：渲染骨架（宽屏双栏 + 窄屏 TabBar/TabView + loading）
- **翻页动画**：强制 reflow 机制（清理上次动画 → 旧面板滑出 → 新面板无 transition 放到入口 → `void offsetHeight` 强制 reflow → 启用 transition 过渡），时长 0.4s，缓动 `cubic-bezier(0.32, 0.72, 0, 1)`
- **进度条**：从旧 DOM 读取当前 width 作为动画起始值，避免从 0% 重新增长
- **自动重置**：每日 08:00 / 每周一 08:00 调用 `Store.checkAndPerformReset`，仅重置未完成项
- `setManageMode(enabled)`：外部控制管理模式开关

#### `reminder.js` — 提醒页（`Reminder` 对象）

- **常量**：`REMINDER_AUTO_DELETE_MS = 30 * 60 * 1000`（激活后 30 分钟自动删除）
- **性能优化**：`_renderList()` 完整重建 DOM 后，`_onTick()` 每秒只调用 `_updateCardState()` 更新文本和类名，不重建 DOM
- **卡片状态**：pending（蓝色倒计时）→ active（黄色脉冲发光）→ completed（绿色，30分钟后删除）
- **临时提醒**：支持 `isTemp` 标记，仲裁页自动注入的提醒使用 `tempType: 'arbi_temp'`
- **编辑器**：快捷小时按钮（1/2/4/8/12/24h）+ 日期/时间输入 + 图标/颜色选择

#### `arbitration_data.js` — 仲裁数据加载（`ArbiData` 对象）

- **数据源降级**：`[本地 data/ 目录 → 开发代理 /proxy/ → 远程直连 https://arbi.wf.wiki/data/]`，并行 fetch 3 个 JSON
- **缓存**：localStorage 24h TTL，命中后后台刷新
- **查询方法**：`getCurrentArbitration(nowTs)` / `getUpcomingArbitrations(hours, nowTs)` / `getTodaysHighValueArbitrations(nowTs)`（筛选 S/A+/A/A-）
- **调度算法**：`_getNodeAt(ts)` 通过 `seq[stepsSinceStart % seqLen]` 从调度数组定位当前节点

#### `arbitration.js` — 仲裁页（`Arbitration` 对象）

- **三区域渲染**：当前仲裁（含倒计时）+ 今日高价值列表（含 past/active 状态）+ 未来 12 小时列表（高价值用 `.wf-card gold` 突出）
- **自动添加提醒**：每日 0 点检查（`wf_arbi_last_daily_auto_add` 键），将今日高价值仲裁批量写入 `Store` 作为临时提醒，通知 `window.App.reminder.reloadFromStore()` 刷新
- **设置对话框**：NJOrokinUI 风格契形开关（SVG 边框 + 流光动画）+ 数据刷新按钮

#### `browser.js` — 浏览器页（`Browser` 对象）

- **预设站点**：灰机 Wiki（iframe 嵌入）/ wf.wiki（新标签页）/ Warframe Market（新标签页）
- URL 持久化到 localStorage（`wf_browser_last_url`）
- 支持 URL 输入、刷新、首页

#### `settings.js` — 设置页（`Settings` 对象）

- **3 张卡片**：仲裁自动提醒开关 + 导出按钮 + 导入按钮
- **导出**：v3 JSON（dailyTasks + weeklyTasks + reminders + settings.arbiAutoAdd）
- **导入**：读取 → JSON 解析 → 版本校验(v1/v2/v3) → 字段校验 → 确认对话框 → 写入 Store → 通知 App 刷新三个模块
- **仲裁开关**：与仲裁页共用 `wf_arbi_auto_add` 键，实时同步 `window.App.arbitration._state`

#### `main.js` — 应用主控制器（IIFE，暴露 `window.App`）

- **导航配置**：`NAV_ITEMS` 5 项（看板/提醒/仲裁/浏览器/设置）
- **初始化流程**：`_setupViewportHeight`（动态 `--vh` 解决手机地址栏遮挡）→ 缓存 DOM → `_renderSidebar` → `_createDrawer` → 初始化 5 个模块 → 绑定管理按钮 → `_startWideClock` → `_switchPage(0)`
- **页面切换** `_switchPage(index)`：切换 `.page-view.active` → 同步侧栏/抽屉选中态 → 更新顶栏副标题 → 更新 inline 触发按钮图标 → `_updateWideHeaderCenter`（浏览器页克隆控件模板到顶栏）→ 控制管理按钮显示（仅看板/提醒页）
- **窄屏抽屉**：`openDrawer()`/`closeDrawer()` 暴露给 inline 触发按钮
- **数据刷新**：`_reloadTaskboard()`/`_reloadReminder()`/`_reloadArbitration()` 供导入后调用

---

## 五、数据文件

| 文件 | 内容 | 格式 |
|------|------|------|
| `arbys.nodes.zh.json` | 仲裁节点定义 | `schema:1`，`nodes` 对象，键为 nodeKey，每节点含 missionType/missionNameZh/faction/nameZh/minEnemyLevel 等 |
| `arbys.schedule.v2.json` | 仲裁轮换调度表 | `schema:2`，含 `startTs`（起始时间戳）、`stepSec:3600`（步长1小时）、`nodes` 数组（~88个）、`seq` 数组（数千项，定义循环顺序） |
| `tierlist.default.json` | 仲裁节点评级表 | `schema:1`，`tiers` 数组（S/A+/A/A-/B/C/未评级），`tierBuckets` 将 tier 映射到 nodeKey 数组 |

**GitHub Actions**（`.github/workflows/sync-arbi-data.yml`）每天 UTC 4:00 从 `https://arbi.wf.wiki/data/` 下载这 3 个文件，校验后自动提交更新。

---

## 六、开发服务器

### `dev-server.bat`
Windows 启动脚本。设置 `PORT=8080`，获取局域网 IP，优先用 `py dev-server-proxy.py`（支持 CORS 代理），回退 `python -m http.server`。

### `dev-server-proxy.py`
继承 `http.server.SimpleHTTPRequestHandler` 的开发服务器：
- `protocol_version = 'HTTP/1.0'`（短连接，避免 keep-alive 挂起）
- `/proxy/` 路径前缀触发 CORS 代理（自动补 `https://`，附加 `Access-Control-Allow-Origin: *`）
- `allow_reuse_address = True` + `request_queue_size = 128`
- 静默处理 `ConnectionAbortedError`/`TimeoutError`/`BrokenPipeError`

---

## 七、响应式策略

| 断点 | 布局 | 关键变化 |
|------|------|----------|
| ≥900px | 宽屏 | 顶栏 + 左侧栏 + 看板双栏并排；浏览器工具栏移入顶栏 |
| <900px | 窄屏 | 隐藏顶栏/侧栏；各页面显示自带 header；看板切换为 TabBar + 翻页动画；抽屉式导航 |
| <480px | 手机竖屏 | 缩减所有 padding/字号；新增按钮缩为图标；对话框缩短至 2/3 屏 |

动态视口高度：`main.js` 中 `--vh` CSS 变量实时更新，解决手机浏览器地址栏遮挡问题。

---

## 八、数据流

```
用户操作
    ↓
页面模块 (Taskboard/Reminder/Arbitration/Browser/Settings)
    ↓
Store (localStorage)
    ↓
跨模块通信通过 window.App 协调

特殊数据流：
1. 仲裁自动提醒：Arbitration → Store.saveReminders() → App.reminder.reloadFromStore()
2. 设置导入：Settings → Store → App._reloadTaskboard/_reloadReminder/_reloadArbitration
3. 设置仲裁开关：Settings → localStorage → Arbitration._state 同步
```

---

## 九、硬性约束

- **禁止使用构建工具**（无 Webpack/Vite，保持零依赖原生项目）
- **禁止在页面 CSS 中写 `@keyframes`**，统一放 `animations.css`
- **禁止在非 `responsive.css` 文件中写 `@media`**（仲裁页开关样式例外，因与组件紧密耦合）
- **新增样式优先复用 CSS 变量**，不要硬编码颜色值
- **JS 模块间通信通过 `main.js` 协调**，避免页面模块互相直接依赖
- **`.wf-card`/`.wf-chip` 的纯文本内容必须包裹在 `<span>` 中**，否则会被伪元素覆盖不可见
- **CSS 变量 `--chip-chamfer-inner` 必须直接计算**（`calc(var(--chip-chamfer-val) - var(--chip-inset-val))`），不可使用 `var()` 自引用（会导致循环引用使 `clip-path` 失效）
- **进度条动画必须从旧 DOM 读取当前 width 作为起始值**，避免从 0% 重新增长
- **翻页动画必须使用强制 reflow 机制**（`void offsetHeight`），避免双 `requestAnimationFrame` 导致浏览器合并渲染帧引发跳帧

---

## 十、新增页面步骤

1. **CSS**：`css/pages/` 下新建 `xxx.css`
2. **JS**：`js/` 下新建 `xxx.js`，导出 `Xxx` 对象
3. **HTML**：`index.html` 中加 `<div class="page-view" id="page-xxx"></div>`、`<link>` 和 `<script>`
4. **导航**：`js/main.js` 的 `NAV_ITEMS` 数组追加一项

新增通用组件：样式写入 `components.css`，工厂函数写入 `components.js`。
