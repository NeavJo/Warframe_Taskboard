/**
 * drag_utils.js — 通用拖拽工具模块
 *
 * 提取自 notes.js 和 components.js 的重复拖拽逻辑
 * 支持 HTML5 Drag & Drop (桌面) 和 Touch Events (移动端)
 */

const DragUtils = {
  /**
   * 设置 HTML5 拖拽 (桌面端)
   * @param {HTMLElement} container - 拖拽容器
   * @param {string} itemSelector - 可拖拽项选择器
   * @param {Object} callbacks
   * @param {Function} callbacks.onDragStart - 拖拽开始回调
   * @param {Function} callbacks.onDragEnd - 拖拽结束回调
   * @param {Function} callbacks.onDrop - 拖拽放置回调 (fromId, toId, placeBefore)
   * @param {Function} [callbacks.getDragId] - 自定义获取拖拽ID的方法
   */
  setupHtml5Drag(container, itemSelector, callbacks) {
    const { onDragStart, onDragEnd, onDrop, getDragId } = callbacks;

    container.addEventListener('dragstart', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item || !item.draggable) return;

      const dragId = getDragId ? getDragId(item) : item.dataset.id || item.dataset.itemId || item.dataset.noteId;
      e.dataTransfer.setData('text/plain', dragId);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');

      if (onDragStart) onDragStart(item, dragId);
    });

    container.addEventListener('dragend', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item) return;

      item.classList.remove('dragging');
      item.draggable = false;

      // 清理所有拖拽标记样式
      container.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
      });

      if (onDragEnd) onDragEnd(item);
    });

    container.addEventListener('dragover', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item) return;

      e.preventDefault();
      container.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
      });

      // 判断放置位置（上方/下方）
      const rect = item.getBoundingClientRect();
      const isAbove = e.clientY < rect.top + rect.height / 2;
      item.classList.add(isAbove ? 'drag-over-top' : 'drag-over-bottom');
    });

    container.addEventListener('dragleave', (e) => {
      const item = e.target.closest(itemSelector);
      if (item) {
        item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetItem = e.target.closest(itemSelector);
      if (!targetItem) return;

      const fromId = e.dataTransfer.getData('text/plain');
      const toId = getDragId ? getDragId(targetItem) : targetItem.dataset.id || targetItem.dataset.itemId || targetItem.dataset.noteId;

      if (!fromId || fromId === toId) return;

      const rect = targetItem.getBoundingClientRect();
      const placeBefore = e.clientY < rect.top + rect.height / 2;

      if (onDrop) onDrop(fromId, toId, placeBefore);
    });
  },

  /**
   * 设置触摸拖拽 (移动端)
   * @param {HTMLElement} container - 拖拽容器
   * @param {string} itemSelector - 可拖拽项选择器
   * @param {string} handleSelector - 拖拽手柄选择器
   * @param {Object} callbacks
   * @param {Function} callbacks.onDrop - 拖拽放置回调 (fromId, toId, placeBefore)
   * @param {Function} [callbacks.getDragId] - 自定义获取拖拽ID的方法
   * @param {number} [threshold=8] - 触发拖拽的移动阈值(px)
   */
  setupTouchDrag(container, itemSelector, handleSelector, callbacks) {
    const { onDrop, getDragId, threshold = 8 } = callbacks;

    let dragState = null;

    container.addEventListener('touchstart', (e) => {
      const handle = e.target.closest(handleSelector);
      if (!handle) return;

      const item = handle.closest(itemSelector);
      if (!item) return;

      const touch = e.touches[0];
      dragState = {
        item,
        fromId: getDragId ? getDragId(item) : item.dataset.id || item.dataset.itemId || item.dataset.noteId,
        startY: touch.clientY,
        startX: touch.clientX,
        isDragging: false,
      };
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!dragState) return;

      const touch = e.touches[0];

      if (!dragState.isDragging) {
        const dy = Math.abs(touch.clientY - dragState.startY);
        const dx = Math.abs(touch.clientX - dragState.startX);
        if (dy < threshold && dx < threshold) return;

        dragState.isDragging = true;
        const item = dragState.item;
        const rect = item.getBoundingClientRect();
        dragState.startRect = rect;

        item.classList.add('touch-dragging');
        item.style.position = 'fixed';
        item.style.zIndex = '999';
        item.style.left = rect.left + 'px';
        item.style.top = rect.top + 'px';
        item.style.width = rect.width + 'px';
        item.style.pointerEvents = 'none';

        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = rect.height + 'px';
        dragState.placeholder = placeholder;
        item.parentNode.insertBefore(placeholder, item);

        if (navigator.vibrate) navigator.vibrate(20);
      }

      e.preventDefault();

      const { item, startRect } = dragState;
      item.style.top = (touch.clientY - startRect.height / 2) + 'px';
      item.style.left = (touch.clientX - startRect.width / 2) + 'px';

      // 临时隐藏拖动元素，找到下方目标
      item.style.visibility = 'hidden';
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      item.style.visibility = '';

      container.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
      });

      const targetItem = target?.closest(itemSelector);
      if (targetItem && targetItem !== item) {
        const rect = targetItem.getBoundingClientRect();
        const isAbove = touch.clientY < rect.top + rect.height / 2;
        targetItem.classList.add(isAbove ? 'drag-over-top' : 'drag-over-bottom');
        dragState.targetId = getDragId ? getDragId(targetItem) : targetItem.dataset.id || targetItem.dataset.itemId || targetItem.dataset.noteId;
        dragState.placeBefore = isAbove;

        // 移动占位符
        if (dragState.placeholder) {
          if (isAbove) {
            targetItem.parentNode.insertBefore(dragState.placeholder, targetItem);
          } else {
            targetItem.parentNode.insertBefore(dragState.placeholder, targetItem.nextSibling);
          }
        }
      } else {
        dragState.targetId = null;
      }
    }, { passive: false });

    const endTouchDrag = () => {
      if (!dragState) return;

      if (dragState.isDragging) {
        const { item, fromId, targetId, placeBefore, placeholder } = dragState;

        if (placeholder) placeholder.remove();
        item.classList.remove('touch-dragging');
        item.style.cssText = '';

        container.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
          el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });

        if (targetId && targetId !== fromId && onDrop) {
          onDrop(fromId, targetId, placeBefore);
        }

        dragState = null;
      } else {
        dragState = null;
      }
    };

    container.addEventListener('touchend', endTouchDrag);
    container.addEventListener('touchcancel', endTouchDrag);
  },

  /**
   * 判断是否为触摸设备
   */
  isTouchDevice() {
    return window.matchMedia('(any-pointer: coarse)').matches;
  },
};