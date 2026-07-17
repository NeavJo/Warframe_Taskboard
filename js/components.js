/**
 * components.js — 可复用 UI 组件工厂
 * 对应 Flutter 版：TaskCard, TaskPanel, _PanelHeader, WfButtonShell, WfIconButton
 * 以及 TaskEditorDialog
 *
 * 所有组件都是函数，返回 DOM 节点。
 */

// =============================================================
// 辅助：获取 Material Icon 的 span
// =============================================================
function mi(name, extraClass = '') {
  const s = document.createElement('span');
  s.className = `material-icons ${extraClass}`.trim();
  s.textContent = name;
  return s;
}

// =============================================================
// WfButton 等效 — 通用按钮
// =============================================================

/**
 * 创建通用按钮 (对应 WfButtonShell)
 * @param {Object} opts
 * @param {string} opts.text - 按钮文字
 * @param {string} opts.icon - Material icon 名称（可选）
 * @param {string} opts.accent - 强调色 CSS 类: 'gold' | 'blue' | 'yellow'
 * @param {boolean} opts.active - 是否选中态
 * @param {Function} opts.onClick - 点击回调
 * @param {string} opts.className - 额外 CSS 类
 * @param {boolean} opts.primary - 主按钮样式（金色实底）
 * @param {boolean} opts.outline - 次按钮样式（透明灰边）
 */
function createBtn(opts = {}) {
  const btn = document.createElement('button');
  const classes = ['wf-btn'];
  if (opts.accent && opts.accent !== 'gold') classes.push(`accent-${opts.accent}`);
  if (opts.active) classes.push('active');
  if (opts.className) classes.push(opts.className);
  if (opts.primary) classes.push('primary');
  if (opts.outline) classes.push('outline');
  btn.className = classes.join(' ');
  btn.type = 'button';

  if (opts.icon) {
    btn.appendChild(mi(opts.icon));
  }
  if (opts.text) {
    const span = document.createElement('span');
    span.textContent = opts.text;
    btn.appendChild(span);
  }

  if (opts.onClick) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onClick(e);
    });
  }
  return btn;
}

/**
 * 图标按钮 (对应 WfIconButton)
 */
function createIconBtn(iconName, onClick, opts = {}) {
  return createBtn({
    icon: iconName,
    onClick,
    className: 'wf-icon-btn ' + (opts.className || ''),
    accent: opts.accent,
    active: opts.active,
  });
}

// =============================================================
// 任务卡片 (对应 TaskCard)
// =============================================================

/**
 * 创建单条任务卡片
 * @param {Object} task - TaskItem: { id, name, description, icon, accent, isCompleted }
 * @param {Object} callbacks - { onToggle, onEdit, onDelete, onDragStart }
 * @param {boolean} isManageMode
 * @param {boolean} showDragHandle
 */
function createTaskCard(task, callbacks, isManageMode = false, showDragHandle = false) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.isCompleted ? ' completed' : '');
  card.dataset.taskId = task.id;
  card.style.setProperty('--card-accent', task.accent);
  card.draggable = isManageMode;

  // --- 拖拽手柄 ---
  if (showDragHandle) {
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '&#9776;'; // ☰
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      card.draggable = true;
    });
    handle.addEventListener('mouseup', () => { card.draggable = false; });
    card.appendChild(handle);
  }

  // --- 图标徽章 ---
  const badge = document.createElement('div');
  badge.className = 'icon-badge ' + (task.isCompleted ? 'done' : 'default');
  badge.style.borderColor = task.isCompleted ? task.accent : '';
  badge.style.background = task.isCompleted
    ? task.accent + '1F'
    : '';
  badge.appendChild(mi(task.icon || 'check_circle_outline'));
  card.appendChild(badge);

  // --- 任务信息 ---
  const info = document.createElement('div');
  info.className = 'task-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'task-name';
  nameEl.textContent = task.name;
  info.appendChild(nameEl);

  if (task.description) {
    const desc = document.createElement('div');
    desc.className = 'task-desc';
    desc.textContent = task.description;
    info.appendChild(desc);
  }
  card.appendChild(info);

  // --- 管理按钮区 ---
  if (isManageMode) {
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit';
    editBtn.appendChild(mi('edit'));
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onEdit?.(); });
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete';
    delBtn.appendChild(mi('delete'));
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onDelete?.(); });
    actions.appendChild(delBtn);

    card.appendChild(actions);

    // 拖拽事件
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      card.classList.add('dragging');
      callbacks.onDragStart?.();
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      card.draggable = false;
    });
  }

  // --- 完成勾选框 ---
  const checkBadge = document.createElement('div');
  checkBadge.className = 'check-badge';
  if (task.isCompleted) {
    checkBadge.appendChild(mi('check'));
  }
  card.appendChild(checkBadge);

  // --- 点击整卡切换完成 ---
  card.addEventListener('click', (e) => {
    // 不触发于点击操作按钮时
    if (e.target.closest('.action-btn') || e.target.closest('.drag-handle')) return;
    callbacks.onToggle?.();
  });

  return card;
}

