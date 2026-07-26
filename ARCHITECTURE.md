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
├── dev-server-proxy.py           # 带 CORS 代理 + 连接池的 Python 开发服务器
├── README.md                     # 项目介绍（面向用户）
├── ARCHITECTURE.md               # 本文件
│
├── css/
│   ├── theme.css                 # 主题变量 + Reset + 滚动条（~115行）
│   ├── animations.css            # 所有 @keyframes 动画定义（~60行）
│   ├── layout.css                # App Shell / 顶栏 / 侧栏 / 抽屉（~375行）
│   ├── components.css            # 通用组件：wf-card / wf-chip / wf-btn / 对话框 / 进度条 / Snackbar（~1150行）
│   ├── responsive.css            # 所有 @media 响应式适配（~185行）
│   └── pages/
│       ├── taskboard.css         # 看板页：双栏 / TabBar / 翻页（~187行）
│       ├── browser.css           # 浏览器页：工具栏 / iframe / URL输入（~139行）
│       ├── settings.css          # 设置页：卡片布局 / 开关样式引用（~135行）
│       ├── reminder.css          # 提醒页：卡片 / 状态徽章 / 快捷按钮（~364行）
│       ├── arbitration.css       # 仲裁页：评级标签 / 状态标签 / 契形开关（~594行）
│       ├── notes.css             # 便签页：卡片 / 进度条 / 编辑器 / 事项拖动（~720行）
│       └── market.css            # 市场查价页：搜索 / 自动补全 / 结果卡片 / 收藏栏（~870行）
│
├── js/
│   ├── utils.js                  # 全局工具函数：日期 / DOM / Snackbar（~106行）
│   ├── store.js                  # localStorage 持久化 + 自动重置逻辑 + 导出/导入（~255行）
│   ├── sync_gist.js              # GitHub Gist 云端同步模块（~280行）
│   ├── components.js             # 可复用组件工厂：按钮 / 任务卡片 / 面板 / 对话框 / 进度条（~700行）
│   ├── taskboard.js              # 看板页控制器（~350行）
│   ├── reminder.js               # 提醒页控制器（~590行）
│   ├── arbitration_data.js       # 仲裁数据加载与查询（多数据源降级）（~253行）
│   ├── arbitration.js            # 仲裁页控制器（~440行）
│   ├── browser.js                # 浏览器页控制器（~163行）
│   ├── notes.js                  # 便签页控制器：卡片 / 编辑器 / 事项拖拽排序（~1200行）
│   ├── wf_market.js              # Warframe Market 查价页：物品清单 / 自动补全 / 订单查询 / 收藏（~1340行）
│   ├── settings.js               # 设置页控制器：导入 / 导出 / 云端同步教程（~530行）
│   └── main.js                   # 应用入口：导航 / 路由 / 状态协调（~450行）
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
theme.css → animations.css → layout.css → components.css
→ pages/taskboard.css → browser.css → settings.css → reminder.css → arbitration.css → notes.css → market.css
→ responsive.css
```

**原则**：越具体的样式越靠后，`responsive.css` 必须最后加载。

### 3.2 各文件职责

| 文件 | 职责 | 关键内容 |
|------|------|----------|
| `theme.css` | 主题令牌与全局基础 | `:root` CSS 变量（颜色/间距/过渡时间/卡片系统变量/拟物纹理变量）；全局 reset；`body` 字体；滚动条样式 |
| `animations.css` | 所有 `@keyframes` | `spin`/`triggerGlow`/`reminderPulse`/`tempReminderPulse`/`cardBorderFlow`/`glowLineBreathe`/`marketResultFadeIn` |
| `layout.css` | 应用级骨架 | `#app` flex布局；`.app-header`（宽屏顶栏）；`.page-header::after`（金→蓝渐变彩线）；`.glow-divider`；`.sidebar`；`.content-panel`；`.page-view`；窄屏抽屉系统 |
| `components.css` | 可跨页面复用的组件 | **核心基底类**（见 3.3）；任务面板与卡片；编辑器对话框；Snackbar；加载动画；拖拽占位符；通用进度条（`.wf-progress`/`.wf-progress-fill`）；通用空状态（`.wf-empty-state`/`.wf-empty-icon`）；对话框工厂（`createDialog()`） |
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

### 3.5 通用组件抽象

