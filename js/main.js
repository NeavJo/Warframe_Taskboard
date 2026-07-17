/**
 * main.js — 应用主控制器
 * 对应 Flutter 版 AppShell
 *
 * 职责：初始化各模块、导航切换、状态同步、
 *       宽屏顶栏管理、浏览器控件渲染
 */

(function () {
  'use strict';

  // =============================================================
  // 导航配置
  // =============================================================

  const NAV_ITEMS = [
    { label: '看板', icon: 'dashboard', activeIcon: 'dashboard', pageId: 'page-taskboard' },
    { label: '浏览器', icon: 'public', activeIcon: 'public', pageId: 'page-browser' },
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
    browser: null,

    // =============================================================
    // 启动
    // =============================================================

    async init() {
      // 缓存 DOM
      this._els.sidebarNav = document.getElementById('sidebar-nav');
      this._els.bottomNav = document.getElementById('bottom-nav-inner');
      this._els.headerSubtitle = document.getElementById('header-subtitle');
      this._els.headerCenter = document.getElementById('header-center');
      this._els.wideDateText = document.getElementById('wide-date-text');
      this._els.wideCountdownText = document.getElementById('wide-countdown-text');
      this._els.wideManageBtn = document.getElementById('wide-manage-btn');
      this._els.pages = {
        taskboard: document.getElementById('page-taskboard'),
        browser: document.getElementById('page-browser'),
        settings: document.getElementById('page-settings'),
      };

      // 渲染侧栏和底栏导航
      this._renderSidebar();
      this._renderBottomNav();

      // 初始化看板页
      this.taskboard = Taskboard;
      await this.taskboard.init(this._els.pages.taskboard, this._isManageMode);

      // 初始化浏览器页
      this.browser = Browser;
      this.browser.init(this._els.pages.browser);

      // 初始化设置页
      Settings.init(this._els.pages.settings);

      // 绑定宽屏管理按钮
      this._els.wideManageBtn.addEventListener('click', () => {
        this._toggleManageMode();
      });

      // 启动宽屏时钟
      this._startWideClock();

      // 初始激活看板页
      this._switchPage(0);
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
    // 导航渲染
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

    _renderBottomNav() {
      clearEl(this._els.bottomNav);
      NAV_ITEMS.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.className = 'bottom-nav-item' + (i === this._currentIndex ? ' active' : '');
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons';
        iconSpan.textContent = i === this._currentIndex ? item.activeIcon : item.icon;
        iconSpan.style.fontSize = '22px';
        btn.appendChild(iconSpan);
        const label = document.createElement('span');
        label.textContent = item.label;
        btn.appendChild(label);
        btn.addEventListener('click', () => this._switchPage(i));
        this._els.bottomNav.appendChild(btn);
      });
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

      // 更新侧栏选中态
      Array.from(this._els.sidebarNav.children).forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
      });

      // 更新底栏选中态
      Array.from(this._els.bottomNav.children).forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
      });

      // 更新顶栏副标题
      this._els.headerSubtitle.textContent = `TASKBOARD / ${item.label}`;

      // 更新宽屏顶栏中间区域
      this._updateWideHeaderCenter(index);
    },

    // =============================================================
    // 宽屏顶栏管理
    // =============================================================

    _updateWideHeaderCenter(index) {
      const center = this._els.headerCenter;
      clearEl(center);

      if (index === 0) {
        // 看板页：右侧已经显示日期+倒计时+管理按钮
        return;
      }

      if (index === 1) {
        // 浏览器页：渲染浏览器控件
        const template = document.getElementById('browser-controls-template');
        const clone = template.content.cloneNode(true);
        center.appendChild(clone);

        // 绑定控件事件
        const urlInput = document.getElementById('br-url-input');
        const reloadBtn = document.getElementById('br-reload-btn');
        const homeBtn = document.getElementById('br-home-btn');
        const siteTabs = document.getElementById('br-wide-site-tabs');

        if (urlInput) {
          // 初始加载 URL
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
              accent: site.accent === '#FFD84D' ? 'yellow' : site.accent === '#D4AF37' ? 'gold' : 'blue',
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
          if (urlInput) urlInput.value = PRESET_SITES[this.browser.getCurrentSite()].url;
        });

        // 隐藏右侧的日期+管理区域
        const headerRight = document.getElementById('header-right');
        if (headerRight) {
          // 浏览器页不需要右侧的日期和管理按钮，但为了布局对称保留占位
          // 不处理亦不影响
        }
      }
    },

    // =============================================================
    // 管理模式同步
    // =============================================================

    _toggleManageMode() {
      this._isManageMode = !this._isManageMode;
      // 更新看板页
      this.taskboard.setManageMode(this._isManageMode);
      // 更新宽屏管理按钮文字
      this._els.wideManageBtn.textContent = this._isManageMode ? '管理中' : '管理';
      if (this._isManageMode) this._els.wideManageBtn.classList.add('active');
      else this._els.wideManageBtn.classList.remove('active');
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
