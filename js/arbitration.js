const Arbitration = {
  _state: {
    isLoaded: false,
    isDataReady: false,
    autoAddEnabled: true,
  },

  _els: {},
  _timerInterval: null,

  init(container) {
    container.innerHTML = `
      <div class="arbitration-page">
        <div class="arbi-header page-header" id="arbi-header">
          <div class="header-row">
            <button class="nav-trigger-inline" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
              <span class="material-icons mi-md">dashboard</span>
            </button>
            <div>
              <div class="page-brand-title">WARFRAME</div>
              <div class="page-brand-sub">ARBITRATION / 仲裁任务</div>
            </div>
            <div class="page-spacer"></div>
            <button class="wf-btn" id="arbi-settings-btn" title="设置">
              <span class="material-icons mi-sm">settings</span>
            </button>
          </div>
        </div>

        <div class="arbi-content" id="arbi-content">
          <div class="arbi-loading" id="arbi-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载仲裁数据...</div>
          </div>

          <div class="arbi-main" id="arbi-main" style="display:none;">
            <div class="wf-card gold flow arbi-current-card" id="arbi-current" style="--card-chamfer:14px"></div>

            <div class="arbi-section">
              <div class="arbi-section-title">
                <span class="material-icons">schedule</span>
                <span id="arbi-hv-title">今日高价值任务</span>
                <span class="wf-chip arbi-badge" id="arbi-hv-count"></span>
              </div>
              <div class="arbi-hv-list" id="arbi-hv-list"></div>
            </div>

            <div class="arbi-section">
              <div class="arbi-section-title">
                <span class="material-icons">timer</span>
                <span>未来 12 小时</span>
              </div>
              <div class="arbi-upcoming-list" id="arbi-upcoming"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._els.container = container;
    this._els.loading = document.getElementById('arbi-loading');
    this._els.main = document.getElementById('arbi-main');
    this._els.current = document.getElementById('arbi-current');
    this._els.hvList = document.getElementById('arbi-hv-list');
    this._els.hvCount = document.getElementById('arbi-hv-count');
    this._els.upcoming = document.getElementById('arbi-upcoming');
    this._els.settingsBtn = document.getElementById('arbi-settings-btn');
    this._els.countdown = null;

    this._state.autoAddEnabled = this._loadAutoAddSetting();
    this._updateHvTitle();

    this._els.settingsBtn.addEventListener('click', () => this._openSettingsDialog());

    this._state.isLoaded = true;
    this._loadData();
  },

  _loadAutoAddSetting() {
    const val = localStorage.getItem('wf_arbi_auto_add');
    return val === null ? true : val === 'true';
  },

  _saveAutoAddSetting(enabled) {
    this._state.autoAddEnabled = enabled;
    localStorage.setItem('wf_arbi_auto_add', enabled ? 'true' : 'false');
    this._updateHvTitle();
  },

  _updateHvTitle() {
    const el = document.getElementById('arbi-hv-title');
    if (!el) return;
    el.textContent = this._state.autoAddEnabled ? '今日高价值任务（自动添加提醒）' : '今日高价值任务';
  },

  async _loadData() {
    const ok = await ArbiData.load();
    if (!ok) {
      this._els.loading.innerHTML = `
        <div class="loading-text" style="color: var(--danger);">数据加载失败</div>
        <div class="empty-desc" style="margin-top: 8px;">请检查网络连接后刷新页面</div>
      `;
      return;
    }

    this._state.isDataReady = true;
    this._els.loading.style.display = 'none';
    this._els.main.style.display = 'block';

    this._renderCurrent();
    this._renderHighValue();
    this._renderUpcoming();
    this._startTimer();

    this._checkAndAutoAddReminders();
  },

  _renderCurrent() {
    const current = ArbiData.getCurrentArbitration();
    if (!current) return;

    const now = Math.floor(Date.now() / 1000);
    const remainingMin = Math.ceil((current.endTime - now) / 60);
    const tierColor = ArbiData.getTierColor(current.tier);

    this._els.current.innerHTML = `
      <div class="arbi-current-label">当前仲裁</div>
      <div class="arbi-current-main">
        <div class="wf-chip arbi-current-icon" style="--card-accent: ${tierColor}; --card-accent-deep: color-mix(in srgb, ${tierColor} 40%, transparent); color: ${tierColor};">
          <span class="material-icons">gavel</span>
        </div>
        <div class="arbi-current-info">
          <div class="arbi-current-name">${current.name}</div>
          <div class="arbi-current-meta">
            <span class="wf-chip arbi-tag" style="--card-accent: ${tierColor}; --card-accent-deep: color-mix(in srgb, ${tierColor} 40%, transparent); --card-fill-tint: 12%; color: ${tierColor};"><span>${current.tier}</span></span>
            <span class="arbi-meta-item">${current.mission}</span>
            <span class="arbi-meta-dot">·</span>
            <span class="arbi-meta-item">${current.system}</span>
            <span class="arbi-meta-dot">·</span>
            <span class="arbi-meta-item">${current.faction}</span>
          </div>
          <div class="arbi-current-level">敌人等级：${current.minLevel} - ${current.maxLevel}</div>
        </div>
        <div class="arbi-current-countdown">
          <div class="countdown-label">剩余</div>
          <div class="countdown-value" id="arbi-countdown">${remainingMin} 分钟</div>
        </div>
      </div>
    `;
    this._els.countdown = document.getElementById('arbi-countdown');
  },

  _renderHighValue() {
    const hvList = ArbiData.getTodaysHighValueArbitrations();
    this._els.hvCount.innerHTML = `<span>${hvList.length}</span>`;

    if (hvList.length === 0) {
      this._els.hvList.innerHTML = `
        <div class="wf-card silver arbi-empty-tip" style="--card-chamfer:9px">
          <span class="material-icons">info_outline</span>
          <span>今日暂无高价值仲裁任务</span>
        </div>
      `;
      return;
    }

    clearEl(this._els.hvList);
    const now = Math.floor(Date.now() / 1000);

    hvList.forEach((item) => {
      const tierColor = ArbiData.getTierColor(item.tier);
      const isPast = now >= item.endTime;
      const isActive = now >= item.startTime && now < item.endTime;

      const card = document.createElement('div');
      card.className = 'wf-card silver arbi-hv-card';
      if (isPast) card.classList.add('past');
      if (isActive) { card.classList.add('active', 'flow'); }

      card.innerHTML = `
        <div class="arbi-hv-time">
          <span class="time-start">${ArbiData.formatTime(item.startTime)}</span>
          <span class="time-arrow">→</span>
          <span class="time-end">${ArbiData.formatTime(item.endTime)}</span>
        </div>
        <div class="arbi-hv-info">
          <div class="arbi-hv-name">${item.name}</div>
          <div class="arbi-hv-meta">
            <span class="wf-chip arbi-tag small" style="--card-accent: ${tierColor}; --card-accent-deep: color-mix(in srgb, ${tierColor} 40%, transparent); --card-fill-tint: 12%; color: ${tierColor};"><span>${item.tier}</span></span>
            <span class="arbi-meta-item small">${item.mission}</span>
            <span class="arbi-meta-dot">·</span>
            <span class="arbi-meta-item small">${item.system}</span>
          </div>
        </div>
        <div class="wf-chip arbi-hv-status" data-status="${isPast ? 'past' : isActive ? 'active' : 'upcoming'}">
          <span>${isPast ? '已结束' : isActive ? '进行中' : '待开始'}</span>
        </div>
      `;

      this._els.hvList.appendChild(card);
    });
  },

  _renderUpcoming() {
    const upcoming = ArbiData.getUpcomingArbitrations(12);
    clearEl(this._els.upcoming);

    upcoming.forEach((item) => {
      const tierColor = ArbiData.getTierColor(item.tier);
      const isHv = ArbiData.isHighValue(item.tier);

      const row = document.createElement('div');
      row.className = isHv ? 'wf-card gold arbi-upcoming-row high-value' : 'arbi-upcoming-row';

      row.innerHTML = `
        <div class="arbi-upcoming-time">${ArbiData.formatTime(item.startTime)}</div>
        <div class="arbi-upcoming-dot" style="background: ${tierColor};"></div>
        <div class="arbi-upcoming-name">${item.name}</div>
        <div class="arbi-upcoming-meta">
          <span class="wf-chip arbi-tag tiny" style="--card-accent: ${tierColor}; --card-accent-deep: color-mix(in srgb, ${tierColor} 40%, transparent); --card-fill-tint: 12%; color: ${tierColor};"><span>${item.tier}</span></span>
          <span>${item.mission}</span>
          <span class="arbi-meta-dot">·</span>
          <span>${item.system}</span>
        </div>
      `;

      this._els.upcoming.appendChild(row);
    });
  },

  _startTimer() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => this._onTick(), 1000);
  },

  _onTick() {
    if (!this._state.isDataReady) return;

    const now = Math.floor(Date.now() / 1000);
    const current = ArbiData.getCurrentArbitration();

    if (current) {
      const remainingSec = current.endTime - now;
      if (this._els.countdown) {
        if (remainingSec > 3600) {
          const h = Math.floor(remainingSec / 3600);
          const m = Math.floor((remainingSec % 3600) / 60);
          this._els.countdown.textContent = `${h}时${m}分`;
        } else if (remainingSec > 60) {
          this._els.countdown.textContent = `${Math.ceil(remainingSec / 60)} 分钟`;
        } else {
          this._els.countdown.textContent = `${remainingSec} 秒`;
        }
      }

      if (remainingSec <= 0) {
        this._renderCurrent();
        this._renderHighValue();
        this._renderUpcoming();
      }
    }
  },

  _checkAndAutoAddReminders() {
    if (!this._state.autoAddEnabled) return;
    if (!this._state.isDataReady) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0];
    const lastAutoAdd = localStorage.getItem(ARBI_LAST_DAILY_AUTO_ADD_KEY);

    if (lastAutoAdd === todayKey) return;

    const hvList = ArbiData.getTodaysHighValueArbitrations();
    if (hvList.length === 0) {
      localStorage.setItem(ARBI_LAST_DAILY_AUTO_ADD_KEY, todayKey);
      return;
    }

    const now = Date.now();
    const existing = Store.loadReminders();

    let addedCount = 0;

    hvList.forEach((item) => {
      const targetTime = item.startTime * 1000;

      if (now - targetTime > REMINDER_AUTO_DELETE_MS) return;

      const tempId = `arbi_temp_${item.startTime}`;
      if (existing.some(r => r.id === tempId)) return;

      existing.push({
        id: tempId,
        name: `${item.mission} - ${item.name}（临时）`,
        description: `${item.tier}级 · ${item.system} · ${item.faction} · 等级 ${item.minLevel}-${item.maxLevel}`,
        icon: 'gavel',
        accent: '#1a5cff',
        targetTime: new Date(targetTime).toISOString(),
        isCompleted: false,
        createdAt: new Date().toISOString(),
        isTemp: true,
        tempType: ARBI_TEMP_REMINDER_TAG,
        arbiNodeKey: item.nodeKey,
        arbiTier: item.tier,
      });
      addedCount++;
    });

    if (addedCount > 0) {
      Store.saveReminders(existing);
      window.App?.reminder?.reloadFromStore();
      showSnackbar(`已自动添加 ${addedCount} 个仲裁任务提醒`);
    }

    localStorage.setItem(ARBI_LAST_DAILY_AUTO_ADD_KEY, todayKey);
  },

  _openSettingsDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const box = document.createElement('div');
    box.className = 'wf-card gold dialog-box';

    const header = document.createElement('div');
    header.className = 'dialog-header';
    const bar = document.createElement('div');
    bar.className = 'bar';
    header.appendChild(bar);
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = '仲裁设置';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wf-chip silver dialog-close';
    closeBtn.innerHTML = '<span>&#10005;</span>';
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    box.appendChild(header);

    box.appendChild(dividerEl());

    const body = document.createElement('div');
    body.className = 'dialog-body';

    const settingRow = document.createElement('div');
    settingRow.className = 'arbi-setting-row';
    settingRow.innerHTML = `
      <div class="arbi-setting-info">
        <div class="arbi-setting-title">每日自动添加高价值提醒</div>
        <div class="arbi-setting-desc">每天 0 点自动将 S/A+/A/A- 级仲裁任务添加到提醒列表，30分钟后自动删除</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="arbi-auto-add-toggle" ${this._state.autoAddEnabled ? 'checked' : ''}>
        <div class="toggle-track">
          <svg viewBox="0 0 50 22" preserveAspectRatio="none">
            <path class="border-bright" d="M 0.5 0.5 L 44.5 0.5 L 49.5 5.5 L 49.5 21.5 L 5.5 21.5 L 0.5 16.5 Z" />
            <path class="border-flow-path" d="M 0.5 0.5 L 44.5 0.5 L 49.5 5.5" />
            <path class="border-flow-path" d="M 0.5 16.5 L 5.5 21.5 L 49.5 21.5" />
          </svg>
          <div class="toggle-inner"><div class="toggle-handle"></div></div>
        </div>
      </label>
    `;
    body.appendChild(settingRow);

    body.appendChild(sizedBox(8));

    const dataRow = document.createElement('div');
    dataRow.className = 'arbi-setting-row';
    dataRow.innerHTML = `
      <div class="arbi-setting-info">
        <div class="arbi-setting-title">刷新仲裁数据</div>
        <div class="arbi-setting-desc">数据来源：arbi.wf.wiki，缓存有效期 24 小时</div>
      </div>
      <button class="wf-btn" id="arbi-refresh-btn">刷新</button>
    `;
    body.appendChild(dataRow);

    box.appendChild(body);
    box.appendChild(dividerEl());

    const footer = document.createElement('div');
    footer.className = 'dialog-footer';
    footer.appendChild(createBtn({
      text: '关闭',
      primary: true,
      onClick: close,
    }));
    box.appendChild(footer);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const toggle = document.getElementById('arbi-auto-add-toggle');
    toggle.addEventListener('change', (e) => {
      this._saveAutoAddSetting(e.target.checked);
    });

    const refreshBtn = document.getElementById('arbi-refresh-btn');
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '刷新中...';
      try {
        localStorage.removeItem(ARBI_DATA_CACHE_KEY);
        const ok = await ArbiData.load();
        if (ok) {
          this._renderCurrent();
          this._renderHighValue();
          this._renderUpcoming();
          showSnackbar('数据已刷新');
        } else {
          showSnackbar('刷新失败');
        }
      } catch (e) {
        showSnackbar('刷新失败');
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '刷新';
      }
    });

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  },

  reloadFromStore() {
    this._checkAndAutoAddReminders();
  },
};