项目中三处重复的**进度条样式**（看板面板 / 便签卡片 / 市场加载）已统一为 `.wf-progress` + `.wf-progress-fill` 基底类，通过 CSS 变量 `--card-accent` 控制颜色，页面专属类仅保留差异化属性（高度/边距）。

三处重复的**空状态样式**（便签 / 提醒 / 市场）已统一为 `.wf-empty-state` 系列类（`.wf-empty-icon` / `.wf-empty-title` / `.wf-empty-desc`），页面专属类仅覆盖内边距和 flex 属性。

---

## 四、JS 架构

### 4.1 加载顺序（index.html 中不可调整）

```
utils.js → store.js → sync_gist.js → components.js → taskboard.js → reminder.js
→ arbitration_data.js → arbitration.js → browser.js → notes.js → wf_market.js → settings.js → main.js
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
| `DEFAULT_DAILY_ACCENT` / `DEFAULT_WEEKLY_ACCENT` | 默认主题色常量 |

#### `store.js` — 数据持久化

**localStorage 键**：`wf_daily_state` / `wf_weekly_state` / `wf_last_daily_reset` / `wf_last_weekly_reset` / `wf_reminders_state` / `wf_notes_state` / `wf_arbi_auto_add`

**默认任务**：
- 日常（4项）：突击、每日献礼、大傻/三傻、执政官裂缝
- 周常（4项）：执政官猎杀、卡尔驻军、虚空商人、钢铁之路

**核心方法**：`loadDailyTasks()` / `saveDailyTasks()` / `checkAndPerformReset()` / `generateId()` / `exportAll()` / `importAll()`

**导出格式 v3**（含 `marketFavorites`）：
```json
{
  "version": 3,
  "dailyTasks": [...],
  "weeklyTasks": [...],
  "reminders": [...],
  "notes": [...],
  "settings": { "arbiAutoAdd": true },
  "marketFavorites": [{"slug":"...", "name":"...", "nameEn":"..."}]
}
```

#### `sync_gist.js` — 云端同步（`GistSync` 对象）

- **配置**：Token + Gist ID 存 localStorage，`wf_gist_token` / `wf_gist_id`
- **数据格式**：调用 `Store.exportAll()`，外层包裹 `{ updatedAt, data }` 时间戳信封
- **上传**：4 秒防抖（`triggerUpload()`），或立即上传（`uploadNow()`）
- **下载**：`download()` → 检查 `updatedAt` 时间戳 → 调用 `Store.importAll()` 覆写本地
- **自动同步**：`visibilitychange` 切回前台时静默拉取
- **回调**：`onUpload(listener)` 注册上传成功回调，用于设置页显示"已上传"状态

#### `components.js` — 可复用组件工厂

| 函数 | 说明 |
|------|------|
| `createDialog(opts)` | 标准 Orokin 风格对话框工厂 — 统一 6 处对话框构建，支持 `{ title, body, footer, onClose, closeOnOverlay, closeOnEscape, width }`，返回 `{ overlay, box, close }` |
| `createBtn(opts)` | 通用按钮工厂 |
| `createTaskCard(task, callbacks, isManageMode, showDragHandle)` | 任务卡片（未完成银色/已完成金色，含拖拽手柄+图标徽章+管理按钮+勾选框） |
| `createTaskPanel(opts, taskType, initialProgress)` | 任务面板（含进度条灵动过渡；列表区 HTML5 Drag&Drop + 移动端 touch 拖拽排序） |
| `createTaskEditorDialog(task, isDaily, onSubmit)` | 任务编辑对话框（名称/描述/15图标选择/5色选择） |
| `confirmDialog(opts)` | 确认对话框（返回 Promise boolean） |

#### `taskboard.js` — 看板页（`Taskboard` 对象）

- `init(container, isManageMode)`：渲染骨架（宽屏双栏 + 窄屏 TabBar/TabView + loading）
- **翻页动画**：强制 reflow 机制，时长 0.4s，缓动 `cubic-bezier(0.32, 0.72, 0, 1)`
- **进度条**：从旧 DOM 读取当前 width 作为动画起始值，避免从 0% 重新增长
- **自动重置**：每日 08:00 / 每周一 08:00，仅重置未完成项
- `setManageMode(enabled)`：外部控制管理模式开关

#### `reminder.js` — 提醒页（`Reminder` 对象）

- **自动删除**：激活后 30 分钟自动删除（`REMINDER_AUTO_DELETE_MS = 30 * 60 * 1000`）
- **性能优化**：`_onTick()` 每秒只调用 `_updateCardState()` 增量更新，不重建 DOM
- **卡片状态**：pending（蓝色倒计时）→ active（黄色脉冲发光）→ completed（绿色，30分钟后删除）
- **临时提醒**：支持 `isTemp` 标记，仲裁页自动注入的提醒使用 `tempType: 'arbi_temp'`

#### `arbitration_data.js` — 仲裁数据加载（`ArbiData` 对象）

- **数据源降级**：`[本地 data/ → 开发代理 /proxy/ → 远程直连]`，并行 fetch 3 个 JSON
- **缓存**：localStorage 24h TTL，命中后后台刷新
- **查询方法**：`getCurrentArbitration(nowTs)` / `getUpcomingArbitrations()` / `getTodaysHighValueArbitrations()`
- **调度算法**：`_getNodeAt(ts)` 通过 `seq[stepsSinceStart % seqLen]` 定位当前节点

#### `arbitration.js` — 仲裁页（`Arbitration` 对象）

- **三区域渲染**：当前仲裁（含倒计时）+ 今日高价值列表 + 未来 12 小时列表
- **自动添加提醒**：每日 0 点自动将高价值仲裁批量写入 Store 作为临时提醒
- **设置对话框**：使用 `createDialog()` 工厂构建，含契形开关 + 数据刷新按钮

#### `browser.js` — 浏览器页（`Browser` 对象）

- **预设站点**：灰机 Wiki（iframe）/ wf.wiki（新标签页）/ Warframe Market（新标签页）
- URL 持久化到 localStorage（`wf_browser_last_url`）

#### `notes.js` — 便签页（`Notes` 对象）

- **卡片列表**：每张便签带标题、颜色、进度条、事项列表
- **编辑器**：`_openEditor()` 使用 `createDialog()` 工厂构建，支持标题/颜色切换/置顶/事项增删改
- **事项拖拽**：支持在编辑器内拖拽排序事项（桌面端鼠标拖拽 + 移动端触摸拖拽）
- **性能优化**：勾选事项时使用 `_updateCardItemStates()` 增量更新（不重建整卡），避免闪烁
- **进度条**：使用通用 `.wf-progress` / `.wf-progress-fill` 基底类

#### `wf_market.js` — 市场查价页（`Market` 对象）

- **物品清单**：启动时从 `api.warframe.market/v2/items` 拉取全量物品，localStorage 缓存 24h，后台静默刷新
- **自动补全**：中文/英文 双向模糊匹配（预计算 `slugL/nameL/nameEnL/nameZhL`，零 toLowerCase 开销），80ms 防抖，LRU 缓存 200 条
- **物品缩略图**：长流程部件使用 SVG 占位符（神经/机体/系统/枪管/枪机/枪托等），Mod 显示中空卡片，遗物显示篮球图标，其他使用 IndexedDB 缓存的 CDN 图片
- **查价**：`_fetchOrders(slug)` 带 15s AbortController 超时；支持中文别名映射（`WM_CN_ALIASES`）
- **价格统计**：底价 / 众数 / 切尾平均价(5%) / 在线卖家数
- **报价列表交互**：点击报价可切换选中卖家，复制按钮跟随选中卖家
- **收藏功能**：最多 6 个，localStorage 持久化（`wf_market_favorites_v1`），随导出/导入同步
- **自动补全下拉**：`position: fixed` 挂载在 body，通过 scroll/resize 事件动态同步位置，支持窄屏/宽屏自适应

#### `settings.js` — 设置页（`Settings` 对象）

- **5 张功能卡片**：
  1. 仲裁自动提醒开关（与仲裁页共享 `wf_arbi_auto_add` 键）
  2. 数据导出（JSON v3）
  3. 数据导入（含确认对话框 + 覆盖式写入 + 通知刷新所有模块）
  4. 云端同步配置（Token/Gist ID 输入 + 上传/拉取按钮 + 指示灯 + 教程弹窗）
  5. 数据重置
- **云端同步教程**：使用 `createDialog()` 工厂构建的 4 步骤教程弹窗

#### `main.js` — 应用主控制器（IIFE，暴露 `window.App`）

- **导航配置**：`NAV_ITEMS` 7 项（看板/提醒/仲裁/便签/浏览器/市场/设置）
- **页面初始化**：看板页优先同步初始化，其余非活跃页面通过 `requestIdleCallback` 延迟初始化（避免启动卡顿）
- **页面切换** `_switchPage(index)`：切换 `.page-view.active` → 同步侧栏/抽屉选中态 → 更新顶栏副标题 → 更新 inline 触发按钮 → 控制管理按钮显示
- **数据刷新**：`reloadAll()` 供导入后调用所有模块刷新

---

## 五、数据文件

| 文件 | 内容 | 格式 |
|------|------|------|
| `arbys.nodes.zh.json` | 仲裁节点定义 | `schema:1`，`nodes` 对象，键为 nodeKey |
| `arbys.schedule.v2.json` | 仲裁轮换调度表 | `schema:2`，含 `startTs`、`stepSec:3600`、`nodes` 数组、`seq` 数组 |
| `tierlist.default.json` | 仲裁节点评级表 | `schema:1`，`tiers` 数组，`tierBuckets` 映射 |

**GitHub Actions**（`.github/workflows/sync-arbi-data.yml`）每天 UTC 4:00 从 `https://arbi.wf.wiki/data/` 下载这 3 个文件，校验后自动提交更新。

