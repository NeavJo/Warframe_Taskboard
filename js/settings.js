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

          <!-- 云端同步设置卡片 -->
          <div class="wf-card silver settings-card sync-card" style="--card-chamfer:11px" id="settings-sync-card">
            <div class="sync-card-head">
              <div class="wf-chip gold settings-card-icon">
                <span class="material-icons">cloud_sync</span>
              </div>
              <div class="settings-card-body">
                <div class="settings-card-title">云端同步（GitHub Gist）</div>
                <div class="settings-card-desc">
                  通过 GitHub Gist 实现多端数据同步，修改后 4 秒自动上传，切回前台自动拉取。
                </div>
              </div>
            </div>
            <div class="sync-form">
              <div class="sync-field">
                <span class="sync-field-label">GITHUB TOKEN</span>
                <div class="sync-field-wrap">
                  <input type="password" class="sync-field-input" id="sync-token-input" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
                  <span class="sync-toggle-visibility" id="sync-token-toggle">
                    <span class="material-icons">visibility</span>
                  </span>
                </div>
              </div>
              <div class="sync-field">
                <span class="sync-field-label">GIST ID</span>
                <div class="sync-field-wrap">
                  <input type="text" class="sync-field-input" id="sync-gist-input" placeholder="a1b2c3d4e5f6..." autocomplete="off" />
                </div>
              </div>
              <div class="sync-status" id="sync-status">
                <span class="sync-status-dot"></span>
                <span class="sync-status-text" id="sync-status-text">未配置</span>
              </div>
              <div class="sync-btns">
                <button class="wf-btn outline" id="sync-upload-btn">
                  <span class="material-icons mi-sm">upload</span>
                  <span>立即上传</span>
                </button>
                <button class="wf-btn" id="sync-download-btn">
                  <span class="material-icons mi-sm">download</span>
                  <span>立即拉取</span>
                </button>
                <button class="wf-icon-btn wf-btn" id="sync-tutorial-btn" title="使用教程">
                  <span class="material-icons mi-sm">help_outline</span>
                </button>
              </div>
            </div>
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

    // 云端同步相关 DOM
    this._els.syncTokenInput = document.getElementById('sync-token-input');
    this._els.syncGistInput = document.getElementById('sync-gist-input');
    this._els.syncTokenToggle = document.getElementById('sync-token-toggle');
    this._els.syncUploadBtn = document.getElementById('sync-upload-btn');
    this._els.syncDownloadBtn = document.getElementById('sync-download-btn');
    this._els.syncTutorialBtn = document.getElementById('sync-tutorial-btn');
    this._els.syncStatus = document.getElementById('sync-status');
    this._els.syncStatusText = document.getElementById('sync-status-text');

    // 读取仲裁自动添加设置（默认开启）
    const arbiAutoAdd = Store.loadArbiAutoAdd();
    this._els.arbiAutoInput.checked = arbiAutoAdd;

    // 读取同步配置
    this._loadSyncConfig();

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
      // 委托给仲裁模块统一处理（含删除/添加临时提醒逻辑）
      if (window.App && window.App.arbitration) {
        window.App.arbitration._saveAutoAddSetting(enabled);
      } else {
        Store.saveArbiAutoAdd(enabled);
      }
    });

    // 云端同步：Token 输入保存
    this._els.syncTokenInput.addEventListener('change', () => {
      GistSync.setConfig({ token: this._els.syncTokenInput.value.trim() });
      this._updateSyncStatus();
    });

    // 云端同步：Gist ID 输入保存
    this._els.syncGistInput.addEventListener('change', () => {
      GistSync.setConfig({ gistId: this._els.syncGistInput.value.trim() });
      this._updateSyncStatus();
    });

    // 云端同步：Token 可见性切换
    this._els.syncTokenToggle.addEventListener('click', () => {
      const input = this._els.syncTokenInput;
      const icon = this._els.syncTokenToggle.querySelector('.material-icons');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    });

    // 云端同步：立即上传
    this._els.syncUploadBtn.addEventListener('click', () => {
      this._handleSyncUpload();
    });

    // 云端同步：立即拉取
    this._els.syncDownloadBtn.addEventListener('click', () => {
      this._handleSyncDownload();
    });

    // 云端同步：使用教程
    this._els.syncTutorialBtn.addEventListener('click', () => {
      this._openSyncTutorial();
    });

    // 云端同步：监听上传成功事件
    if (typeof GistSync !== 'undefined') {
      GistSync.onUpload(timestamp => {
        this._updateUploadStatus(timestamp);
      });
    }
  },

  // =============================================================
  // 云端同步配置
  // =============================================================

  _loadSyncConfig() {
    if (typeof GistSync === 'undefined') return;
    const cfg = GistSync.getConfig();
    this._els.syncTokenInput.value = cfg.token;
    this._els.syncGistInput.value = cfg.gistId;
    this._updateSyncStatus();
  },

  _updateSyncStatus() {
    if (!GistSync || !this._els.syncStatus) return;
    const configured = GistSync.isConfigured();
    const lastSync = GistSync.getLastSyncTime();

    this._els.syncStatus.className = 'sync-status' + (configured ? ' configured' : '');
    if (!configured) {
      this._els.syncStatusText.textContent = '未配置';
    } else if (lastSync > 0) {
      const date = new Date(lastSync);
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      this._els.syncStatusText.textContent = `已同步 · ${hh}:${mm}`;
    } else {
      this._els.syncStatusText.textContent = '已配置 · 尚未同步';
    }
  },

  _updateUploadStatus(timestamp) {
    if (!this._els.syncStatus || !this._els.syncStatusText) return;
    const date = new Date(timestamp);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    this._els.syncStatus.className = 'sync-status configured';
    this._els.syncStatusText.textContent = `已上传 · ${hh}:${mm}`;
  },

  _setSyncStatus(kind, text) {
    if (!this._els.syncStatus) return;
    this._els.syncStatus.className = 'sync-status ' + kind;
    this._els.syncStatusText.textContent = text;
  },

  async _handleSyncUpload() {
    if (!GistSync.isConfigured()) {
      showSnackbar('请先配置 Token 和 Gist ID');
      return;
    }
    this._setSyncStatus('syncing', '正在上传…');
    const result = await GistSync.uploadNow();
    if (result && result.updatedAt) {
      showSnackbar('数据已上传至云端');
    } else {
      this._setSyncStatus('error', '上传失败');
    }
  },

  async _handleSyncDownload() {
    if (!GistSync.isConfigured()) {
      showSnackbar('请先配置 Token 和 Gist ID');
      return;
    }
    this._setSyncStatus('syncing', '正在拉取…');
    try {
      const hasUpdate = await GistSync.checkAndSync(() => {
        // 拉取成功后刷新所有页面
        if (window.App) {
          window.App.reloadAll();
        }
      });
      if (hasUpdate) {
        this._updateSyncStatus();
        showSnackbar('已从云端同步最新数据');
      } else {
        this._updateSyncStatus();
        showSnackbar('本地数据已是最新');
      }
    } catch (e) {
      this._setSyncStatus('error', '拉取失败');
      showSnackbar('拉取失败：' + (e.message || '未知错误'));
    }
  },

  // =============================================================
  // 同步教程弹窗
  // =============================================================

  _openSyncTutorial() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    document.body.appendChild(overlay);

    const box = document.createElement('div');
    box.className = 'wf-card gold dialog-box sync-tutorial-box';

    // 头部
    const header = document.createElement('div');
    header.className = 'dialog-header';
    const bar = document.createElement('div');
    bar.className = 'bar';
    header.appendChild(bar);
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = '云端同步使用教程';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wf-chip silver dialog-close';
    closeBtn.innerHTML = '<span>&#10005;</span>';
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    box.appendChild(header);

    // 分割线
    const div1 = document.createElement('div');
    div1.className = 'dialog-divider';
    box.appendChild(div1);

    // 正文
    const body = document.createElement('div');
    body.className = 'dialog-body sync-tutorial-body';

    const steps = [
      {
        icon: 'vpn_key',
        title: '第一步：生成 GitHub Token',
        desc: '打开 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)，点击「Generate new token」，勾选 gist 权限，生成后复制。'
      },
      {
        icon: 'note_add',
        title: '第二步：创建 Gist',
        desc: '访问 gist.github.com，随便填个文件名和内容（如 test.json），点击「Create secret gist」或「Create public gist」，复制 URL 中那串 ID。'
      },
      {
        icon: 'cloud_upload',
        title: '第三步：填入配置',
        desc: '将 Token 和 Gist ID 分别填入上方两个输入框，失焦自动保存。状态灯变绿即配置成功。'
      },
      {
        icon: 'sync',
        title: '同步机制说明',
        desc: '修改数据后 4 秒自动上传；切回前台自动拉取最新数据。以时间戳为准，永远以最新的为准。'
      }
    ];

    steps.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'sync-tutorial-step';

      const numBadge = document.createElement('div');
      numBadge.className = 'wf-chip gold sync-tutorial-num';
      numBadge.innerHTML = `<span>${i + 1}</span>`;
      row.appendChild(numBadge);

      const content = document.createElement('div');
      content.className = 'sync-tutorial-step-content';

      const stepTitle = document.createElement('div');
      stepTitle.className = 'sync-tutorial-step-title';
      stepTitle.innerHTML = `<span class="material-icons">${step.icon}</span><span>${step.title}</span>`;
      content.appendChild(stepTitle);

      const stepDesc = document.createElement('div');
      stepDesc.className = 'sync-tutorial-step-desc';
      stepDesc.textContent = step.desc;
      content.appendChild(stepDesc);

      row.appendChild(content);
      body.appendChild(row);
    });

    // 注意事项
    const notice = document.createElement('div');
    notice.className = 'sync-tutorial-notice';
    notice.innerHTML = `
      <span class="material-icons">info</span>
      <span>Token 仅保存在本地浏览器中，不会上传到任何服务器。Gist 的私密/公开取决于你创建时的选择。</span>
    `;
    body.appendChild(notice);

    box.appendChild(body);

    // 底部按钮
    const footer = document.createElement('div');
    footer.className = 'dialog-footer';
    const okBtn = document.createElement('button');
    okBtn.className = 'wf-btn primary';
    okBtn.textContent = '知道了';
    okBtn.addEventListener('click', close);
    footer.appendChild(okBtn);
    box.appendChild(footer);

    overlay.appendChild(box);

    // 动画显示
    requestAnimationFrame(() => {
      overlay.classList.add('open');
    });

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // ESC 关闭
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onEsc);
      }
    };
    document.addEventListener('keydown', onEsc);
  },

  // =============================================================
  // 导出
  // =============================================================

  _exportData() {
    const payload = Store.exportAll();

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
    if (!data || ![1, 2, 3, 4].includes(data.version) || !Array.isArray(data.dailyTasks) || !Array.isArray(data.weeklyTasks)) {
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

    // 校验便签数据（v4+ 才有）
    const validNote = (n) =>
      typeof n.id === 'string' &&
      typeof n.title === 'string' &&
      Array.isArray(n.items);

    const hasNotes = data.version >= 4 && Array.isArray(data.notes);
    if (hasNotes && !data.notes.every(validNote)) {
      showSnackbar('备份文件中存在无效的便签数据');
      return;
    }

    // 确认对话框
    const reminderCount = hasReminders ? data.reminders.length : 0;
    const notesCount = hasNotes ? data.notes.length : 0;
    const reminderText = reminderCount > 0 ? `和 ${reminderCount} 个提醒事项` : '';
    const notesText = notesCount > 0 ? `和 ${notesCount} 个便签` : '';
    const confirmed = await confirmDialog({
      title: '导入确认',
      message: `即将覆盖当前 ${data.dailyTasks.length} 个日常任务和 ${data.weeklyTasks.length} 个周常任务${reminderText}${notesText}。当前数据将丢失，是否继续？`,
      confirmText: '确认导入',
      danger: true,
    });
    if (!confirmed) return;

    // 覆写数据
    Store.importAll(data);

    // 通知刷新
    if (window.App) {
      window.App.reloadAll();
    }

    const reminderMsg = reminderCount > 0 ? ` + ${reminderCount} 提醒` : '';
    const notesMsg = notesCount > 0 ? ` + ${notesCount} 便签` : '';
    showSnackbar(`已导入 ${data.dailyTasks.length} 日常 + ${data.weeklyTasks.length} 周常${reminderMsg}${notesMsg}`);
  },
};
