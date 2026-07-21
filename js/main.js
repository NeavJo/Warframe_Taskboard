/**
 * main.js — 应用主控制器
 * 对应 Flutter 版 AppShell
 *
 * 职责：初始化各模块、导航切换、状态同步、
 *       宽屏顶栏管理、浏览器控件渲染、
 *       窄屏抽屉侧栏管理
 */

(function () {
  'use strict';

  // =============================================================
  // 导航配置
  // =============================================================

  const NAV_ITEMS = [
    { label: '看板', icon: 'dashboard', activeIcon: 'dashboard', pageId: 'page-taskboard' },
    { label: '提醒', icon: 'notifications', activeIcon: 'notifications', pageId: 'page-reminder' },
    { label: '仲裁', icon: 'gavel', activeIcon: 'gavel', pageId: 'page-arbitration' },
    { label: '浏览器（wiki）', icon: 'public', activeIcon: 'public', pageId: 'page-browser' },
    { label: '设置', icon: 'settings', activeIcon: 'settings', pageId: 'page-settings' },
  ];

  // =============================================================
  // AppShell 状态
  // =============================================================

  const App = {
    _currentIndex: 0,
    _isManageMode: false,

    // DOM 引用
    _els: {},

    // 模块引用
    taskboard: null,
    reminder: null,
    arbitration: null,
    browser: null,

    // =============================================================
    // 启动
    // =============================================================

    async init() {
      // 动态视口高度：解决手机浏览器地址栏遮挡问题
      this._setupViewportHeight();

      // 缓存 DOM
      this._els.sidebarNav = document.getElementById('sidebar-nav');
      this._els.headerSubtitle = document.getElementById('header-subtitle');
      this._els.headerCenter = document.getElementById('header-center');
      this._els.wideDateText = document.getElementById('wide-date-text');
      this._els.wideCountdownText = document.getElementById('wide-countdown-text');
      this._els.wideManageBtn = document.getElementById('wide-manage-btn');
      this._els.wideReminderAddBtn = document.getElementById('wide-reminder-add-btn');
      this._els.pages = {
        taskboard: document.getElementById('page-taskboard'),
        reminder: document.getElementById('page-reminder'),
        arbitration: document.getElementById('page-arbitration'),
        browser: document.getElementById('page-browser'),
        settings: document.getElementById('page-settings'),
      };

      // 渲染宽屏侧栏
      this._renderSidebar();

      // 创建窄屏抽屉侧栏 + 浮动触发按钮
      this._createDrawer();

      // 初始化看板页
      this.taskboard = Taskboard;
      await this.taskboard.init(this._els.pages.taskboard, this._isManageMode);

      // 初始化提醒页
      this.reminder = Reminder;
      this.reminder.init(this._els.pages.reminder);

      // 初始化仲裁页
      this.arbitration = Arbitration;
      this.arbitration.init(this._els.pages.arbitration);

      // 初始化浏览器页
      this.browser = Browser;
      this.browser.init(this._els.pages.browser);

      // 初始化设置页
      Settings.init(this._els.pages.settings);

      // 绑定宽屏管理按钮
      this._els.wideManageBtn.addEventListener('click', () => {
        this._toggleManageMode();
      });

      // 绑定宽屏新增提醒按钮
      this._els.wideReminderAddBtn.addEventListener('click', () => {
        if (this.reminder) this.reminder._openAddDialog();
      });

      // 启动宽屏时钟
      this._startWideClock();

      // 初始激活看板页
      this._switchPage(0);
    },

    // =============================================================
    // 动态视口高度（手机浏览器地址栏自适应）
    // =============================================================

    _setupViewportHeight() {
      const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      setVh();
      window.addEventListener('resize', () => {
        // 窄屏才触发，宽屏不用
        if (window.innerWidth < 900) setVh();
      });
    },

    // =============================================================
  // 重新加载看板数据（导入后调用）
  // =============================================================

  _reloadTaskboard() {
    if (this.taskboard) {
      this.taskboard._state.dailyTasks = Store.loadDailyTasks();
      this.taskboard._state.weeklyTasks = Store.loadWeeklyTasks();
      this.taskboard._refreshPanels();
    }
  },

  // =============================================================
  // 重新加载提醒数据（导入后调用）
  // =============================================================

  _reloadReminder() {
    if (this.reminder) {
      this.reminder.reloadFromStore();
    }
  },

  _reloadArbitration() {
    if (this.arbitration) {
      this.arbitration.reloadFromStore();
    }
  },

    // =============================================================
    // 宽屏侧栏渲染
    // =============================================================

    _renderSidebar() {
      clearEl(this._els.sidebarNav);
      NAV_ITEMS.forEach((item, i) => {
        const btn = createBtn({
          icon: item.icon,
          text: item.label,
          active: i === this._currentIndex,
          className: 'sidebar-tile',
          onClick: () => this._switchPage(i),
        });
        this._els.sidebarNav.appendChild(btn);
      });
    },

    // =============================================================
    // 窄屏抽屉侧栏 + 浮动触发按钮
    // =============================================================

    _createDrawer() {
      // --- 遮罩层 ---
      const overlay = document.createElement('div');
      overlay.className = 'drawer-overlay';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeDrawer();
      });
      document.body.appendChild(overlay);
      this._els.drawerOverlay = overlay;

      // --- 抽屉面板 ---
      const panel = document.createElement('div');
      panel.className = 'drawer-panel';
      panel.innerHTML = `
        <div class="drawer-header">
          <div class="drawer-brand">WARFRAME</div>
          <div class="drawer-version">TASKBOARD</div>
        </div>
        <div class="drawer-nav" id="drawer-nav"></div>
        <div class="drawer-footer"></div>
      `;
      overlay.appendChild(panel);
      this._els.drawerPanel = panel;

      // 渲染抽屉导航项
      const drawerNav = document.getElementById('drawer-nav');
      NAV_ITEMS.forEach((item, i) => {
        const btn = createBtn({
          icon: item.icon,
          text: item.label,
          active: i === this._currentIndex,
          onClick: () => {
            this._switchPage(i);
            this.closeDrawer();
          },
        });
        drawerNav.appendChild(btn);
      });
      this._els.drawerNav = drawerNav;
    },

    openDrawer() {
      this._els.drawerOverlay.classList.add('open');
    },

    closeDrawer() {
      this._els.drawerOverlay.classList.remove('open');
    },

    // =============================================================
    // 页面切换
    // =============================================================

    _switchPage(index) {
      if (index === this._currentIndex || !NAV_ITEMS[index]) return;
      this._currentIndex = index;
      const item = NAV_ITEMS[index];

      // 切换页面可见性
      document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
      const targetPage = document.getElementById(item.pageId);
      if (targetPage) targetPage.classList.add('active');

      // 更新宽屏侧栏选中态
      Array.from(this._els.sidebarNav.children).forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
      });

      // 更新抽屉导航选中态
      if (this._els.drawerNav) {
        Array.from(this._els.drawerNav.children).forEach((btn, i) => {
          btn.classList.toggle('active', i === index);
        });
      }

      // 更新顶栏副标题
      this._els.headerSubtitle.textContent = `TASKBOARD / ${item.label}`;

      // 更新所有行内触发按钮的图标（与当前功能区匹配）
      document.querySelectorAll('.nav-trigger-inline .material-icons').forEach(el => {
        el.textContent = item.icon;
      });

      // 更新宽屏顶栏中间区域
      this._updateWideHeaderCenter(index);

      // 右上角主操作按钮互斥切换：看板页→管理，提醒页→新增提醒，其他页隐藏
      this._els.wideManageBtn.style.display = (index === 0) ? '' : 'none';
      this._els.wideReminderAddBtn.style.display = (index === 1) ? '' : 'none';
    },

    // =============================================================
    // 宽屏顶栏管理
    // =============================================================

    _updateWideHeaderCenter(index) {
      const center = this._els.headerCenter;
      clearEl(center);

      if (index === 0) {
        return;
      }

      if (index === 1) {
        return;
      }

      if (index === 3) {
        const template = document.getElementById('browser-controls-template');
        const clone = template.content.cloneNode(true);
        center.appendChild(clone);

        // 绑定控件事件
        const urlInput = document.getElementById('br-url-input');
        const reloadBtn = document.getElementById('br-reload-btn');
        const homeBtn = document.getElementById('br-home-btn');
        const siteTabs = document.getElementById('br-wide-site-tabs');

        if (urlInput) {
          urlInput.value = this.browser.getCurrentUrl();
          urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              this.browser.handleUrlSubmit(urlInput.value);
            }
          });
        }

        // 预设站点按钮（宽屏版）
        if (siteTabs) {
          clearEl(siteTabs);
          PRESET_SITES.forEach((site, i) => {
            const isIframe = site.iframe;
            const btn = createBtn({
              text: site.name,
              active: isIframe,
              onClick: () => {
                if (isIframe) {
                  this.browser._handleSiteClick(i);
                  if (urlInput) urlInput.value = site.url;
                } else {
                  window.open(site.url, '_blank');
                }
              },
            });
            btn.style.fontSize = '11px';
            if (!isIframe) btn.title = '在新标签页中打开';
            siteTabs.appendChild(btn);
          });
        }

        if (reloadBtn) reloadBtn.addEventListener('click', () => this.browser.reload());
        if (homeBtn) homeBtn.addEventListener('click', () => {
          this.browser.goHome();
          if (urlInput) urlInput.value = PRESET_SITES[IFRAME_SITE_INDEX].url;
        });
      }
    },

    // =============================================================
    // 管理模式同步
    // =============================================================

    _toggleManageMode() {
      this._isManageMode = !this._isManageMode;
      this.taskboard.setManageMode(this._isManageMode);
      this._els.wideManageBtn.textContent = this._isManageMode ? '管理中' : '管理';
      this._els.wideManageBtn.classList.toggle('active', this._isManageMode);
    },

    // =============================================================
    // 宽屏时钟
    // =============================================================

    _startWideClock() {
      const update = () => {
        const now = new Date();
        this._els.wideDateText.textContent = formatDate(now);
        this._els.wideCountdownText.textContent = countdownText(now);
      };
      update();
      setInterval(update, 1000);
    },
  };

  // =============================================================
  // 启动应用
  // =============================================================

  document.addEventListener('DOMContentLoaded', () => {
    App.init().catch(console.error);
  });

  // 暴露给 settings.js 用于导入后刷新看板
  window.App = App;
})();
