/**
 * settings.js — 设置页面逻辑
 *
 * 功能：
 *   导出：将日常/周常任务序列化为 JSON 并下载为 .json 文件
 *   导入：读取用户选择的 .json 文件，校验格式后覆写本地数据
 */

const Settings = {
  _els: {},

  init(container) {
    container.innerHTML = `
      <div class="settings-page">
        <div class="settings-header page-header">
          <div class="settings-title-area">
            <button class="nav-trigger-inline" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
              <span class="material-icons mi-md">dashboard</span>
            </button>
            <div class="settings-title-bar"></div>
            <span class="material-icons settings-title-icon">settings</span>
            <span class="settings-label">SETTINGS</span>
            <div class="page-spacer"></div>
          </div>
          <div class="settings-heading">设置</div>
        </div>

        <div class="settings-cards">
          <!-- 仲裁自动提醒设置卡片 -->
          <div class="wf-card silver settings-card" style="--card-chamfer:11px">
            <div class="wf-chip yellow settings-card-icon">
              <span class="material-icons">auto_fix_high</span>
            </div>
            <div class="settings-card-body">
              <div class="settings-card-title">每日自动添加高价值提醒</div>
              <div class="settings-card-desc">
                每天 0 点自动将 S/A+/A/A- 级仲裁任务添加到提醒列表，30分钟后自动删除。
              </div>
            </div>
            <label class="toggle-switch" id="settings-arbi-auto-toggle">
              <input type="checkbox" id="settings-arbi-auto-input">
              <div class="toggle-track">
                <svg viewBox="0 0 50 22" preserveAspectRatio="none">
                  <path class="border-bright" d="M 0.5 0.5 L 44.5 0.5 L 49.5 5.5 L 49.5 21.5 L 5.5 21.5 L 0.5 16.5 Z" />
                  <path class="border-flow-path" d="M 0.5 0.5 L 44.5 0.5 L 49.5 5.5" />
                  <path class="border-flow-path" d="M 0.5 16.5 L 5.5 21.5 L 49.5 21.5" />
                </svg>
                <div class="toggle-inner"><div class="toggle-handle"></div></div>
              </div>
            </label>
          </div>

          <!-- 导出卡片 -->
          <div class="wf-card silver settings-card" style="--card-chamfer:11px">
            <div class="wf-chip gold settings-card-icon">
              <span class="material-icons">download</span>
            </div>
            <div class="settings-card-body">
              <div class="settings-card-title">导出任务数据</div>
              <div class="settings-card-desc">
                将日常和周常任务保存为 JSON 文件，方便备份或在其他设备上导入。
              </div>
            </div>
            <button class="wf-btn primary" id="settings-export-btn">
              <span class="material-icons mi-sm">download</span>
              <span>导出</span>
            </button>
          </div>

          <!-- 导入卡片 -->
          <div class="wf-card silver settings-card" style="--card-chamfer:11px">
            <div class="wf-chip blue settings-card-icon">
              <span class="material-icons">upload</span>
            </div>
            <div class="settings-card-body">
              <div class="settings-card-title">导入任务数据</div>
              <div class="settings-card-desc">
                读取之前导出的 JSON 备份文件，恢复任务列表。将 <strong>覆盖</strong> 当前所有任务数据。
              </div>
            </div>
            <button class="wf-btn blue" id="settings-import-btn">
              <span class="material-icons mi-sm">upload</span>
              <span>导入</span>
            </button>
            <input type="file" id="settings-file-input" accept=".json" style="display:none;" />
          </div>
        </div>
      </div>
    `;

    this._els.container = container;
    this._els.exportBtn = document.getElementById('settings-export-btn');
    this._els.importBtn = document.getElementById('settings-import-btn');
    this._els.fileInput = document.getElementById('settings-file-input');
    this._els.arbiAutoInput = document.getElementById('settings-arbi-auto-input');

    // 读取仲裁自动添加设置（默认开启）
    const arbiAutoAdd = localStorage.getItem('wf_arbi_auto_add');
    this._els.arbiAutoInput.checked = arbiAutoAdd === null ? true : arbiAutoAdd === 'true';

    this._bindEvents();
  },

  _bindEvents() {
    // 导出
    this._els.exportBtn.addEventListener('click', () => {
      this._exportData();
    });

    // 导入 — 点击按钮触发隐藏的 file input
    this._els.importBtn.addEventListener('click', () => {
      this._els.fileInput.click();
    });

    // 导入 — 选择文件后处理
    this._els.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      this._importData(file);
      // 重置 input 以便可重复选择同一文件
      this._els.fileInput.value = '';
    });

    // 仲裁自动添加提醒开关
    this._els.arbiAutoInput.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('wf_arbi_auto_add', enabled ? 'true' : 'false');
      // 同步仲裁页内部状态
      if (window.App && window.App.arbitration) {
        window.App.arbitration._state.autoAddEnabled = enabled;
        window.App.arbitration._updateHvTitle();
      }
    });
  },

  // =============================================================
  // 导出
  // =============================================================

  _exportData() {
    const dailyTasks = Store.loadDailyTasks();
    const weeklyTasks = Store.loadWeeklyTasks();
    const reminders = Store.loadReminders();
    const arbiAutoAdd = localStorage.getItem('wf_arbi_auto_add');

    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      dailyTasks,
      weeklyTasks,
      reminders,
      settings: {
        arbiAutoAdd: arbiAutoAdd === null ? null : arbiAutoAdd === 'true',
      },
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `warframe-taskboard-${formatDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSnackbar('数据已导出');
  },

  // =============================================================
  // 导入
  // =============================================================

  async _importData(file) {
    // 读取文件内容
    let text;
    try {
      text = await file.text();
    } catch (e) {
      showSnackbar('文件读取失败');
      return;
    }

    // 解析 JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      showSnackbar('文件格式错误，不是有效的 JSON');
      return;
    }

    // 校验结构
    if (!data || ![1, 2, 3].includes(data.version) || !Array.isArray(data.dailyTasks) || !Array.isArray(data.weeklyTasks)) {
      showSnackbar('文件格式不匹配，不是有效的 Warframe Taskboard 备份');
      return;
    }

    // 校验每项任务的基本字段
    const validTask = (t) =>
      typeof t.id === 'string' &&
      typeof t.name === 'string' &&
      typeof t.isCompleted === 'boolean';

    if (!data.dailyTasks.every(validTask) || !data.weeklyTasks.every(validTask)) {
      showSnackbar('备份文件中存在无效的任务数据');
      return;
    }

    // 校验提醒数据（v2+ 才有）
    const validReminder = (r) =>
      typeof r.id === 'string' &&
      typeof r.name === 'string' &&
      typeof r.targetTime === 'string' &&
      typeof r.isCompleted === 'boolean';

    const hasReminders = data.version >= 2 && Array.isArray(data.reminders);
    if (hasReminders && !data.reminders.every(validReminder)) {
      showSnackbar('备份文件中存在无效的提醒数据');
      return;
    }

    // 确认对话框
    const reminderCount = hasReminders ? data.reminders.length : 0;
    const reminderText = reminderCount > 0 ? `和 ${reminderCount} 个提醒事项` : '';
    const confirmed = await this._confirmDialog(
      '导入确认',
      `即将覆盖当前 ${data.dailyTasks.length} 个日常任务和 ${data.weeklyTasks.length} 个周常任务${reminderText}。当前数据将丢失，是否继续？`
    );
    if (!confirmed) return;

    // 覆写数据
    Store.saveDailyTasks(data.dailyTasks);
    Store.saveWeeklyTasks(data.weeklyTasks);
    if (hasReminders) {
      Store.saveReminders(data.reminders);
    }

    if (data.version >= 3 && data.settings && typeof data.settings.arbiAutoAdd === 'boolean') {
      localStorage.setItem('wf_arbi_auto_add', data.settings.arbiAutoAdd ? 'true' : 'false');
    }

    // 通知刷新
    if (window.App) {
      if (window.App.taskboard) {
        window.App._reloadTaskboard();
      }
      if (window.App.reminder) {
        window.App._reloadReminder();
      }
      if (window.App.arbitration) {
        window.App._reloadArbitration();
      }
    }

    const reminderMsg = reminderCount > 0 ? ` + ${reminderCount} 提醒` : '';
    showSnackbar(`已导入 ${data.dailyTasks.length} 日常 + ${data.weeklyTasks.length} 周常${reminderMsg}`);
  },

  // =============================================================
  // 确认对话框
  // =============================================================

  _confirmDialog(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';

      const box = document.createElement('div');
      box.className = 'wf-card gold dialog-box';
      box.style.maxWidth = '420px';

      // 头部
      const header = document.createElement('div');
      header.className = 'dialog-header';
      const bar = document.createElement('div');
      bar.className = 'bar';
      header.appendChild(bar);
      const titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.textContent = title;
      header.appendChild(titleEl);
      box.appendChild(header);

      box.appendChild(dividerEl());

      // 消息体
      const body = document.createElement('div');
      body.className = 'dialog-body';
      body.style.padding = '24px 20px';
      const msg = document.createElement('p');
      msg.style.cssText = 'color:var(--text-secondary);font-size:14px;line-height:1.6;letter-spacing:0.5px;';
      msg.textContent = message;
      body.appendChild(msg);
      box.appendChild(body);

      box.appendChild(dividerEl());

      // 按钮
      const footer = document.createElement('div');
      footer.className = 'dialog-footer';

      const cancelBtn = createBtn({
        text: '取消',
        outline: true,
        onClick: () => { close(); resolve(false); },
      });
      footer.appendChild(cancelBtn);

      const confirmBtn = createBtn({
        text: '确认导入',
        primary: true,
        onClick: () => { close(); resolve(true); },
      });
      footer.appendChild(confirmBtn);

      box.appendChild(footer);
      overlay.appendChild(box);

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      function close() {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 200);
      }
    });
  },
};
