/**
 * taskboard.js — 任务看板页面逻辑
 * 对应 Flutter 版 TaskboardPage
 *
 * 职责：任务 CRUD、完成切换、拖拽排序、重置检测、倒计时
 */

const Taskboard = {
  /** 内部状态 */
  _state: {
    dailyTasks: [],
    weeklyTasks: [],
    isManageMode: false,
    isLoaded: false,
    clockTimer: null,
  },

  /** DOM 引用 */
  _els: {},

  /** 面板对象引用（用于刷新） */
  _dailyPanel: null,
  _weeklyPanel: null,

  // =============================================================
  // 初始化
  // =============================================================

  async init(container, isManageMode) {
    this._state.isManageMode = isManageMode;

    // 填充 HTML 骨架
    container.innerHTML = `
      <div class="taskboard-page" id="taskboard-page">
        <!-- 窄屏头部 -->
        <div class="taskboard-header page-header" id="tb-header">
          <div class="header-row" id="tb-header-row">
            <button class="nav-trigger-inline" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
              <span class="material-icons mi-md">dashboard</span>
            </button>
            <div>
              <div class="page-brand-title">WARFRAME</div>
              <div class="page-brand-sub">TASKBOARD / 日常 · 周常 看板</div>
            </div>
            <div class="page-spacer"></div>
            <button class="wf-btn manage-btn" id="tb-manage-btn">管理</button>
          </div>
          <div class="header-meta" id="tb-header-meta">
            <div class="taskboard-meta-text" id="tb-date-text"></div>
            <div class="taskboard-countdown-text" id="tb-countdown-text"></div>
          </div>
        </div>

        <div class="taskboard-content" id="tb-content">
          <!-- 双栏布局 -->
          <div class="taskboard-two-col" id="tb-two-col">
            <div class="panel-wrapper" id="tb-daily-wrapper"></div>
            <div class="panel-wrapper" id="tb-weekly-wrapper"></div>
          </div>

          <!-- 单栏：TabBar + TabView -->
          <div class="taskboard-tabbar" id="tb-tabbar">
            <button class="tab-btn daily-tab active" data-tab="daily">日常 · DAILY</button>
            <button class="tab-btn weekly-tab" data-tab="weekly">周常 · WEEKLY</button>
          </div>
          <div class="taskboard-tab-view" id="tb-tab-view">
            <div class="tab-panel active" id="tab-daily"></div>
            <div class="tab-panel" id="tab-weekly"></div>
          </div>
        </div>

        <!-- 加载状态 -->
        <div class="loading-view" id="tb-loading">
          <div class="spinner"></div>
          <div class="loading-text">加载中…</div>
        </div>
      </div>
    `;

    // 缓存 DOM 引用
    this._els.container = container;
    this._els.tbPage = document.getElementById('taskboard-page');
    this._els.loading = document.getElementById('tb-loading');
    this._els.twoCol = document.getElementById('tb-two-col');
    this._els.tabbar = document.getElementById('tb-tabbar');
    this._els.tabView = document.getElementById('tb-tab-view');
    this._els.dateText = document.getElementById('tb-date-text');
    this._els.countdownText = document.getElementById('tb-countdown-text');
    this._els.manageBtn = document.getElementById('tb-manage-btn');
    this._els.dailyWrapper = document.getElementById('tb-daily-wrapper');
    this._els.weeklyWrapper = document.getElementById('tb-weekly-wrapper');
    this._els.tabDaily = document.getElementById('tab-daily');
    this._els.tabWeekly = document.getElementById('tab-weekly');

    // 绑定 Tab 切换
    const tabBtns = this._els.tabbar.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });

    // 管理按钮
    this._els.manageBtn.addEventListener('click', () => this._toggleManageMode());

    return this._bootstrap();
  },

  /**
   * 切换管理模式并同步按钮状态
   */
  _toggleManageMode() {
    this.setManageMode(!this._state.isManageMode);
  },

  // =============================================================
  // 启动引导（加载数据、检查重置）
  // =============================================================

  async _bootstrap() {
    // 加载数据
    this._state.dailyTasks = Store.loadDailyTasks();
    this._state.weeklyTasks = Store.loadWeeklyTasks();

    // 检查重置
    const changed = Store.checkAndPerformReset(
      this._state.dailyTasks,
      this._state.weeklyTasks
    );
    if (changed) {
      this._persist();
    }

    // 标记加载完成
    this._state.isLoaded = true;
    this._els.loading.style.display = 'none';

    // 渲染面板
    this._renderPanels();

    // 启动倒计时
    this._startClock();

    // 同步管理按钮状态
    this._syncManageBtn();
  },

  // =============================================================
  // 持久化
  // =============================================================

  _persist() {
    Store.saveDailyTasks(this._state.dailyTasks);
    Store.saveWeeklyTasks(this._state.weeklyTasks);
  },

  // =============================================================
  // 渲染面板
  // =============================================================

  _renderPanels() {
    const isManage = this._state.isManageMode;
    const S = this; // 避免 this 丢失

    // 创建日常面板
    const dailyOpts = {
      title: '每日日常',
      subtitle: 'DAILY',
      accent: '#FFD84D',
      tasks: this._state.dailyTasks,
      callbacks: {
        onToggle: (t) => S._toggleTask(t),
        onEdit: (t) => S._openEditDialog(t, true),
        onDelete: (t) => S._deleteTask(t, true),
        onAddTask: () => S._openAddDialog(true),
        onReorderItem: (from, to) => S._onReorder(from, to, true),
      },
      isManageMode: isManage,
    };

    // 创建周常面板
    const weeklyOpts = {
      title: '每周周常',
      subtitle: 'WEEKLY',
      accent: '#1FB6FF',
      tasks: this._state.weeklyTasks,
      callbacks: {
        onToggle: (t) => S._toggleTask(t),
        onEdit: (t) => S._openEditDialog(t, false),
        onDelete: (t) => S._deleteTask(t, false),
        onAddTask: () => S._openAddDialog(false),
        onReorderItem: (from, to) => S._onReorder(from, to, false),
      },
      isManageMode: isManage,
    };

    this._dailyPanel = createTaskPanel(dailyOpts, 0);
    this._weeklyPanel = createTaskPanel(weeklyOpts, 1);

    // 放至双栏
    clearEl(this._els.dailyWrapper);
    clearEl(this._els.weeklyWrapper);
    this._els.dailyWrapper.appendChild(this._dailyPanel);
    this._els.weeklyWrapper.appendChild(this._weeklyPanel);

    // 放至单栏 Tab
    clearEl(this._els.tabDaily);
    clearEl(this._els.tabWeekly);
    // 为 Tab 版创建独立面板（可复用面板数据但需独立 DOM）
    const dailyTabOpts = { ...dailyOpts, callbacks: { ...dailyOpts.callbacks } };
    const weeklyTabOpts = { ...weeklyOpts, callbacks: { ...weeklyOpts.callbacks } };
    this._els.tabDaily.appendChild(createTaskPanel(dailyTabOpts, 0));
    this._els.tabWeekly.appendChild(createTaskPanel(weeklyTabOpts, 1));
  },

  _refreshPanels() {
    this._renderPanels();
  },

  // =============================================================
  // 任务操作
  // =============================================================

  _toggleTask(task) {
    task.isCompleted = !task.isCompleted;
    this._persist();
    this._refreshPanels();
  },

  _deleteTask(task, isDaily) {
    const list = isDaily ? this._state.dailyTasks : this._state.weeklyTasks;
    const idx = list.findIndex(t => t.id === task.id);
    if (idx >= 0) list.splice(idx, 1);
    this._persist();
    this._refreshPanels();
  },

  _openAddDialog(isDaily) {
    const dialog = createTaskEditorDialog(null, isDaily, (result) => {
      const list = isDaily ? this._state.dailyTasks : this._state.weeklyTasks;
      list.push(result);
      this._persist();
      this._refreshPanels();
    });
    document.body.appendChild(dialog);
  },

  _openEditDialog(task, isDaily) {
    const dialog = createTaskEditorDialog(task, isDaily, (result) => {
      const list = isDaily ? this._state.dailyTasks : this._state.weeklyTasks;
      const idx = list.findIndex(t => t.id === task.id);
      if (idx >= 0) list[idx] = result;
      this._persist();
      this._refreshPanels();
    });
    document.body.appendChild(dialog);
  },

  _onReorder(from, to, isDaily) {
    const list = isDaily ? this._state.dailyTasks : this._state.weeklyTasks;
    const [task] = list.splice(from, 1);
    list.splice(to, 0, task);
    this._persist();
    this._refreshPanels();
  },

  // =============================================================
  // 倒计时时钟
  // =============================================================

  _startClock() {
    const update = () => {
      const now = new Date();
      this._els.dateText.textContent = formatDate(now);
      this._els.countdownText.textContent = countdownText(now);
    };
    update();
    this._state.clockTimer = setInterval(update, 1000);
  },

  _stopClock() {
    if (this._state.clockTimer) {
      clearInterval(this._state.clockTimer);
      this._state.clockTimer = null;
    }
  },

  // =============================================================
  // 外部控制
  // =============================================================

  setManageMode(enabled) {
    this._state.isManageMode = enabled;
    this._syncManageBtn();
    this._refreshPanels();
  },

  _syncManageBtn() {
    this._els.manageBtn.textContent = this._state.isManageMode ? '管理中' : '管理';
    this._els.manageBtn.classList.toggle('active', this._state.isManageMode);
  },
};