---

## 六、开发服务器

### `dev-server.bat`
Windows 启动脚本。设置 `PORT=8082`，直接启动 `python dev-server-proxy.py`。

### `dev-server-proxy.py`
继承 `http.server.SimpleHTTPRequestHandler` 的开发服务器：

- **连接池复用**：使用 `http.client.HTTPSConnection` 连接池（`_conn_pool` 字典），对 `api.warframe.market` 等目标 host 复用 TCP+SSL 连接，首次握手后后续请求省去 SSL 开销
- **重试机制**：最多 2 次重试，间隔 0.2s，连接断开时自动清除池中失效连接
- `/proxy/` 路径前缀转发到外部站点，附带 `Access-Control-Allow-Origin: *` 头解决 CORS 问题
- `allow_reuse_address = True` + `request_queue_size = 128` + `daemon_threads = True`

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
页面模块 (Taskboard/Reminder/Arbitration/Browser/Notes/Market/Settings)
    ↓
Store (localStorage) / 各模块独立 localStorage 键
    ↓
跨模块通信通过 window.App 协调

特殊数据流：
1. 仲裁自动提醒：Arbitration → Store.saveReminders() → App.reminder.reloadFromStore()
2. 设置导入：Settings → Store.importAll() → App.reloadAll()
3. 设置仲裁开关：Settings → localStorage → Arbitration._state 同步
4. 云端同步：GistSync → Store.exportAll() / Store.importAll() → App.reloadAll()
5. 市场收藏：Market._saveFavorites() → localStorage（随 Store.exportAll() 导出）
```

---

## 九、硬性约束

- **禁止使用构建工具**（无 Webpack/Vite，保持零依赖原生项目）
- **禁止在页面 CSS 中写 `@keyframes`**，统一放 `animations.css`
- **禁止在非 `responsive.css` 文件中写 `@media`**（仲裁页开关样式例外，因与组件紧密耦合）
- **新增样式优先复用 CSS 变量**，不要硬编码颜色值
- **JS 模块间通信通过 `main.js` 协调**，避免页面模块互相直接依赖
- **`.wf-card`/`.wf-chip` 的纯文本内容必须包裹在 `<span>` 中**，否则会被伪元素覆盖不可见
- **CSS 变量 `--chip-chamfer-inner` 必须直接计算**，不可使用 `var()` 自引用
- **进度条动画必须从旧 DOM 读取当前 width 作为起始值**，避免从 0% 重新增长
- **翻页动画必须使用强制 reflow 机制**（`void offsetHeight`）
- **进度条、空状态优先使用通用类 `.wf-progress` / `.wf-empty-state`**，避免在页面 CSS 中重复实现
- **对话框统一使用 `createDialog()` 工厂函数**，禁止手动构建对话框 DOM

---

## 十、新增页面步骤

1. **CSS**：`css/pages/` 下新建 `xxx.css`
2. **JS**：`js/` 下新建 `xxx.js`，导出 `Xxx` 对象
3. **HTML**：`index.html` 中加 `<div class="page-view" id="page-xxx"></div>`、`<link>` 和 `<script>`
4. **导航**：`js/main.js` 的 `NAV_ITEMS` 数组追加一项

新增通用组件：样式写入 `components.css`，工厂函数写入 `components.js`。
