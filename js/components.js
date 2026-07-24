/**
 * components.js — 可复用 UI 组件工厂
 * 对应 Flutter 版：TaskCard, TaskPanel, _PanelHeader, WfButtonShell
 * 以及 TaskEditorDialog
 */

// =============================================================
// 辅助：Orokin 风格 SVG 边框
// =============================================================

/**
 * 创建 Orokin 风格 SVG 边框（契形 + 金边 + 流光）
 * @param {Object} opts - 配置项
 * @param {number} opts.width - viewBox 宽度
 * @param {number} opts.height - viewBox 高度
 * @param {number} opts.chamfer - 切角大小
 * @param {'gold'|'blue'} opts.color - 颜色主题
 * @param {number} opts.flowDelay - 流光延迟(秒)
 * @param {boolean} opts.hasFlow - 是否有流光动画
 * @returns {SVGElement}
 */
function createOrokinBorder(opts = {}) {
  const {
    width = 400,
    height = 100,
    chamfer = 12,
    color = 'gold',
    flowDelay = 0,
    hasFlow = true,
  } = opts;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'orokin-svg-border');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  // 契形路径（闭合，用于静态边框）
  const pathD = `M ${0.5} ${0.5} L ${width - chamfer - 0.5} ${0.5} L ${width - 0.5} ${chamfer + 0.5} L ${width - 0.5} ${height - 0.5} L ${chamfer + 0.5} ${height - 0.5} L ${0.5} ${height - chamfer - 0.5} Z`;

  // 静态金边
  const staticPath = document.createElementNS(svgNS, 'path');
  const staticClass = color === 'blue' ? 'blue' : color === 'silver' ? 'silver' : '';
  staticPath.setAttribute('class', `orokin-border-static ${staticClass}`);
  staticPath.setAttribute('d', pathD);
  svg.appendChild(staticPath);

  if (hasFlow) {
    const flowClass = color === 'blue' ? 'blue' : color === 'silver' ? 'silver' : '';
    // 顶部流光路径（从左上角沿顶边到右上角，再沿右边斜角向下）
    const topFlowD = `M ${0.5} ${0.5} L ${width - chamfer - 0.5} ${0.5} L ${width - 0.5} ${chamfer + 0.5}`;
    const topFlow = document.createElementNS(svgNS, 'path');
    topFlow.setAttribute('class', `orokin-border-flow ${flowClass}`);
    topFlow.setAttribute('d', topFlowD);
    if (flowDelay) topFlow.style.animationDelay = `${flowDelay}s`;
    svg.appendChild(topFlow);

    // 底部流光路径（从左下角沿左边斜角向上，再沿底边到右下角）
    const bottomFlowD = `M ${0.5} ${height - chamfer - 0.5} L ${chamfer + 0.5} ${height - 0.5} L ${width - 0.5} ${height - 0.5}`;
    const bottomFlow = document.createElementNS(svgNS, 'path');
    bottomFlow.setAttribute('class', `orokin-border-flow ${flowClass}`);
    bottomFlow.setAttribute('d', bottomFlowD);
    if (flowDelay) bottomFlow.style.animationDelay = `${flowDelay}s`;
    svg.appendChild(bottomFlow);
  }

  return svg;
}

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
  card.className = 'wf-card silver task-card' + (task.isCompleted ? ' completed' : '');
  card.dataset.taskId = task.id;
  card.draggable = isManageMode;

  // SVG 边框（已完成卡片有金色流光，未完成卡片有银白色金属光泽流光）
  const cardBorder = createOrokinBorder({
    width: 400,
    height: 80,
    chamfer: 10,
    color: task.isCompleted ? 'gold' : 'silver',
    flowDelay: Math.random() * 4,
    hasFlow: true,
  });
  card.appendChild(cardBorder);

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
  badge.className = 'wf-chip silver icon-badge ' + (task.isCompleted ? 'done' : 'default');
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
    editBtn.className = 'wf-chip blue action-btn edit';
    editBtn.appendChild(mi('edit'));
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); callbacks.onEdit?.(); });
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'wf-chip danger action-btn delete';
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
  checkBadge.className = 'wf-chip silver check-badge';
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
function createTaskPanel(opts, taskType, initialProgress) {
  const panel = document.createElement('div');
  panel.className = 'task-panel';

  const { title, subtitle, accent, tasks, callbacks, isManageMode } = opts;
  const completed = tasks.filter(t => t.isCompleted).length;
  const total = tasks.length;
  const progress = total === 0 ? 0 : completed / total;

  // 判断颜色主题（日常=金色，周常=蓝色）
  const isDaily = taskType === 0;
  const borderColor = isDaily ? 'gold' : 'blue';

  // --- 面板头部 ---
  const header = document.createElement('div');
  header.className = 'wf-card panel-header' + (isDaily ? ' theme-gold' : ' theme-blue');
  header.style.setProperty('--accent', accent);

  // SVG 金边 + 流光
  const headerBorder = createOrokinBorder({
    width: 500,
    height: 140,
    chamfer: 12,
    color: borderColor,
    flowDelay: taskType * 1.5,
    hasFlow: true,
  });
  header.appendChild(headerBorder);

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
    addBtn.className = 'wf-chip panel-add-btn';
    addBtn.style.setProperty('--card-accent', accent);
    addBtn.innerHTML = '<span>&#43;</span>';
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
  fill.style.width = (initialProgress != null ? initialProgress * 100 : 0) + '%';
  fill.style.setProperty('--card-accent', accent);
  barContainer.appendChild(fill);
  header.appendChild(barContainer);

  // 下一帧设置目标宽度，触发灵动变速过渡动画
  requestAnimationFrame(() => {
    fill.style.width = (progress * 100) + '%';
  });

  panel.appendChild(header);

  // --- 任务列表 ---
  const list = document.createElement('div');
  list.className = 'panel-list';

  const reorderCb = callbacks.onReorderItem;

  function renderTasks() {
    clearEl(list);
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
    const clearBorders = () => {
      const cards = list.children;
      for (let i = 0; i < cards.length; i++) {
        cards[i].style.borderTop = '';
        cards[i].style.borderBottom = '';
      }
    };

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const card = e.target.closest('.task-card');
      if (!card) return;
      const idx = parseInt(card.dataset.index);
      if (isNaN(idx)) return;
      clearBorders();
      if (idx > parseInt(list.dataset.dragFrom)) {
        card.style.borderBottom = `2px solid ${accent}`;
      } else {
        card.style.borderTop = `2px solid ${accent}`;
      }
      dragOverIndex = idx;
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      clearBorders();
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
  box.className = 'wf-card gold dialog-box';

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
    closeBtn.className = 'wf-chip silver dialog-close';
    closeBtn.innerHTML = '<span>&#10005;</span>';
    closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  box.appendChild(header);
  box.appendChild(dividerEl());

  // --- 表体 ---
  const body = document.createElement('div');
  body.className = 'dialog-body';

  body.appendChild(fieldLabel('任务名称'));
  const nameWrap = document.createElement('div');
  nameWrap.className = 'wf-chip silver field-wrap';
  const nameInput = document.createElement('input');
  nameInput.className = 'field-input';
  nameInput.placeholder = '输入任务名称...';
  nameInput.value = task?.name || '';
  nameInput.autofocus = true;
  nameWrap.appendChild(nameInput);
  body.appendChild(nameWrap);
  body.appendChild(sizedBox(16));

  body.appendChild(fieldLabel('任务描述'));
  const descWrap = document.createElement('div');
  descWrap.className = 'wf-chip silver field-wrap';
  const descInput = document.createElement('textarea');
  descInput.className = 'field-input field-textarea';
  descInput.placeholder = '输入任务描述...';
  descInput.value = task?.description || '';
  descWrap.appendChild(descInput);
  body.appendChild(descWrap);
  body.appendChild(sizedBox(16));

  // 图标选择器
  body.appendChild(fieldLabel('选择图标'));
  const iconGrid = document.createElement('div');
  iconGrid.className = 'icon-grid';
  const initialIcon = task?.icon || 'check_circle_outline';
  const iconSelector = createOptionSelector(TASK_ICONS, (iconName) => {
    const opt = document.createElement('div');
    opt.className = 'wf-chip silver icon-option';
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
    swatch.className = 'wf-chip color-swatch';
    swatch.style.setProperty('--swatch-color', c);
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
