/**
 * notes.js — 便签与目标页面逻辑
 *
 * 功能：
 *   - 便签卡片网格（置顶 / 其他两区）
 *   - 嵌套事项（一二级）勾选 + 级联完成
 *   - 卡片间拖拽重排序（HTML5 D&D + Touch）
 *   - 编辑对话框：增删改事项、调整层级、切换主题色、置顶
 *
 * 数据结构：
 *   Note { id, title, color, pinned, items: Item[], createdAt, updatedAt }
 *   Item { id, text, completed, parentId: string|null, order }
 */

const NOTE_COLORS = ['gold', 'silver', 'blue', 'purple', 'green'];
const NOTE_PREVIEW_LIMIT = 6; // 卡片预览最多显示的事项条数

const Notes = {
  _state: {
    notes: [],
    isLoaded: false,
  },

  _els: {},
  _editor: null, // 当前编辑器临时状态引用

  // =============================================================
  // 初始化
  // =============================================================

  init(container) {
    container.innerHTML = `
      <div class="notes-page">
        <div class="notes-header page-header">
          <div class="header-row">
            <button class="nav-trigger-inline" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
              <span class="material-icons mi-md">dashboard</span>
            </button>
            <div>
              <div class="page-brand-title">WARFRAME</div>
              <div class="page-brand-sub">NOTES / 便签与目标</div>
            </div>
            <div class="page-spacer"></div>
            <button class="wf-btn primary" id="nt-add-btn">
              <span class="material-icons mi-sm">add</span>
              <span>新建</span>
            </button>
          </div>
        </div>

        <div class="notes-content" id="nt-content">
          <div class="notes-inner" id="nt-inner">
            <!-- 新建便签条 -->
            <div class="wf-card silver notes-composer" id="nt-composer">
              <span class="material-icons composer-icon">edit_note</span>
              <span class="composer-text">记录一个目标…</span>
              <span class="composer-add">+</span>
            </div>

            <div id="nt-pinned-section"></div>
            <div id="nt-regular-section"></div>

            <div class="wf-empty-state notes-empty" id="nt-empty" style="display:none;">
              <div class="wf-empty-icon">
                <span class="material-icons">event_note</span>
              </div>
              <div class="wf-empty-title">暂无便签</div>
              <div class="wf-empty-desc">点击上方「新建」创建你的第一个目标清单</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._els.container = container;
    this._els.inner = document.getElementById('nt-inner');
    this._els.composer = document.getElementById('nt-composer');
    this._els.pinnedSection = document.getElementById('nt-pinned-section');
    this._els.regularSection = document.getElementById('nt-regular-section');
    this._els.empty = document.getElementById('nt-empty');
    this._els.addBtn = document.getElementById('nt-add-btn');

    this._state.notes = Store.loadNotes();

    this._els.composer.addEventListener('click', () => this._openEditor(null));
    this._els.addBtn.addEventListener('click', () => this._openEditor(null));

    this._state.isLoaded = true;
    this._render();
  },

  _persist() {
    Store.saveNotes(this._state.notes);
  },

  reloadFromStore() {
    this._state.notes = Store.loadNotes();
    if (this._state.isLoaded) this._render();
  },

  // =============================================================
  // 渲染
  // =============================================================

  _render() {
    const pinned = this._state.notes.filter(n => n.pinned);
    const regular = this._state.notes.filter(n => !n.pinned);

    this._renderSection(this._els.pinnedSection, pinned, '置顶', 'push_pin', true);
    this._renderSection(this._els.regularSection, regular, '其他', 'event_note', false);

    // composer 始终显示作为新建入口
    this._els.empty.style.display = 'none';
    this._els.composer.style.display = 'flex';
  },

  _renderSection(container, notes, label, icon, isPinned) {
    clearEl(container);

    if (notes.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';

    const section = document.createElement('div');
    section.className = 'notes-section';

    const title = document.createElement('div');
    title.className = 'notes-section-title';
    title.innerHTML = `<span class="material-icons">${icon}</span><span>${label}</span>`;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'notes-grid';
    grid.dataset.section = isPinned ? 'pinned' : 'regular';

    notes.forEach(note => {
      grid.appendChild(this._createNoteCard(note));
    });

    section.appendChild(grid);
    container.appendChild(section);

    // 绑定卡片间拖拽
    this._bindCardDrag(grid);
  },

  // =============================================================
  // 便签卡片
  // =============================================================

  _createNoteCard(note) {
    const card = document.createElement('div');
    card.className = `wf-card ${note.color || 'silver'} note-card${note.pinned ? ' pinned' : ''}`;
    card.dataset.noteId = note.id;
    card.draggable = false; // 由手柄激活

    // --- 头部 ---
    const head = document.createElement('div');
    head.className = 'note-card-head';

    const titleEl = document.createElement('div');
    titleEl.className = 'note-card-title' + (note.title ? '' : ' empty');
    titleEl.textContent = note.title || '未命名便签';
    head.appendChild(titleEl);

    const actions = document.createElement('div');
    actions.className = 'note-card-actions';

    const pinBtn = document.createElement('div');
    pinBtn.className = 'note-action pin-btn' + (note.pinned ? ' active' : '');
    pinBtn.innerHTML = '<span class="material-icons">push_pin</span>';
    pinBtn.title = note.pinned ? '取消置顶' : '置顶';
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._togglePin(note);
    });
    actions.appendChild(pinBtn);

    const dragHandle = document.createElement('div');
    dragHandle.className = 'note-action drag-handle';
    dragHandle.innerHTML = '<span class="material-icons">drag_indicator</span>';
    dragHandle.title = '拖拽排序';
    dragHandle.addEventListener('mousedown', () => { card.draggable = true; });
    dragHandle.addEventListener('mouseup', () => { card.draggable = false; });
    actions.appendChild(dragHandle);

    head.appendChild(actions);
    card.appendChild(head);

    // --- 事项列表 ---
    const itemsEl = document.createElement('div');
    itemsEl.className = 'note-items';

    const ordered = this._getOrderedItems(note);
    const visible = ordered.slice(0, NOTE_PREVIEW_LIMIT);
    visible.forEach(({ item, isChild }) => {
      itemsEl.appendChild(this._createItemRow(item, isChild, false, note));
    });

    if (ordered.length > NOTE_PREVIEW_LIMIT) {
      itemsEl.classList.add('overflow');
    }
    card.appendChild(itemsEl);

    // --- 底部进度 ---
    const foot = document.createElement('div');
    foot.className = 'note-card-foot';

    const progress = this._computeProgress(note);
    const progressBar = document.createElement('div');
    progressBar.className = 'wf-progress note-progress';
    const fill = document.createElement('div');
    fill.className = 'wf-progress-fill note-progress-fill';
    fill.style.width = (progress * 100) + '%';
    progressBar.appendChild(fill);
    foot.appendChild(progressBar);

    const counter = document.createElement('div');
    counter.className = 'note-counter';
    const completed = note.items.filter(i => i.completed).length;
    counter.textContent = `${completed}/${note.items.length}`;
    if (progress === 1 && note.items.length > 0) card.classList.add('completed');
    foot.appendChild(counter);

    card.appendChild(foot);

    // 点击卡片打开编辑器
    card.addEventListener('click', (e) => {
      if (e.target.closest('.note-action') || e.target.closest('.note-check')) return;
      this._openEditor(note);
    });

    return card;
  },

  /**
   * 创建事项行（卡片预览 / 编辑器内共用）
   * @param item 事项对象
   * @param isChild 是否为二级事项
   * @param isEditor 是否在编辑器内
   * @param note 所属便签（用于卡片内直接切换完成态）
   */
  _createItemRow(item, isChild, isEditor, note) {
    const row = document.createElement('div');
    row.className = 'note-item' + (isChild ? ' child' : '') + (item.completed ? ' completed' : '');
    if (isEditor) {
      row.className = 'note-editor-item' + (isChild ? ' child' : '') + (item.completed ? ' completed' : '');
    }
    row.dataset.itemId = item.id;

    // 勾选框
    const check = document.createElement('div');
    check.className = isEditor ? 'wf-chip silver nei-check' : 'wf-chip silver note-check';
    if (item.completed) check.innerHTML = '<span class="material-icons">check</span>';
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isEditor) {
        this._editorToggleItem(item.id);
      } else {
        this._toggleItem(note, item.id);
      }
    });
    row.appendChild(check);

    if (isEditor) {
      // 编辑器内：文本输入框
      const input = document.createElement('input');
      input.className = 'nei-input';
      input.value = item.text;
      input.placeholder = '事项内容…';
      input.addEventListener('input', () => {
        item.text = input.value;
        this._editor.dirty = true;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._editorAddItem(item.parentId);
        }
      });
      row.appendChild(input);

      // 拖拽手柄
      const drag = document.createElement('div');
      drag.className = 'nei-btn drag';
      drag.innerHTML = '<span class="material-icons">drag_indicator</span>';
      drag.title = '拖拽排序';
      drag.addEventListener('mousedown', () => { row.draggable = true; });
      drag.addEventListener('mouseup', () => { row.draggable = false; });
      row.appendChild(drag);

      // 升级/降级按钮
      const levelBtn = document.createElement('button');
      levelBtn.className = 'nei-btn';
      levelBtn.type = 'button';
      if (isChild) {
        levelBtn.innerHTML = '<span class="material-icons">format_indent_decrease</span>';
        levelBtn.title = '升级为一级';
        levelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._editorOutdentItem(item.id);
        });
      } else {
        levelBtn.innerHTML = '<span class="material-icons">format_indent_increase</span>';
        levelBtn.title = '降级为二级';
        levelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._editorIndentItem(item.id);
        });
      }
      row.appendChild(levelBtn);

      // 删除按钮
      const delBtn = document.createElement('button');
      delBtn.className = 'nei-btn delete';
      delBtn.type = 'button';
      delBtn.innerHTML = '<span class="material-icons">close</span>';
      delBtn.title = '删除';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._editorDeleteItem(item.id);
      });
      row.appendChild(delBtn);
    } else {
      // 卡片预览：纯文本
      const text = document.createElement('span');
      text.className = 'note-item-text';
      text.textContent = item.text;
      row.appendChild(text);
    }

    return row;
  },

  // =============================================================
  // 便签操作
  // =============================================================

  _createNote() {
    const now = Date.now();
    return {
      id: Store.generateId(),
      title: '',
      color: 'gold',
      pinned: false,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
  },

  _togglePin(note) {
    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    this._persist();
    this._render();
  },

  _deleteNote(note) {
    const idx = this._state.notes.findIndex(n => n.id === note.id);
    if (idx < 0) return;
    this._state.notes.splice(idx, 1);
    this._persist();
    this._render();
    showSnackbar('便签已删除');
  },

  // =============================================================
  // 事项操作（卡片预览模式，直接持久化）
  // =============================================================

  _toggleItem(note, itemId) {
    const item = note.items.find(i => i.id === itemId);
    if (!item) return;
    const newCompleted = !item.completed;
    item.completed = newCompleted;

    const affectedIds = new Set([itemId]);

    // 级联：勾选/取消勾选一级事项时，所有子事项双向同步
    if (item.parentId === null) {
      note.items.forEach(child => {
        if (child.parentId === item.id) {
          child.completed = newCompleted;
          affectedIds.add(child.id);
        }
      });
    }

    note.updatedAt = Date.now();
    this._persist();

    // 增量更新 DOM，避免整卡重渲染闪烁
    this._updateCardItemStates(note.id, affectedIds, newCompleted);
    this._updateCardProgress(note);
  },

  _updateCardItemStates(noteId, affectedIds, newCompleted) {
    const card = document.querySelector(`.note-card[data-note-id="${noteId}"]`);
    if (!card) return;

    affectedIds.forEach(itemId => {
      const row = card.querySelector(`.note-item[data-item-id="${itemId}"]`);
      if (!row) return;
      row.classList.toggle('completed', newCompleted);
      const check = row.querySelector('.note-check');
      if (check) {
        check.innerHTML = newCompleted ? '<span class="material-icons">check</span>' : '';
      }
    });
  },

  _updateCardProgress(note) {
    const card = document.querySelector(`.note-card[data-note-id="${note.id}"]`);
    if (!card) return;

    const progress = this._computeProgress(note);
    const fill = card.querySelector('.note-progress-fill');
    if (fill) {
      fill.style.width = (progress * 100) + '%';
    }

    const counter = card.querySelector('.note-counter');
    if (counter) {
      const completed = note.items.filter(i => i.completed).length;
      counter.textContent = `${completed}/${note.items.length}`;
    }

    card.classList.toggle('completed', progress === 1 && note.items.length > 0);
  },

  // =============================================================
  // 事项层级与排序（数据层）
  // =============================================================

  /**
   * 获取排序后的事项列表（父→子的扁平展开）
   * 返回 [{ item, isChild }, ...]
   */
  _getOrderedItems(note) {
    const topLevel = note.items
      .filter(i => i.parentId === null)
      .sort((a, b) => a.order - b.order);

    const result = [];
    topLevel.forEach(parent => {
      result.push({ item: parent, isChild: false });
      const children = note.items
        .filter(i => i.parentId === parent.id)
        .sort((a, b) => a.order - b.order);
      children.forEach(child => {
        result.push({ item: child, isChild: true });
      });
    });
    return result;
  },

  _computeProgress(note) {
    if (note.items.length === 0) return 0;
    const completed = note.items.filter(i => i.completed).length;
    return completed / note.items.length;
  },

  /** 重新编号 order（按当前 _getOrderedItems 顺序） */
  _renumberItems(note) {
    const ordered = this._getOrderedItems(note);
    ordered.forEach((entry, idx) => {
      entry.item.order = idx;
    });
  },

  // =============================================================
  // 卡片间拖拽（HTML5 D&D）
  // =============================================================

  _bindCardDrag(grid) {
    const isCoarse = window.matchMedia('(any-pointer: coarse)').matches;

    grid.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.note-card');
      if (!card || !card.draggable) return;
      e.dataTransfer.setData('text/plain', card.dataset.noteId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    grid.addEventListener('dragend', (e) => {
      const card = e.target.closest('.note-card');
      if (!card) return;
      card.classList.remove('dragging');
      card.draggable = false;
      grid.querySelectorAll('.note-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    });

    grid.addEventListener('dragover', (e) => {
      const card = e.target.closest('.note-card');
      if (!card) return;
      e.preventDefault();
      grid.querySelectorAll('.note-card.drag-over').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });

    grid.addEventListener('dragleave', (e) => {
      const card = e.target.closest('.note-card');
      if (card) card.classList.remove('drag-over');
    });

    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetCard = e.target.closest('.note-card');
      if (!targetCard) return;
      const fromId = e.dataTransfer.getData('text/plain');
      const toId = targetCard.dataset.noteId;
      if (!fromId || fromId === toId) return;

      this._reorderNotes(fromId, toId);
    });

    // 移动端触摸拖拽
    if (isCoarse) {
      this._bindCardTouchDrag(grid);
    }
  },

  _reorderNotes(fromId, toId) {
    const notes = this._state.notes;
    const fromIdx = notes.findIndex(n => n.id === fromId);
    const toIdx = notes.findIndex(n => n.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    // 仅在同类型（pinned/regular）间重排
    if (notes[fromIdx].pinned !== notes[toIdx].pinned) return;

    const [moved] = notes.splice(fromIdx, 1);
    notes.splice(toIdx, 0, moved);
    this._persist();
    this._render();
  },

  _bindCardTouchDrag(grid) {
    let dragState = null;

    grid.addEventListener('touchstart', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const card = handle.closest('.note-card');
      if (!card) return;
      const touch = e.touches[0];
      dragState = {
        card,
        fromId: card.dataset.noteId,
        startY: touch.clientY,
        startX: touch.clientX,
        isDragging: false,
      };
    }, { passive: true });

    grid.addEventListener('touchmove', (e) => {
      if (!dragState) return;
      const touch = e.touches[0];

      if (!dragState.isDragging) {
        const dy = Math.abs(touch.clientY - dragState.startY);
        const dx = Math.abs(touch.clientX - dragState.startX);
        if (dy < 8 && dx < 8) return;

        dragState.isDragging = true;
        const card = dragState.card;
        const rect = card.getBoundingClientRect();
        dragState.startRect = rect;

        card.classList.add('touch-dragging');
        card.style.position = 'fixed';
        card.style.zIndex = '999';
        card.style.left = rect.left + 'px';
        card.style.top = rect.top + 'px';
        card.style.width = rect.width + 'px';
        card.style.pointerEvents = 'none';

        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = rect.height + 'px';
        dragState.placeholder = placeholder;
        card.parentNode.insertBefore(placeholder, card);

        if (navigator.vibrate) navigator.vibrate(20);
      }

      e.preventDefault();
      const { card, startRect } = dragState;
      card.style.top = (touch.clientY - startRect.height / 2) + 'px';
      card.style.left = (touch.clientX - startRect.width / 2) + 'px';

      // 临时隐藏拖动卡，找到下方元素
      card.style.visibility = 'hidden';
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      card.style.visibility = '';

      grid.querySelectorAll('.note-card.drag-over').forEach(c => c.classList.remove('drag-over'));
      const targetCard = target?.closest('.note-card');
      if (targetCard && targetCard !== card) {
        targetCard.classList.add('drag-over');
        dragState.targetId = targetCard.dataset.noteId;

        // 移动占位符
        const rect = targetCard.getBoundingClientRect();
        if (touch.clientY < rect.top + rect.height / 2) {
          targetCard.parentNode.insertBefore(dragState.placeholder, targetCard);
        } else {
          targetCard.parentNode.insertBefore(dragState.placeholder, targetCard.nextSibling);
        }
      } else {
        dragState.targetId = null;
      }
    }, { passive: false });

    const endTouchDrag = () => {
      if (!dragState) return;
      if (dragState.isDragging) {
        const { card, fromId, targetId, placeholder } = dragState;
        if (placeholder) placeholder.remove();
        card.classList.remove('touch-dragging');
        card.style.cssText = '';
        grid.querySelectorAll('.note-card.drag-over').forEach(c => c.classList.remove('drag-over'));
        dragState = null;
        if (targetId && targetId !== fromId) {
          this._reorderNotes(fromId, targetId);
        } else {
          this._render();
        }
      } else {
        dragState = null;
      }
    };

    grid.addEventListener('touchend', endTouchDrag);
    grid.addEventListener('touchcancel', endTouchDrag);
  },

  // =============================================================
  // 编辑器对话框
  // =============================================================

  _openEditor(note) {
    const isEdit = !!note;
    // 编辑时使用副本，取消不污染原数据
    const draft = isEdit ? JSON.parse(JSON.stringify(note)) : this._createNote();
    let dialogClose; // will be set after createDialog

    // --- 表体 ---
    const body = document.createElement('div');
    body.className = 'note-editor-body';

    // 标题输入
    body.appendChild(fieldLabel('便签标题'));
    const titleWrap = document.createElement('div');
    titleWrap.className = 'wf-chip silver field-wrap';
    const titleInput = document.createElement('input');
    titleInput.className = 'field-input';
    titleInput.placeholder = '例如：本周紫卡洗炼目标…';
    titleInput.value = draft.title || '';
    titleInput.autofocus = true;
    titleWrap.appendChild(titleInput);
    body.appendChild(titleWrap);
    body.appendChild(sizedBox(14));

    // 主题色
    body.appendChild(fieldLabel('主题色'));
    const colorRow = document.createElement('div');
    colorRow.className = 'note-editor-colors';
    NOTE_COLORS.forEach(c => {
      const chip = document.createElement('div');
      chip.className = `wf-chip ${c} note-color-chip` + (draft.color === c ? ' selected' : '');
      chip.title = c;
      if (draft.color === c) {
        const check = document.createElement('span');
        check.className = 'color-check';
        check.textContent = '✓';
        chip.appendChild(check);
      }
      chip.addEventListener('click', () => {
        colorRow.querySelectorAll('.note-color-chip').forEach(x => {
          x.classList.remove('selected');
          x.querySelectorAll('.color-check').forEach(s => s.remove());
        });
        chip.classList.add('selected');
        const check = document.createElement('span');
        check.className = 'color-check';
        check.textContent = '✓';
        chip.appendChild(check);
        draft.color = c;
        dialog.box.className = `wf-card ${c} dialog-box note-editor-box`;
      });
      colorRow.appendChild(chip);
    });
    body.appendChild(colorRow);
    body.appendChild(sizedBox(14));

    // 置顶开关
    body.appendChild(fieldLabel('置顶'));
    const pinToggle = document.createElement('div');
    pinToggle.className = 'note-editor-pin' + (draft.pinned ? ' active' : '');
    pinToggle.innerHTML = `
      <div class="wf-chip silver pin-checkbox">${draft.pinned ? '<span class="material-icons">check</span>' : ''}</div>
      <span class="pin-label">${draft.pinned ? '已置顶（在顶部独立显示）' : '设为置顶便签'}</span>
    `;
    pinToggle.addEventListener('click', () => {
      draft.pinned = !draft.pinned;
      pinToggle.classList.toggle('active', draft.pinned);
      pinToggle.querySelector('.pin-checkbox').innerHTML = draft.pinned ? '<span class="material-icons">check</span>' : '';
      pinToggle.querySelector('.pin-label').textContent = draft.pinned ? '已置顶（在顶部独立显示）' : '设为置顶便签';
    });
    body.appendChild(pinToggle);
    body.appendChild(sizedBox(14));

    // 事项列表
    body.appendChild(fieldLabel('事项清单'));
    const itemsList = document.createElement('div');
    itemsList.className = 'note-editor-items';
    body.appendChild(itemsList);

    // 新增事项输入行
    const addRow = document.createElement('div');
    addRow.className = 'nei-add-row';
    addRow.innerHTML = `
      <span class="material-icons nei-add-icon">add</span>
      <input type="text" class="nei-add-input" placeholder="添加新事项，回车确认…" />
    `;
    const addInput = addRow.querySelector('.nei-add-input');
    const addBtn = document.createElement('div');
    addBtn.className = 'wf-chip gold nei-add-btn';
    addBtn.innerHTML = '<span>+</span>';
    addBtn.addEventListener('click', () => this._editorAddItem(null));
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._editorAddItem(null);
      }
    });
    addRow.appendChild(addBtn);
    body.appendChild(addRow);

    // 底部进度提示
    body.appendChild(sizedBox(8));
    const footInfo = document.createElement('div');
    footInfo.className = 'note-editor-foot-info';
    footInfo.innerHTML = `
      <span class="material-icons">info</span>
      <span class="foot-info-text"></span>
    `;
    body.appendChild(footInfo);

    // --- 底部按钮 ---
    const footer = document.createElement('div');

    if (isEdit) {
      const delBtn = createBtn({
        text: '删除',
        outline: true,
        danger: true,
        onClick: async () => {
          const confirmed = await confirmDialog({
            title: '删除便签',
            message: '确定删除此便签？此操作不可撤销。',
            confirmText: '删除',
            danger: true,
            color: 'silver',
          });
          if (confirmed) {
            const realNote = this._state.notes.find(n => n.id === draft.id);
            if (realNote) this._deleteNote(realNote);
            dialogClose();
          }
        },
      });
      delBtn.style.flex = '0 0 auto';
      delBtn.style.width = 'auto';
      delBtn.style.padding = '0 16px';
      footer.appendChild(delBtn);
    }

    footer.appendChild(createBtn({
      text: '取消',
      outline: true,
      onClick: () => dialogClose(),
    }));

    footer.appendChild(createBtn({
      text: isEdit ? '保存' : '创建',
      primary: true,
      onClick: () => {
        this._editorSave();
        dialogClose();
      },
    }));

    const dialog = createDialog({
      title: isEdit ? '编辑便签' : '新建便签',
      body,
      footer,
      className: 'note-editor-box',
      closeOnOverlay: true,
      closeOnEscape: true,
      onClose: () => {
        this._editor = null;
      },
    });
    dialogClose = dialog.close;

    // 设置初始颜色类
    dialog.box.className = `wf-card ${draft.color || 'gold'} dialog-box note-editor-box`;

    // --- 编辑器状态 ---
    this._editor = {
      draft,
      itemsList,
      addInput,
      titleInput,
      footInfoText: footInfo.querySelector('.foot-info-text'),
      dirty: false,
    };

    this._editorRenderItems();
  },

  _editorRenderItems() {
    const { draft, itemsList } = this._editor;
    clearEl(itemsList);

    const ordered = this._getOrderedItems(draft);

    if (ordered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'note-editor-empty';
      empty.innerHTML = `
        <span class="material-icons empty-icon">playlist_add</span>
        <span class="empty-text">添加你的第一个目标</span>
        <span class="empty-desc">在下方输入事项内容并回车，或点击 + 按钮添加</span>
      `;
      itemsList.appendChild(empty);
    } else {
      ordered.forEach(({ item, isChild }) => {
        itemsList.appendChild(this._createItemRow(item, isChild, true, null));
      });
    }

    this._editorUpdateFootInfo();
    // 拖拽监听只需绑定一次（使用 on* 属性避免累积）
    if (!this._editor.dragBound) {
      this._bindEditorItemDrag();
      this._editor.dragBound = true;
    }
  },

  _editorUpdateFootInfo() {
    const { draft, footInfoText } = this._editor;
    const total = draft.items.length;
    const completed = draft.items.filter(i => i.completed).length;
    const pct = total === 0 ? 0 : Math.round(completed / total * 100);
    footInfoText.textContent = total === 0
      ? '尚未添加任何事项'
      : `共 ${total} 项 · 已完成 ${completed} 项 · 进度 ${pct}%`;
  },

  _editorAddItem(parentId) {
    const { draft, addInput } = this._editor;
    const text = addInput.value.trim();
    if (!text) {
      addInput.focus();
      return;
    }
    const item = {
      id: Store.generateId(),
      text,
      completed: false,
      parentId: parentId,
      order: draft.items.length,
    };
    draft.items.push(item);
    draft.updatedAt = Date.now();
    addInput.value = '';
    this._editor.dirty = true;
    this._editorRenderItems();
    addInput.focus();
  },

  _editorToggleItem(itemId) {
    const { draft } = this._editor;
    const item = draft.items.find(i => i.id === itemId);
    if (!item) return;
    const newCompleted = !item.completed;
    item.completed = newCompleted;
    // 级联：勾选/取消勾选一级事项时，所有子事项双向同步
    if (item.parentId === null) {
      draft.items.forEach(child => {
        if (child.parentId === item.id) child.completed = newCompleted;
      });
    }
    draft.updatedAt = Date.now();
    this._editor.dirty = true;
    this._editorRenderItems();
  },

  _editorDeleteItem(itemId) {
    const { draft } = this._editor;
    // 同时删除其子事项
    draft.items = draft.items.filter(i => i.id !== itemId && i.parentId !== itemId);
    draft.updatedAt = Date.now();
    this._editor.dirty = true;
    this._editorRenderItems();
  },

  _editorIndentItem(itemId) {
    const { draft } = this._editor;
    const item = draft.items.find(i => i.id === itemId);
    if (!item || item.parentId !== null) return;

    // 找到前一个一级事项作为父
    const ordered = this._getOrderedItems(draft);
    let prevParent = null;
    for (const entry of ordered) {
      if (entry.item.id === itemId) break;
      if (!entry.isChild) prevParent = entry.item;
    }
    if (!prevParent) {
      showSnackbar('已是首位，无法降级');
      return;
    }
    item.parentId = prevParent.id;
    draft.updatedAt = Date.now();
    this._editor.dirty = true;
    this._editorRenderItems();
  },

  _editorOutdentItem(itemId) {
    const { draft } = this._editor;
    const item = draft.items.find(i => i.id === itemId);
    if (!item || item.parentId === null) return;
    item.parentId = null;
    draft.updatedAt = Date.now();
    this._editor.dirty = true;
    this._editorRenderItems();
  },

  _editorSave() {
    const { draft, titleInput } = this._editor;
    // 同步标题
    if (titleInput) draft.title = titleInput.value.trim();

    // 清理空文本事项
    draft.items = draft.items.filter(i => i.text.trim() !== '');
    this._renumberItems(draft);
    draft.updatedAt = Date.now();

    const existingIdx = this._state.notes.findIndex(n => n.id === draft.id);
    if (existingIdx >= 0) {
      this._state.notes[existingIdx] = draft;
    } else {
      this._state.notes.push(draft);
    }
    this._persist();
    this._render();
    showSnackbar(existingIdx >= 0 ? '便签已更新' : '便签已创建');
  },

  // =============================================================
  // 编辑器内事项拖拽（HTML5 D&D，仅桌面）
  // =============================================================

  _bindEditorItemDrag() {
    const list = this._editor.itemsList;
    const isCoarse = window.matchMedia('(any-pointer: coarse)').matches;

    list.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.note-editor-item');
      if (!row || !row.draggable) return;
      e.dataTransfer.setData('text/plain', row.dataset.itemId);
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });

    list.addEventListener('dragend', (e) => {
      const row = e.target.closest('.note-editor-item');
      if (!row) return;
      row.classList.remove('dragging');
      row.draggable = false;
      list.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(r => {
        r.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });

    list.addEventListener('dragover', (e) => {
      const row = e.target.closest('.note-editor-item');
      if (!row) return;
      e.preventDefault();
      list.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(r => {
        r.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      const rect = row.getBoundingClientRect();
      const isAbove = e.clientY < rect.top + rect.height / 2;
      row.classList.add(isAbove ? 'drag-over-top' : 'drag-over-bottom');
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetRow = e.target.closest('.note-editor-item');
      if (!targetRow) return;
      const fromId = e.dataTransfer.getData('text/plain');
      const toId = targetRow.dataset.itemId;
      if (!fromId || fromId === toId) return;

      const rect = targetRow.getBoundingClientRect();
      const placeBefore = e.clientY < rect.top + rect.height / 2;
      this._editorReorder(fromId, toId, placeBefore);
    });

    if (isCoarse) {
      this._bindEditorItemTouchDrag(list);
    }
  },

  /**
   * 重排事项：将 fromId 移动到 toId 之前或之后
   * 规则：
   *   - 子事项不能跨越父事项分组
   *   - 父事项移动时，其所有子事项跟随移动
   */
  _editorReorder(fromId, toId, placeBefore) {
    const { draft } = this._editor;
    const fromItem = draft.items.find(i => i.id === fromId);
    const toItem = draft.items.find(i => i.id === toId);
    if (!fromItem || !toItem) return;

    // 不允许把父事项拖到自己的子事项位置
    if (toItem.parentId === fromId) return;

    const ordered = this._getOrderedItems(draft);
    // 收集 fromItem 及其子事项（若为父）
    const movingGroup = [];
    const fromIdx = ordered.findIndex(e => e.item.id === fromId);
    if (fromIdx < 0) return;

    movingGroup.push(ordered[fromIdx]);
    if (fromItem.parentId === null) {
      // 收集子事项
      for (let i = fromIdx + 1; i < ordered.length; i++) {
        if (!ordered[i].isChild) break;
        movingGroup.push(ordered[i]);
      }
    }

    // 计算目标位置
    let toIdx = ordered.findIndex(e => e.item.id === toId);
    if (toIdx < 0) return;

    // 从原列表移除 movingGroup
    const movingIds = new Set(movingGroup.map(e => e.item.id));
    const remaining = ordered.filter(e => !movingIds.has(e.item.id));

    // 在 remaining 中找到 toItem 的新位置
    const newToIdx = remaining.findIndex(e => e.item.id === toId);
    if (newToIdx < 0) return;

    const insertIdx = placeBefore ? newToIdx : newToIdx + 1;

    // 若 toItem 是子事项，但 fromItem 是父事项（跨层移动），则将 fromItem 升级为一级
    if (fromItem.parentId === null && toItem.parentId !== null) {
      // 父事项插入到子事项位置：实际应插入到该子事项的父事项之前或之后
      // 简化处理：插到父事项所在组之外
      const parentIdx = remaining.findIndex(e => e.item.id === toItem.parentId);
      if (parentIdx < 0) return;
      // 找到该父事项组的末尾
      let groupEnd = parentIdx + 1;
      while (groupEnd < remaining.length && remaining[groupEnd].isChild) groupEnd++;
      const finalIdx = placeBefore ? parentIdx : groupEnd;
      remaining.splice(finalIdx, 0, ...movingGroup);
    } else if (fromItem.parentId !== null && toItem.parentId === null) {
      // 子事项拖到父事项位置：升级为一级
      fromItem.parentId = null;
      remaining.splice(insertIdx, 0, ...movingGroup);
    } else if (fromItem.parentId !== null && toItem.parentId !== null) {
      // 子→子：若不同父，挂到 toItem 的父之下
      if (fromItem.parentId !== toItem.parentId) {
        fromItem.parentId = toItem.parentId;
      }
      remaining.splice(insertIdx, 0, ...movingGroup);
    } else {
      // 父→父
      remaining.splice(insertIdx, 0, ...movingGroup);
    }

    // 重新构建 items 数组并按 remaining 顺序编号
    remaining.forEach((entry, idx) => {
      entry.item.order = idx;
    });
    draft.items = remaining.map(e => e.item);
    draft.updatedAt = Date.now();
    this._editor.dirty = true;
    this._editorRenderItems();
  },

  _bindEditorItemTouchDrag(list) {
    let dragState = null;

    list.addEventListener('touchstart', (e) => {
      const handle = e.target.closest('.nei-btn.drag');
      if (!handle) return;
      const row = handle.closest('.note-editor-item');
      if (!row) return;
      const touch = e.touches[0];
      dragState = {
        row,
        fromId: row.dataset.itemId,
        startY: touch.clientY,
        isDragging: false,
      };
    }, { passive: true });

    list.addEventListener('touchmove', (e) => {
      if (!dragState) return;
      const touch = e.touches[0];

      if (!dragState.isDragging) {
        const dy = Math.abs(touch.clientY - dragState.startY);
        if (dy < 8) return;
        dragState.isDragging = true;
        const row = dragState.row;
        const rect = row.getBoundingClientRect();
        dragState.startRect = rect;
        dragState.rowHeight = rect.height;
        row.classList.add('dragging');
        if (navigator.vibrate) navigator.vibrate(20);
      }

      e.preventDefault();

      // 找到当前手指下方的行
      const row = dragState.row;
      row.style.visibility = 'hidden';
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      row.style.visibility = '';

      list.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(r => {
        r.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      const targetRow = target?.closest('.note-editor-item');
      if (targetRow && targetRow !== row) {
        const rect = targetRow.getBoundingClientRect();
        const isAbove = touch.clientY < rect.top + rect.height / 2;
        targetRow.classList.add(isAbove ? 'drag-over-top' : 'drag-over-bottom');
        dragState.targetId = targetRow.dataset.itemId;
        dragState.placeBefore = isAbove;
      } else {
        dragState.targetId = null;
      }
    }, { passive: false });

    const endTouchDrag = () => {
      if (!dragState) return;
      if (dragState.isDragging) {
        const { row, fromId, targetId, placeBefore } = dragState;
        row.classList.remove('dragging');
        row.style.visibility = '';
        list.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(r => {
          r.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        dragState = null;
        if (targetId && targetId !== fromId) {
          this._editorReorder(fromId, targetId, placeBefore);
        }
      } else {
        dragState = null;
      }
    };

    list.addEventListener('touchend', endTouchDrag);
    list.addEventListener('touchcancel', endTouchDrag);
  },
};

// 暴露给全局
