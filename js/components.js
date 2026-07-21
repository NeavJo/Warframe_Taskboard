/**
 * components.js — 可复用 UI 组件工厂
 * 对应 Flutter 版：TaskCard, TaskPanel, _PanelHeader, WfButtonShell
 * 以及 TaskEditorDialog
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
 */
function createBtn(opts = {}) {
  const btn = document.createElement('button');
  const classes = ['wf-btn'];
  if (opts.active) classes.push('active');
  if (opts.className) classes.push(opts.className);
  if (opts.primary) classes.push('primary');
  if (opts.outline) classes.push('outline');
  btn.className = classes.join(' ');
  btn.type = 'button';

  if (opts.icon) btn.appendChild(mi(opts.icon));
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

// =============================================================
// 任务卡片 (对应 TaskCard)
// =============================================================

/**
 * 创建单条任务卡片
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
    handle.innerHTML = '&#9776;';
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
  if (task.isCompleted) checkBadge.appendChild(mi('check'));
  card.appendChild(checkBadge);

  // --- 点击整卡切换完成 ---
  card.addEventListener('click', (e) => {
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
 */
function createTaskPanel(opts, taskType) {
  const panel = document.createElement('div');
  panel.className = 'task-panel';

  const { title, subtitle, accent, tasks, callbacks, isManageMode } = opts;
  const completed = tasks.filter(t => t.isCompleted).length;
  const total = tasks.length;
  const progress = total === 0 ? 0 : completed / total;

  // --- 面板头部 ---
  const header = document.createElement('div');
  header.className = 'panel-header';

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
    addBtn.className = 'panel-add-btn';
    addBtn.style.setProperty('--card-accent', accent);
    addBtn.innerHTML = '&#43;';
    addBtn.title = '新增任务';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onAddTask();
    });
    topRow.appendChild(addBtn);
  }

  header.appendChild(topRow);

  const titleEl = document.createElement('div');
  titleEl.className = 'title-text';
  titleEl.textContent = title;
  header.appendChild(titleEl);

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

  function renderTasks() {
    while (list.firstChild) list.removeChild(list.firstChild);
    opts.tasks.forEach((task, index) => {
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
      Array.from(list.children).forEach(c => { c.style.borderTop = ''; c.style.borderBottom = ''; });
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

  // --- 触摸拖拽排序 (移动端: 在手柄上滑动即拖拽，无需长按) ---
  if (isManageMode && reorderCb && window.matchMedia('(any-pointer: coarse)').matches) {
    let dragState = null;

    list.addEventListener('touchstart', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const card = handle.closest('.task-card');
      if (!card) return;
      const touch = e.touches[0];
      // 只记录起始状态，不启动定时器，不立即拖拽
      dragState = {
        card,
        fromIndex: parseInt(card.dataset.index),
        startY: touch.clientY,
        startX: touch.clientX,
        isDragging: false,
      };
    }, { passive: true });

    list.addEventListener('touchmove', (e) => {
      if (!dragState) return;
      const touch = e.touches[0];

      if (!dragState.isDragging) {
        // 手指在手柄上滑动超过 8px 即进入拖拽模式，无需等待
        const dy = Math.abs(touch.clientY - dragState.startY);
        const dx = Math.abs(touch.clientX - dragState.startX);
        if (dy < 8 && dx < 8) return;

        dragState.isDragging = true;
        const card = dragState.card;
        const rect = card.getBoundingClientRect();
        dragState.startRect = rect;

        card.classList.add('touch-dragging');
        card.style.left = rect.left + 'px';
        card.style.top = rect.top + 'px';
        card.style.width = rect.width + 'px';

        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = rect.height + 'px';
        dragState.placeholder = placeholder;
        card.parentNode.insertBefore(placeholder, card);

        list.classList.add('no-scroll');

        if (navigator.vibrate) navigator.vibrate(20);
      }

      e.preventDefault();

      const { card, startRect } = dragState;
      card.style.top = (touch.clientY - startRect.height / 2) + 'px';

      const siblings = Array.from(list.children).filter(
        c => c !== card && !c.classList.contains('drag-placeholder')
      );

      let newIndex = dragState.fromIndex;
      for (let i = 0; i < siblings.length; i++) {
        const sRect = siblings[i].getBoundingClientRect();
        if (touch.clientY < sRect.top + sRect.height / 2) {
          newIndex = parseInt(siblings[i].dataset.index);
          break;
        }
        if (i === siblings.length - 1) {
          newIndex = parseInt(siblings[i].dataset.index);
        }
      }

      dragState.currentIndex = newIndex;

      const targetCard = siblings.find(c => parseInt(c.dataset.index) === newIndex);
      if (targetCard) {
        list.insertBefore(dragState.placeholder, targetCard);
      } else if (siblings.length > 0) {
        list.appendChild(dragState.placeholder);
      }
    }, { passive: false });

    const endTouchDrag = () => {
      if (!dragState) return;
      if (dragState.isDragging) {
        const { fromIndex, currentIndex } = dragState;
        if (dragState.placeholder) dragState.placeholder.remove();
        list.classList.remove('no-scroll');
        if (dragState.card) dragState.card.classList.remove('touch-dragging');
        dragState = null;
        if (currentIndex !== undefined && currentIndex !== fromIndex) {
          reorderCb(fromIndex, currentIndex);
        } else {
          renderTasks();
        }
      } else {
        dragState = null;
      }
    };

    list.addEventListener('touchend', endTouchDrag);
    list.addEventListener('touchcancel', endTouchDrag);
  }

  // 存储 render 方法以便外部调用
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

// 可选图标列表
const TASK_ICONS = [
  'check_circle_outline', 'flash_on', 'card_giftcard', 'bolt',
  'auto_awesome', 'gavel', 'castle', 'storefront',
  'shield', 'star', 'track_changes', 'rocket',
  'military_tech', 'key', 'crisis_alert',
];

// 主题色选项
const ACCENT_COLORS = ['#D4AF37', '#1FB6FF', '#FFD84D', '#3FB950', '#E5534B'];

/**
 * 通用：创建单选选择器（图标/颜色等）
 * 返回 { container, getSelected }
 */
function createOptionSelector(options, getLabel, isSelected) {
  const container = document.createElement('div');
  let selectedIndex = options.findIndex(isSelected);
  if (selectedIndex < 0) selectedIndex = 0;

  options.forEach((opt, i) => {
    const el = getLabel(opt, i);
    el.classList.add('selectable');
    if (i === selectedIndex) el.classList.add('selected');
    el.addEventListener('click', () => {
      container.querySelectorAll('.selectable').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedIndex = i;
    });
    container.appendChild(el);
  });

  container.getSelected = () => options[selectedIndex];
  return container;
}

/**
 * 创建任务编辑对话框
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
  box.appendChild(dividerEl());

  // --- 表体 ---
  const body = document.createElement('div');
  body.className = 'dialog-body';

  body.appendChild(fieldLabel('任务名称'));
  const nameInput = document.createElement('input');
  nameInput.className = 'field-input';
  nameInput.placeholder = '输入任务名称...';
  nameInput.value = task?.name || '';
  nameInput.autofocus = true;
  body.appendChild(nameInput);
  body.appendChild(sizedBox(16));

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
  const initialIcon = task?.icon || 'check_circle_outline';
  const iconSelector = createOptionSelector(TASK_ICONS, (iconName) => {
    const opt = document.createElement('div');
    opt.className = 'icon-option';
    opt.appendChild(mi(iconName));
    return opt;
  }, (iconName) => iconName === initialIcon);
  iconGrid.appendChild(iconSelector);
  body.appendChild(iconGrid);
  body.appendChild(sizedBox(16));

  // 主题色选择器
  body.appendChild(fieldLabel('主题色'));
  const colorRow = document.createElement('div');
  colorRow.className = 'color-row';
  const initialColor = task?.accent || defaultAccent;
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

  // --- 底部按钮 ---
  const footer = document.createElement('div');
  footer.className = 'dialog-footer';

  footer.appendChild(createBtn({
    text: '取消',
    outline: true,
    onClick: close,
  }));
  footer.appendChild(createBtn({
    text: isEdit ? '保存修改' : '创建任务',
    primary: true,
    onClick: () => {
      const name = nameInput.value.trim();
      if (!name) {
        showSnackbar('请输入任务名称');
        return;
      }
      onSubmit({
        id: isEdit ? task.id : Store.generateId(),
        name,
        description: descInput.value.trim(),
        icon: iconSelector.getSelected(),
        accent: colorSelector.getSelected(),
        isCompleted: isEdit ? task.isCompleted : false,
      });
      close();
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