// =============================================================
// 任务面板 (对应 TaskPanel)
// =============================================================

/**
 * 创建任务面板容器
 * @param {Object} opts - { title, subtitle, accent, tasks, callbacks, isManageMode }
 * @param {number} taskType - 0=日常, 1=周常 (用于拖拽区分)
 */
function createTaskPanel(opts, taskType) {
  const panel = document.createElement('div');
  panel.className = 'task-panel';

  const { title, subtitle, accent, tasks, callbacks, isManageMode } = opts;
  const completed = tasks.filter(t => t.isCompleted).length;
  const total = tasks.length;
  const progress = total === 0 ? 0 : completed / total;

  // --- 面板头部 (_PanelHeader) ---
  const header = document.createElement('div');
  header.className = 'panel-header';

  // 第一行
  const topRow = document.createElement('div');
  topRow.className = 'header-top';

  const bar = document.createElement('div');
  bar.className = 'accent-bar';
  bar.style.background = accent;
  bar.style.boxShadow = `0 0 8px ${accent}99`;
  topRow.appendChild(bar);

  const sub = document.createElement('span');
  sub.className = 'subtitle-text';
  sub.style.color = accent;
  sub.textContent = subtitle;
  topRow.appendChild(sub);

  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  topRow.appendChild(spacer);

  const counter = document.createElement('span');
  counter.className = 'counter';
  counter.textContent = `${completed} / ${total}`;
  topRow.appendChild(counter);

  // 管理模式下显示新增按钮
  if (isManageMode && callbacks.onAddTask) {
    const addBtn = document.createElement('button');
    addBtn.style.cssText = `
      width:28px; height:28px; display:flex; align-items:center; justify-content:center;
      border-radius:4px; border:1.5px solid ${accent}; background:${accent}26;
      color:${accent}; cursor:pointer; font-size:20px; margin-left:10px;
    `;
    addBtn.innerHTML = '&#43;';
    addBtn.title = '新增任务';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onAddTask();
    });
    topRow.appendChild(addBtn);
  }

  header.appendChild(topRow);

  // 第二行：标题
  const titleEl = document.createElement('div');
  titleEl.className = 'title-text';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  // 第三行：进度条
  const barContainer = document.createElement('div');
  barContainer.className = 'progress-bar';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = (progress * 100) + '%';
  fill.style.background = accent;
  fill.style.boxShadow = `0 0 6px ${accent}`;
  barContainer.appendChild(fill);
  header.appendChild(barContainer);

  panel.appendChild(header);

  // --- 任务列表 ---
  const list = document.createElement('div');
  list.className = 'panel-list';

  const reorderCb = callbacks.onReorderItem;

  // 填充任务列表
  function renderTasks() {
    while (list.firstChild) list.removeChild(list.firstChild);
    const currentTasks = opts.tasks;
    currentTasks.forEach((task, index) => {
      const card = createTaskCard(task, {
        onToggle: () => callbacks.onToggle?.(task),
        onEdit: () => callbacks.onEdit?.(task),
        onDelete: () => callbacks.onDelete?.(task),
        onDragStart: () => {
          list.dataset.dragFrom = index;
          list.dataset.taskType = taskType;
        },
      }, isManageMode, isManageMode && reorderCb);
      card.dataset.index = index;
      list.appendChild(card);
    });
  }

  renderTasks();

  // --- 拖拽排序 (HTML5 Drag & Drop) ---
  if (isManageMode && reorderCb) {
    let dragOverIndex = -1;

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const card = e.target.closest('.task-card');
      if (!card) return;
      const idx = parseInt(card.dataset.index);
      if (isNaN(idx)) return;
      // 视觉指示
      Array.from(list.children).forEach(c => c.style.borderBottom = '');
      if (idx > parseInt(list.dataset.dragFrom)) {
        card.style.borderBottom = `2px solid ${accent}`;
      } else {
        card.style.borderTop = `2px solid ${accent}`;
      }
      dragOverIndex = idx;
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      Array.from(list.children).forEach(c => {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      const from = parseInt(list.dataset.dragFrom);
      if (!isNaN(from) && from !== dragOverIndex && dragOverIndex >= 0) {
        reorderCb(from, dragOverIndex);
      }
      list.dataset.dragFrom = '-1';
    });

    list.addEventListener('dragleave', (e) => {
      const card = e.target.closest('.task-card');
      if (card) {
        card.style.borderTop = '';
        card.style.borderBottom = '';
      }
    });
  }

  // 存储 render 方法以便外部调用（当数据变更时）
  panel._renderTasks = renderTasks;
  panel._renderHeader = () => {
    const newCompleted = opts.tasks.filter(t => t.isCompleted).length;
    const newTotal = opts.tasks.length;
    const newProgress = newTotal === 0 ? 0 : newCompleted / newTotal;
    counter.textContent = `${newCompleted} / ${newTotal}`;
    fill.style.width = (newProgress * 100) + '%';
  };

  panel.appendChild(list);
  return panel;
}

