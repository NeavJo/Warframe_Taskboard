/**
 * reminder.js — 定时提醒页面逻辑
 *
 * 性能优化：定时器只更新需要变化的文本节点和状态类，
 * 不再每秒完全重建 DOM。
 */

const REMINDER_AUTO_DELETE_MS = 30 * 60 * 1000;

const Reminder = {
  _state: {
    reminders: [],
    isLoaded: false,
  },

  _els: {},
  _timerInterval: null,
  _cardRefs: new Map(), // reminder.id → { card, statusEl, nameEl, checkBadge, iconBadge }

  init(container) {
    container.innerHTML = `
      <div class="reminder-page">
        <div class="reminder-header page-header" id="rm-header">
          <div class="header-row">
            <button class="nav-trigger-inline" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
              <span class="material-icons mi-md">dashboard</span>
            </button>
            <div>
              <div class="page-brand-title">WARFRAME</div>
              <div class="page-brand-sub">REMINDER / 定时提醒</div>
            </div>
            <div class="page-spacer"></div>
            <button class="wf-btn primary" id="rm-add-btn">
              <span class="material-icons mi-sm">add</span>
              <span>新增</span>
            </button>
          </div>
        </div>

        <div class="reminder-content" id="rm-content">
          <div class="reminder-list" id="rm-list"></div>
          <div class="reminder-empty" id="rm-empty" style="display:none;">
            <div class="empty-icon">
              <span class="material-icons">notifications_none</span>
            </div>
            <div class="empty-text">暂无提醒事项</div>
            <div class="empty-desc">点击右上角「新增」创建定时提醒</div>
          </div>
        </div>
      </div>
    `;

    this._els.container = container;
    this._els.list = document.getElementById('rm-list');
    this._els.empty = document.getElementById('rm-empty');
    this._els.addBtn = document.getElementById('rm-add-btn');

    this._state.reminders = Store.loadReminders();

    this._els.addBtn.addEventListener('click', () => this._openAddDialog());

    this._state.isLoaded = true;
    this._renderList();
    this._startTimer();
  },

  _persist() {
    Store.saveReminders(this._state.reminders);
  },

  // =============================================================
  // 渲染列表（仅首次/数据变更时调用，完整重建）
  // =============================================================

  _renderList() {
    // 先清理已过期的项
    const now = Date.now();
    const before = this._state.reminders.length;
    this._state.reminders = this._state.reminders.filter(r => {
      if (!r.isCompleted) return true;
      const targetTime = new Date(r.targetTime).getTime();
      return now - targetTime <= REMINDER_AUTO_DELETE_MS;
    });
    if (this._state.reminders.length !== before) this._persist();

    // 清空 DOM 和引用
    clearEl(this._els.list);
    this._cardRefs.clear();

    if (this._state.reminders.length === 0) {
      this._els.empty.style.display = 'flex';
      return;
    }
    this._els.empty.style.display = 'none';

    // 按状态排序：未完成在前，按时间升序
    const sorted = [...this._state.reminders].sort((a, b) => {
      if (a.isCompleted && !b.isCompleted) return 1;
      if (!a.isCompleted && b.isCompleted) return -1;
      return new Date(a.targetTime) - new Date(b.targetTime);
    });

    sorted.forEach(reminder => {
      const refs = this._createReminderCard(reminder);
      this._els.list.appendChild(refs.card);
      this._cardRefs.set(reminder.id, refs);
    });
  },

  // =============================================================
  // 创建提醒卡片（只创建一次，返回 DOM 引用）
  // =============================================================

  _createReminderCard(reminder) {
    const card = document.createElement('div');
    card.className = 'reminder-card';
    card.style.setProperty('--card-accent', reminder.accent);

    const iconBadge = document.createElement('div');
    iconBadge.className = 'icon-badge';
    iconBadge.appendChild(mi(reminder.icon || 'notifications'));
    card.appendChild(iconBadge);

    const info = document.createElement('div');
    info.className = 'reminder-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'reminder-name';
    nameEl.textContent = reminder.name;
    info.appendChild(nameEl);

    if (reminder.description) {
      const desc = document.createElement('div');
      desc.className = 'reminder-desc';
      desc.textContent = reminder.description;
      info.appendChild(desc);
    }

    const timeRow = document.createElement('div');
    timeRow.className = 'reminder-time-row';
    timeRow.appendChild(mi('schedule', 'time-icon'));

    const timeText = document.createElement('span');
    timeText.className = 'reminder-time-text';
    timeText.textContent = this._formatTargetTime(reminder.targetTime);
    timeRow.appendChild(timeText);

    const statusBadge = document.createElement('span');
    statusBadge.className = 'reminder-status';
    timeRow.appendChild(statusBadge);

    info.appendChild(timeRow);
    card.appendChild(info);

    const checkBadge = document.createElement('div');
    checkBadge.className = 'check-badge';
    card.appendChild(checkBadge);

    const delBtn = document.createElement('button');
    delBtn.className = 'reminder-delete';
    delBtn.title = '删除';
    delBtn.appendChild(mi('close'));
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._deleteReminder(reminder);
    });
    card.appendChild(delBtn);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.reminder-delete')) return;
      if (reminder.isCompleted) return;
      const now = Date.now();
      const targetTime = new Date(reminder.targetTime).getTime();
      if (now >= targetTime) {
        this._toggleComplete(reminder);
      }
    });

    const refs = { card, statusBadge, nameEl, checkBadge, iconBadge };
    this._updateCardState(reminder, refs);
    return refs;
  },

  // =============================================================
  // 更新单张卡片状态（只改文本和类名，不重建 DOM）
  // =============================================================

  _updateCardState(reminder, refs) {
    const { card, statusBadge, checkBadge, iconBadge } = refs;
    const now = Date.now();
    const targetTime = new Date(reminder.targetTime).getTime();
    const diffMs = targetTime - now;
    const isActive = !reminder.isCompleted && diffMs <= 0;

    // 更新卡片类
    card.classList.toggle('completed', reminder.isCompleted);
    card.classList.toggle('active', isActive);

    // 更新图标徽章类（视觉由 CSS 处理，无需手动设 style）
    iconBadge.className = 'icon-badge ' + (reminder.isCompleted ? 'done' : isActive ? 'active' : 'default');

    // 更新勾选徽章
    checkBadge.innerHTML = reminder.isCompleted ? '<span class="material-icons">check</span>' : '';

    // 更新状态标签
    if (reminder.isCompleted) {
      statusBadge.textContent = '已完成';
      statusBadge.className = 'reminder-status status-completed';
    } else if (isActive) {
      statusBadge.textContent = '已激活';
      statusBadge.className = 'reminder-status status-active';
    } else if (diffMs > 0) {
      statusBadge.textContent = this._formatCountdown(diffMs);
      statusBadge.className = 'reminder-status status-pending';
    } else {
      statusBadge.textContent = '已激活';
      statusBadge.className = 'reminder-status status-active';
    }
  },

  // =============================================================
  // 工具函数
  // =============================================================

  _formatTargetTime(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (isToday) return `今天 ${timeStr}`;
    if (isTomorrow) return `明天 ${timeStr}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
  },

  _formatCountdown(ms) {
    const totalSec = Math.floor(ms / 1000);
    if (totalSec <= 0) return '即将到达';

    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (days > 0) return `${days}天${hours}时`;
    if (hours > 0) return `${hours}时${minutes}分`;
    if (minutes > 0) return `${minutes}分${seconds}秒`;
    return `${seconds}秒`;
  },

  // =============================================================
  // 定时检测（只更新卡片状态，不重建 DOM）
  // =============================================================

  _startTimer() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => this._onTick(), 1000);
  },

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },

  _onTick() {
    if (!this._state.isLoaded) return;

    const now = Date.now();

    // 单次过滤：同时完成过期检测和清理
    const filtered = this._state.reminders.filter(r =>
      !r.isCompleted || now - new Date(r.targetTime).getTime() <= REMINDER_AUTO_DELETE_MS
    );

    if (filtered.length !== this._state.reminders.length) {
      this._state.reminders = filtered;
      this._persist();
      this._renderList();
      return;
    }

    // 仅更新卡片状态（不重建 DOM）
    this._state.reminders.forEach(reminder => {
      const refs = this._cardRefs.get(reminder.id);
      if (refs) this._updateCardState(reminder, refs);
    });
  },

  // =============================================================
  // 操作
  // =============================================================

  _toggleComplete(reminder) {
    const idx = this._state.reminders.findIndex(r => r.id === reminder.id);
    if (idx < 0) return;
    this._state.reminders[idx].isCompleted = !this._state.reminders[idx].isCompleted;
    this._persist();
    // 重新排序渲染
    this._renderList();
  },

  _deleteReminder(reminder) {
    const idx = this._state.reminders.findIndex(r => r.id === reminder.id);
    if (idx >= 0) {
      this._state.reminders.splice(idx, 1);
      this._persist();
      this._renderList();
    }
  },

  // =============================================================
  // 新增 / 编辑对话框
  // =============================================================

  _openAddDialog() {
    this._openEditorDialog(null);
  },

  _openEditorDialog(reminder) {
    const isEdit = !!reminder;
    const defaultAccent = '#FFD84D';
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setSeconds(0, 0);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const box = document.createElement('div');
    box.className = 'dialog-box';

    const header = document.createElement('div');
    header.className = 'dialog-header';
    const bar = document.createElement('div');
    bar.className = 'bar';
    header.appendChild(bar);
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = isEdit ? '编辑提醒' : '新增提醒';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dialog-close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    box.appendChild(header);

    box.appendChild(dividerEl());

    const body = document.createElement('div');
    body.className = 'dialog-body';

    body.appendChild(fieldLabel('提醒名称'));
    const nameInput = document.createElement('input');
    nameInput.className = 'field-input';
    nameInput.placeholder = '输入提醒名称...';
    nameInput.value = reminder?.name || '';
    nameInput.autofocus = true;
    body.appendChild(nameInput);
    body.appendChild(sizedBox(12));

    body.appendChild(fieldLabel('提醒描述（可选）'));
    const descInput = document.createElement('textarea');
    descInput.className = 'field-input field-textarea';
    descInput.placeholder = '输入提醒描述...';
    descInput.value = reminder?.description || '';
    descInput.style.minHeight = '60px';
    body.appendChild(descInput);
    body.appendChild(sizedBox(12));

    body.appendChild(fieldLabel('快捷设置'));
    const quickRow = document.createElement('div');
    quickRow.className = 'quick-hour-row';
    [1, 2, 4, 8, 12, 24].forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'quick-hour-btn';
      btn.textContent = `${h}小时后`;
      btn.addEventListener('click', () => {
        const target = new Date();
        target.setHours(target.getHours() + h);
        target.setMinutes(0, 0, 0);
        dateInput.value = this._toDateInputValue(target);
        timeInput.value = this._toTimeInputValue(target);
        quickRow.querySelectorAll('.quick-hour-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      quickRow.appendChild(btn);
    });
    body.appendChild(quickRow);
    body.appendChild(sizedBox(12));

    const datetimeRow = document.createElement('div');
    datetimeRow.className = 'datetime-row';

    const dateCol = document.createElement('div');
    dateCol.style.flex = '1';
    dateCol.appendChild(fieldLabel('日期'));
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'field-input';
    dateInput.value = reminder ? this._toDateInputValue(new Date(reminder.targetTime)) : this._toDateInputValue(now);
    dateCol.appendChild(dateInput);

    const timeCol = document.createElement('div');
    timeCol.style.flex = '1';
    timeCol.appendChild(fieldLabel('时间'));
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'field-input';
    timeInput.value = reminder ? this._toTimeInputValue(new Date(reminder.targetTime)) : this._toTimeInputValue(now);
    timeCol.appendChild(timeInput);

    datetimeRow.appendChild(dateCol);
    datetimeRow.appendChild(timeCol);
    body.appendChild(datetimeRow);
    body.appendChild(sizedBox(12));

    body.appendChild(fieldLabel('选择图标'));
    const iconGrid = document.createElement('div');
    iconGrid.className = 'icon-grid';
    const reminderIcons = ['notifications', 'event', 'alarm', 'timer', 'flag', 'star', 'bookmark', 'label'];
    const initialIcon = reminder?.icon || 'notifications';
    const iconSelector = createOptionSelector(reminderIcons, (iconName) => {
      const opt = document.createElement('div');
      opt.className = 'icon-option';
      opt.appendChild(mi(iconName));
      return opt;
    }, (iconName) => iconName === initialIcon);
    iconGrid.appendChild(iconSelector);
    body.appendChild(iconGrid);
    body.appendChild(sizedBox(12));

    body.appendChild(fieldLabel('主题色'));
    const colorRow = document.createElement('div');
    colorRow.className = 'color-row';
    const initialColor = reminder?.accent || defaultAccent;
    const colorSelector = createOptionSelector(ACCENT_COLORS, (c) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = c;
      swatch.style.color = c;
      swatch.innerHTML = '&#10003;';
      return swatch;
    }, (c) => c === initialColor);
    colorRow.appendChild(colorSelector);
    body.appendChild(colorRow);

    box.appendChild(body);
    box.appendChild(dividerEl());

    const footer = document.createElement('div');
    footer.className = 'dialog-footer';

    footer.appendChild(createBtn({
      text: '取消',
      outline: true,
      onClick: close,
    }));

    footer.appendChild(createBtn({
      text: isEdit ? '保存修改' : '创建提醒',
      primary: true,
      onClick: () => {
        const name = nameInput.value.trim();
        if (!name) {
          showSnackbar('请输入提醒名称');
          return;
        }
        const dateVal = dateInput.value;
        const timeVal = timeInput.value;
        if (!dateVal || !timeVal) {
          showSnackbar('请选择日期和时间');
          return;
        }
        const targetTime = new Date(`${dateVal}T${timeVal}`);
        if (isNaN(targetTime.getTime())) {
          showSnackbar('日期时间格式无效');
          return;
        }

        const result = {
          id: isEdit ? reminder.id : Store.generateId(),
          name,
          description: descInput.value.trim(),
          icon: iconSelector.getSelected(),
          accent: colorSelector.getSelected(),
          targetTime: targetTime.toISOString(),
          isCompleted: isEdit ? reminder.isCompleted : false,
          createdAt: isEdit ? reminder.createdAt : new Date().toISOString(),
        };

        if (isEdit) {
          const idx = this._state.reminders.findIndex(r => r.id === reminder.id);
          if (idx >= 0) this._state.reminders[idx] = result;
        } else {
          this._state.reminders.push(result);
        }
        this._persist();
        this._renderList();
        close();
        showSnackbar(isEdit ? '提醒已更新' : '提醒已创建');
      },
    }));

    box.appendChild(footer);
    overlay.appendChild(box);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    }

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
  },

  _toDateInputValue(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  _toTimeInputValue(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  reloadFromStore() {
    this._state.reminders = Store.loadReminders();
    this._renderList();
  },
};
