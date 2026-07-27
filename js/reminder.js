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
    isManageMode: false,
  },

  _els: {},
  _timerInterval: null,
  _cardRefs: new Map(), // reminder.id → { card, statusEl, nameEl, checkBadge, iconBadge, lastState }

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
            <button class="wf-btn manage-btn" id="rm-manage-btn">管理</button>
          </div>
        </div>

        <div class="reminder-content" id="rm-content">
          <div class="reminder-list" id="rm-list"></div>
          <div class="wf-empty-state reminder-empty" id="rm-empty" style="display:none;">
            <div class="wf-empty-icon">
              <span class="material-icons">notifications_none</span>
            </div>
            <div class="wf-empty-title">暂无提醒事项</div>
            <div class="wf-empty-desc">点击右上角「新增」创建定时提醒</div>
          </div>
        </div>
      </div>
    `;

    this._els.container = container;
    this._els.list = document.getElementById('rm-list');
    this._els.empty = document.getElementById('rm-empty');
    this._els.addBtn = document.getElementById('rm-add-btn');
    this._els.manageBtn = document.getElementById('rm-manage-btn');

    this._state.reminders = Store.loadReminders();

    this._els.addBtn.addEventListener('click', () => this._openAddDialog());
    this._els.manageBtn.addEventListener('click', () => this._toggleManageMode());

    this._state.isLoaded = true;
    this._renderList();
    this._startTimer();
  },

  _persist() {
    Store.saveReminders(this._state.reminders);
  },

  // =============================================================
  // 过滤：保留活跃的提醒（移除过期的已完成/临时提醒）
  // =============================================================

  _filterActiveReminders(reminders, now) {
    return reminders.filter(r => {
      const targetTime = new Date(r.targetTime).getTime();
      if (r.isTemp) {
        return now - targetTime <= REMINDER_AUTO_DELETE_MS;
      }
      return !r.isCompleted || now - targetTime <= REMINDER_AUTO_DELETE_MS;
    });
  },

  // =============================================================
  // 渲染列表（仅首次/数据变更时调用，完整重建）
  // =============================================================

  _renderList() {
    const now = Date.now();
    const before = this._state.reminders.length;
    this._state.reminders = this._filterActiveReminders(this._state.reminders, now);
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
    const accent = reminder.accent || DEFAULT_REMINDER_ACCENT;
    const card = document.createElement('div');
    card.className = 'wf-card flow reminder-card';
    setAccentColor(card, accent);
    if (reminder.isTemp) card.classList.add('temp-reminder');

    const iconBadge = document.createElement('div');
    iconBadge.className = 'wf-chip icon-badge';
    setAccentColor(iconBadge, accent);
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

    info.appendChild(timeRow);
    card.appendChild(info);

    // 右侧列：顶部按钮 + 底部状态徽章
    const rightCol = document.createElement('div');
    rightCol.className = 'reminder-right-col';

    const topGroup = document.createElement('div');
    topGroup.className = 'reminder-right-top';

    // 管理模式下显示编辑+删除按钮（临时卡片只显示删除）
    if (this._state.isManageMode) {
      const actions = document.createElement('div');
      actions.className = 'reminder-actions';

      if (!reminder.isTemp) {
        const editBtn = document.createElement('button');
        editBtn.className = 'wf-chip blue action-btn edit';
        editBtn.title = '编辑';
        editBtn.appendChild(mi('edit'));
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openEditorDialog(reminder);
        });
        actions.appendChild(editBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'wf-chip danger action-btn delete';
      delBtn.title = '删除';
      delBtn.appendChild(mi('delete'));
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._deleteReminder(reminder);
      });
      actions.appendChild(delBtn);

      topGroup.appendChild(actions);
    }

    const checkBadge = document.createElement('div');
    checkBadge.className = 'wf-chip check-badge';
    setAccentColor(checkBadge, accent);
    topGroup.appendChild(checkBadge);

    rightCol.appendChild(topGroup);

    const statusBadge = document.createElement('span');
    statusBadge.className = 'wf-chip reminder-status';
    rightCol.appendChild(statusBadge);

    card.appendChild(rightCol);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn')) return;
      this._toggleComplete(reminder);
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

    const baseAccent = reminder.accent || DEFAULT_REMINDER_ACCENT;
    const cardAccent = reminder.isCompleted ? '#3FB950' : baseAccent;

    const countdownSec = Math.max(0, Math.floor(diffMs / 1000));
    const stateKey = `${reminder.isCompleted ? 'c' : 'p'}_${isActive ? 'a' : 'w'}_${countdownSec}`;
    if (refs.lastState === stateKey) return;
    refs.lastState = stateKey;

    card.classList.toggle('completed', reminder.isCompleted);
    card.classList.toggle('active', isActive);
    setAccentColor(card, cardAccent);

    const iconState = reminder.isCompleted ? 'done' : isActive ? 'active' : 'default';
    iconBadge.className = 'wf-chip icon-badge ' + iconState;
    setAccentColor(iconBadge, cardAccent);
    iconBadge.style.color = cardAccent;

    if (checkBadge.dataset.checked !== String(reminder.isCompleted)) {
      checkBadge.dataset.checked = String(reminder.isCompleted);
      checkBadge.innerHTML = reminder.isCompleted ? '<span class="material-icons">check</span>' : '';
    }
    setAccentColor(checkBadge, cardAccent);

    statusBadge.className = 'wf-chip reminder-status';
    const statusAccent = reminder.isCompleted ? '#3FB950' : baseAccent;
    setAccentColor(statusBadge, statusAccent);
    statusBadge.style.color = statusAccent;

    const statusSpan = statusBadge.firstElementChild;
    if (reminder.isCompleted) {
      if (statusBadge.dataset.status !== 'completed') {
        statusBadge.dataset.status = 'completed';
        statusBadge.innerHTML = '<span>已完成</span>';
      }
    } else if (isActive) {
      if (statusBadge.dataset.status !== 'active') {
        statusBadge.dataset.status = 'active';
        statusBadge.innerHTML = '<span>已激活</span>';
      }
    } else {
      statusBadge.dataset.status = 'pending';
      const text = this._formatCountdown(diffMs);
      if (statusSpan) {
        statusSpan.textContent = text;
      } else {
        statusBadge.innerHTML = `<span>${text}</span>`;
      }
    }
  },

  // =============================================================
  // 工具函数
  // =============================================================

  _formatTargetTime(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const todayStr = now.toDateString();
    const dStr = d.toDateString();
    const tomorrowStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString();

    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (dStr === todayStr) return `今天 ${timeStr}`;
    if (dStr === tomorrowStr) return `明天 ${timeStr}`;
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

  _onTick() {
    if (!this._state.isLoaded) return;

    const now = Date.now();

    const filtered = this._filterActiveReminders(this._state.reminders, now);

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
  // 管理模式
  // =============================================================

  _toggleManageMode() {
    this.setManageMode(!this._state.isManageMode);
  },

  setManageMode(enabled) {
    this._state.isManageMode = enabled;
    this._syncManageBtn();
    this._renderList();
  },

  _syncManageBtn() {
    this._els.manageBtn.textContent = this._state.isManageMode ? '管理中' : '管理';
    this._els.manageBtn.classList.toggle('active', this._state.isManageMode);
  },

  // =============================================================
  // 新增 / 编辑对话框
  // =============================================================

  _openAddDialog() {
    this._openEditorDialog(null);
  },

  _openEditorDialog(reminder) {
    const isEdit = !!reminder;
    const defaultAccent = DEFAULT_REMINDER_ACCENT;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setSeconds(0, 0);

    const body = document.createElement('div');

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
        dateInput.value = formatDateKey(target);
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
    dateInput.value = reminder ? formatDateKey(new Date(reminder.targetTime)) : formatDateKey(now);
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
    const iconSelector = createIconSelector(reminderIcons, initialIcon);
    iconGrid.appendChild(iconSelector);
    body.appendChild(iconGrid);
    body.appendChild(sizedBox(12));

    body.appendChild(fieldLabel('主题色'));
    const colorRow = document.createElement('div');
    colorRow.className = 'color-row';
    const initialColor = reminder?.accent || defaultAccent;
    const colorSelector = createColorSelector(ACCENT_COLORS, initialColor);
    colorRow.appendChild(colorSelector);
    body.appendChild(colorRow);

    const footer = document.createElement('div');

    let close;
    footer.appendChild(createBtn({
      text: '取消',
      outline: true,
      onClick: () => close(),
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

    const dialog = createDialog({
      title: isEdit ? '编辑提醒' : '新增提醒',
      body,
      footer,
      closeOnOverlay: true,
      closeOnEscape: true,
    });
    close = dialog.close;
  },

  _toTimeInputValue(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  reloadFromStore() {
    this._state.reminders = Store.loadReminders();
    this._renderList();
  },
};