// =============================================================
// 任务编辑器对话框 (对应 TaskEditorDialog)
// =============================================================

/**
 * 创建任务编辑对话框
 * @param {Object} task - 编辑模式传入已有 task，新增模式传 null
 * @param {boolean} isDaily - 用于决定默认强调色
 * @param {Function} onSubmit - (task) => void
 */
function createTaskEditorDialog(task, isDaily, onSubmit) {
  const isEdit = !!task;
  const defaultAccent = isDaily ? '#FFD84D' : '#1FB6FF';

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';

  const box = document.createElement('div');
  box.className = 'dialog-box';

  // --- 头部 ---
  const header = document.createElement('div');
  header.className = 'dialog-header';
  const bar = document.createElement('div');
  bar.className = 'bar';
  header.appendChild(bar);
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = isEdit ? '编辑任务' : '新增任务';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dialog-close';
  closeBtn.innerHTML = '&#10005;';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  box.appendChild(header);

  // 分隔线
  box.appendChild(dividerEl());

  // --- 表体 ---
  const body = document.createElement('div');
  body.className = 'dialog-body';

  // 名称
  body.appendChild(fieldLabel('任务名称'));
  const nameInput = document.createElement('input');
  nameInput.className = 'field-input';
  nameInput.placeholder = '输入任务名称...';
  nameInput.value = task?.name || '';
  nameInput.autofocus = true;
  body.appendChild(nameInput);
  body.appendChild(sizedBox(16));

  // 描述
  body.appendChild(fieldLabel('任务描述'));
  const descInput = document.createElement('textarea');
  descInput.className = 'field-input field-textarea';
  descInput.placeholder = '输入任务描述...';
  descInput.value = task?.description || '';
  body.appendChild(descInput);
  body.appendChild(sizedBox(16));

  // 图标选择器
  body.appendChild(fieldLabel('选择图标'));
  const iconGrid = document.createElement('div');
  iconGrid.className = 'icon-grid';
  let selectedIcon = task?.icon || 'check_circle_outline';

  // 所有图标选项（带边框）
  AVAILABLE_ICON_NAMES.forEach(iconName => {
    const opt = document.createElement('div');
    opt.className = 'icon-option';
    if (iconName === selectedIcon) opt.classList.add('selected');
    // 用边框模拟 WfButtonShell
    opt.style.border = iconName === selectedIcon
      ? `1.5px solid var(--gold)`
      : `1.5px solid var(--bg-border)`;
    opt.style.background = iconName === selectedIcon
      ? 'rgba(212,175,55,0.15)'
      : '';
    opt.appendChild(mi(iconName));
    opt.addEventListener('click', () => {
      iconGrid.querySelectorAll('.icon-option').forEach(el => {
        el.classList.remove('selected');
        el.style.border = '1.5px solid var(--bg-border)';
        el.style.background = '';
      });
      opt.classList.add('selected');
      opt.style.border = '1.5px solid var(--gold)';
      opt.style.background = 'rgba(212,175,55,0.15)';
      selectedIcon = iconName;
    });
    iconGrid.appendChild(opt);
  });
  body.appendChild(iconGrid);
  body.appendChild(sizedBox(16));

  // 主题色选择器
  body.appendChild(fieldLabel('主题色'));
  const colorRow = document.createElement('div');
  colorRow.className = 'color-row';
  const accentColors = ['#D4AF37', '#1FB6FF', '#FFD84D', '#3FB950', '#E5534B'];
  let selectedAccent = task?.accent || defaultAccent;

  accentColors.forEach(c => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = c;
    swatch.style.color = c;
    if (c === selectedAccent) {
      swatch.classList.add('selected');
      swatch.innerHTML = '&#10003;';
      swatch.style.color = '#000';
    }
    swatch.addEventListener('click', () => {
      colorRow.querySelectorAll('.color-swatch').forEach(el => {
        el.classList.remove('selected');
        el.textContent = '';
        el.style.color = el.style.background;
      });
      swatch.classList.add('selected');
      swatch.innerHTML = '&#10003;';
      swatch.style.color = '#000';
      selectedAccent = c;
    });
    colorRow.appendChild(swatch);
  });
  body.appendChild(colorRow);

  box.appendChild(body);

  // 分隔线
  box.appendChild(dividerEl());

  // --- 底部按钮 ---
  const footer = document.createElement('div');
  footer.className = 'dialog-footer';

  const cancelBtn = createBtn({ text: '取消', outline: true, onClick: close });
  footer.appendChild(cancelBtn);

  const submitBtn = createBtn({
    text: isEdit ? '保存修改' : '创建任务',
    primary: true,
    onClick: () => {
      const name = nameInput.value.trim();
      if (!name) {
        showSnackbar('请输入任务名称');
        return;
      }
      const result = {
        id: isEdit ? task.id : Store.generateId(),
        name,
        description: descInput.value.trim(),
        icon: selectedIcon,
        accent: selectedAccent,
        isCompleted: isEdit ? task.isCompleted : false,
      };
      onSubmit(result);
      close();
    },
  });
  footer.appendChild(submitBtn);

  box.appendChild(footer);
  overlay.appendChild(box);

  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  function close() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  }

  // 自动打开
  requestAnimationFrame(() => overlay.classList.add('open'));

  return overlay;
}

// =============================================================
// 内部工具函数
// =============================================================

function fieldLabel(text) {
  const label = document.createElement('label');
  label.className = 'field-label';
  label.textContent = text;
  return label;
}

function sizedBox(h) {
  const div = document.createElement('div');
  div.style.height = h + 'px';
  return div;
}

function dividerEl() {
  const div = document.createElement('div');
  div.className = 'dialog-divider';
  return div;
}
