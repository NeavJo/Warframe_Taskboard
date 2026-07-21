# Warframe Taskboard Web — 架构与维护指南

> 本文件用于让新加入的开发者（或 AI 协作助手）在 1 分钟内把握本项目的**文件组织逻辑**和**维护风格约定**，避免破坏既有结构。
> 项目介绍请参阅 [README.md](./README.md)。

---

## 一、项目定位

- **来源**：由 Flutter 版 Warframe Taskboard 迁移至 Web 平台（纯 HTML + CSS + 原生 JS，无构建工具）
- **设计语言**：奥罗金暗色科幻美学（深灰底色 + 金/蓝/黄强调色）
- **目标平台**：桌面浏览器、移动端浏览器（响应式自适应）

---

## 二、文件架构总览

```
wf-taskboard-web/
├── index.html              # SPA 入口，定义所有页面容器与脚本加载顺序
│
├── css/                    # 样式系统（按职责拆分）
│   ├── theme.css           # 主题变量 + Reset + 滚动条
│   ├── animations.css      # 所有 @keyframes 动画
│   ├── layout.css          # App Shell / 顶栏 / 侧栏 / 抽屉 / 底栏
│   ├── components.css      # 通用组件（按钮 / 任务卡片 / 对话框 / Snackbar）
│   ├── pages/              # 各页面专属样式（一个页面一个文件）
│   │   ├── taskboard.css
│   │   ├── browser.css
│   │   ├── settings.css
│   │   └── reminder.css
│   └── responsive.css      # 所有 @media 响应式适配
│
├── js/                     # 脚本逻辑（按功能模块拆分）
│   ├── utils.js            # 工具函数（日期格式化、DOM、Snackbar）
│   ├── store.js            # localStorage 数据持久化
│   ├── components.js       # 可复用组件工厂
│   ├── taskboard.js        # 看板页逻辑
│   ├── reminder.js         # 提醒页逻辑
│   ├── browser.js          # 浏览器页逻辑
│   ├── settings.js         # 设置页逻辑
│   └── main.js             # 应用入口、导航、路由控制
│
├── README.md              # 项目介绍
└── ARCHITECTURE.md        # 本文件（架构与维护指南）
```

---

## 三、拆分逻辑：为什么要这样分？

### 3.1 CSS 拆分原则：**按职责，不按大小**

| 文件 | 职责边界 | 判断规则 |
|------|----------|----------|
| `theme.css` | 只放"可复用的值"和"全局基础样式" | 如果一段样式在任何页面都生效（如 reset、滚动条），放这里 |
| `animations.css` | 只放 `@keyframes` 定义 | 动画的**定义**和**使用**分离，方便统一管理动效 |
| `layout.css` | 应用级骨架（不随页面切换变化） | 如果一个元素在多个页面之间共用（如顶栏、侧栏），放这里 |
| `components.css` | 可跨页面复用的组件样式 | 如果一个组件可能出现在不同页面（如按钮、对话框），放这里 |
| `pages/*.css` | **只属于某个页面**的样式 | 如果一段样式只服务于一个特定页面，单独建文件 |
| `responsive.css` | 所有媒体查询 | 响应式规则集中管理，避免散落各处难以追踪 |

### 3.2 为什么 `pages/` 是子目录？

- 当前 4 个页面，未来会持续增加
- 单文件超过 600 行后查找困难
- **每个页面独立一个文件**，新增页面只需"加文件 + 加引用"两步，无需改动既有文件

### 3.3 JS 拆分原则：**按功能模块**

- 每个页面一个 `.js` 文件，内部封装页面控制器
- 公共逻辑（工具、存储、组件）单独抽出
- `main.js` 是唯一的入口，负责协调各模块

---

## 四、维护与更新规范

### 4.1 新增一个页面

假设要加一个"统计页"：

1. **CSS**：在 `css/pages/` 下新建 `stats.css`
2. **JS**：在 `js/` 下新建 `stats.js`，导出 `Stats` 对象
3. **HTML**：在 `index.html` 中：
   - `<main>` 内加 `<div class="page-view" id="page-stats"></div>`
   - `<head>` 加 `<link rel="stylesheet" href="css/pages/stats.css">`
   - `<body>` 末尾加 `<script src="js/stats.js"></script>`（在 `main.js` 之前）
4. **导航项**：在 `js/main.js` 的 `NAV_ITEMS` 数组追加一项

### 4.2 修改某个页面的样式

- **只改该页面** → 直接编辑 `css/pages/xxx.css`
- **涉及响应式** → 编辑 `css/responsive.css`（所有媒体查询集中在此）
- **涉及全局变量（颜色/间距）** → 编辑 `css/theme.css` 的 `:root`

### 4.3 修改动画

- 只改关键帧 → 编辑 `css/animations.css`
- **不要**把 `@keyframes` 写进页面文件，保持"定义与使用分离"

### 4.4 新增一个通用组件（如弹窗、卡片）

1. 样式写入 `css/components.css`
2. 工厂函数写入 `js/components.js`
3. 只在特定页面用的组件 → 放对应 `pages/xxx.css`

---

## 五、样式加载顺序（重要！）

`index.html` 中的 `<link>` 顺序决定了样式优先级，**不可随意调整**：

```
theme.css          → 先建立变量
↓
animations.css     → 动画定义（被后续引用）
↓
layout.css         → 骨架布局
↓
components.css     → 通用组件
↓
pages/*.css        → 页面专属（可覆盖前面的组件样式）
↓
responsive.css    → 响应式覆盖（最后加载，优先级最高）
```

**原则**：越具体的样式越靠后，响应式覆盖必须在最后。

---

## 六、命名约定

- **CSS 类名**：BEM 风格，使用连字符（`task-card`、`panel-header`）
- **CSS 变量**：`--分类-属性` 格式（`--gold-dim`、`--bg-surface`）
- **JS 模块**：每个文件导出一个同名对象（如 `Taskboard`、`Browser`）
- **页面 ID**：`page-{名称}`（如 `page-taskboard`、`page-settings`）

---

## 七、技术约束（硬性规则）

- ❌ **禁止使用构建工具**（无 Webpack/Vite，保持零依赖原生项目）
- ❌ **禁止在页面 CSS 中写 `@keyframes`**，统一放 `animations.css`
- ❌ **禁止在非 `responsive.css` 文件中写 `@media`**（除非是组件内部紧密耦合的局部覆盖）
- ✅ **新增样式优先复用 CSS 变量**，不要硬编码颜色值
- ✅ **JS 模块间通信通过 `main.js` 协调**，避免页面模块互相直接依赖

---

## 八、快速自检清单

修改样式前问自己三个问题：

1. **这段样式是哪个层面的？**（全局？组件？页面？响应式？）→ 决定放哪个文件
2. **有没有现成的 CSS 变量可以用？** → 避免硬编码
3. **这个修改会影响其他页面吗？** → 如果会，考虑是否应该抽到更高层级
