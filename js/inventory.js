/**
 * inventory.js — 仓库 Prime 部件计数器
 * 用户手动记录金/银/铜垃圾数量
 */

const INV_CATEGORIES = [
  { key: 'gold',   label: '金垃圾', icon: 'stars',              accent: 'gold',   desc: '100 杜卡德金币' },
  { key: 'silver', label: '银垃圾', icon: 'workspace_premium', accent: 'silver', desc: '45 杜卡德金币' },
  { key: 'bronze', label: '铜垃圾', icon: 'military_tech',     accent: 'bronze', desc: '15 杜卡德金币' },
];

const Inventory = {
  _state: {
    counts: { gold: 0, silver: 0, bronze: 0 },
  },

  _els: {},

  init(container) {
    this._els.container = container;
    this._loadCounts();
    this._render();
  },

  reloadFromStore() {
    this._loadCounts();
    this._updateAllCounts();
  },

  _loadCounts() {
    this._state.counts = Store.loadInventory();
  },

  _saveCounts() {
    Store.saveInventory(this._state.counts);
  },

  _render() {
    this._els.container.innerHTML = `
      <div class="inventory-page">
        <div class="inventory-header page-header">
          <div class="header-row">
            <button class="nav-trigger-inline" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
              <span class="material-icons mi-md">dashboard</span>
            </button>
            <div>
              <div class="page-brand-title">WARFRAME</div>
              <div class="page-brand-sub">INVENTORY / 仓库计数</div>
            </div>
            <div class="page-spacer"></div>
          </div>
        </div>

        <div class="inventory-content">
          <div class="inventory-grid" id="inv-grid"></div>
        </div>
      </div>
    `;

    this._els.grid = document.getElementById('inv-grid');
    this._renderCards();
  },

  _renderCards() {
    clearEl(this._els.grid);
    const frag = document.createDocumentFragment();
    for (const cat of INV_CATEGORIES) {
      frag.appendChild(this._createCard(cat));
    }
    this._els.grid.appendChild(frag);
  },

  _createCard(cat) {
    const card = document.createElement('div');
    card.className = `wf-card ${cat.accent} flow inventory-card`;
    card.style.setProperty('--card-chamfer', '14px');
    card.dataset.key = cat.key;

    const count = this._state.counts[cat.key] || 0;

    card.innerHTML = `
      <div class="inventory-card-inner">
        <div class="inventory-card-head">
          <span class="material-icons inventory-card-icon">${cat.icon}</span>
          <div class="inventory-card-title">${cat.label}</div>
        </div>
        <div class="inventory-card-desc">${cat.desc}</div>
        <div class="inventory-count-display">
          <span class="inventory-count-number">${count}</span>
        </div>
        <div class="inventory-btn-group">
          <button class="wf-btn primary inventory-btn" data-action="add" data-key="${cat.key}" data-delta="1">
            <span>+1</span>
          </button>
          <button class="wf-btn outline inventory-btn" data-action="sub" data-key="${cat.key}" data-delta="-1">
            <span>-1</span>
          </button>
          <button class="wf-btn outline inventory-btn" data-action="sub" data-key="${cat.key}" data-delta="-6">
            <span>-6</span>
          </button>
          <button class="wf-btn outline inventory-btn-icon" data-action="edit" data-key="${cat.key}" title="编辑">
            <span class="material-icons mi-sm">edit</span>
          </button>
        </div>
      </div>
    `;

    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const key = btn.dataset.key;
        if (action === 'edit') {
          this._openEditDialog(key);
        } else {
          const delta = parseInt(btn.dataset.delta, 10);
          this._adjust(key, delta);
        }
      });
    });

    return card;
  },

  _adjust(key, delta) {
    const cur = this._state.counts[key] || 0;
    const next = Math.max(0, cur + delta);
    if (next === cur) return;
    this._state.counts[key] = next;
    this._saveCounts();
    this._updateCount(key, next);
  },

  _updateCount(key, value) {
    const el = this._els.container.querySelector(`.inventory-card[data-key="${key}"] .inventory-count-number`);
    if (!el) return;
    el.textContent = value;
    el.classList.remove('count-bump');
    void el.offsetWidth;
    el.classList.add('count-bump');
  },

  _updateAllCounts() {
    for (const cat of INV_CATEGORIES) {
      this._updateCount(cat.key, this._state.counts[cat.key] || 0);
    }
  },

  _openEditDialog(key) {
    const cat = INV_CATEGORIES.find(c => c.key === key);
    if (!cat) return;
    const current = this._state.counts[key] || 0;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="wf-card gold dialog-box" style="--card-chamfer:14px;">
        <div class="dialog-header">
          <div class="bar"></div>
          <div class="title">编辑 ${cat.label}</div>
          <div class="dialog-close wf-chip">
            <span class="material-icons">close</span>
          </div>
        </div>
        <div class="dialog-body">
          <div class="field-label">数量</div>
          <div class="wf-chip silver field-wrap">
            <input type="number" class="field-input inventory-edit-input" value="${current}" min="0" placeholder="输入数量" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="wf-btn outline" data-action="cancel">取消</button>
          <button class="wf-btn primary" data-action="save">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.inventory-edit-input');
    const closeBtn = overlay.querySelector('.dialog-close');
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const saveBtn = overlay.querySelector('[data-action="save"]');

    requestAnimationFrame(() => overlay.classList.add('open'));
    setTimeout(() => { input.focus(); input.select(); }, 200);

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    };

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    saveBtn.addEventListener('click', () => {
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) {
        showSnackbar('请输入有效的非负整数');
        return;
      }
      this._state.counts[key] = val;
      this._saveCounts();
      this._updateCount(key, val);
      close();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') close();
    });
  },
};

window.Inventory = Inventory;
