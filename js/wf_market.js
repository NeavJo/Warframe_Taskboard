/**
 * wf_market.js — Warframe Market 查价页
 *
 * 功能：
 *   - 启动时拉取全量物品清单用于自动补全
 *   - 搜索框输入实时模糊匹配 + 键盘上下/Enter + 鼠标点选
 *   - 选中物品后请求在线卖单并计算底价/众数/切尾均价/卖家数
 *   - 一键复制 /w 白金私聊指令
 *
 * 依赖 API (v2)：
 *   GET https://api.warframe.market/v2/items             (Language, Platform)
 *   GET https://api.warframe.market/v2/orders/item/{slug}  (Platform, Crossplay)
 *
 * 数据结构：
 *   WmItem   { id, slug, slugL, name, nameL, nameEn, nameEnL, nameZh, nameZhL }
 *   WmOrder  { type, platinum, quantity, user: { status, ingameName } }
 *   PriceStat{ floor, mode, avg, sellers, slug, itemName }
 */

// ===== 常量 =====
const WM_API_ORIGIN = 'https://api.warframe.market/v2';
const WM_IMG_CDN_ORIGIN = 'https://cdn.jsdelivr.net/gh/WFCD/warframe-items@master/data/img';
const WM_AUTOCOMPLETE_LIMIT = 10;
const WM_SEARCH_DEBOUNCE = 80;
const WM_QUERY_CACHE_TTL = 60 * 1000;
const WM_FETCH_TIMEOUT = 15000; // 单个请求 15s 超时
const WM_ITEMS_CACHE_KEY = 'wf_market_items_cache_v4';
const WM_ITEMS_CACHE_TTL = 24 * 60 * 60 * 1000; // 物品清单缓存 24h（后台静默更新保证新鲜度）

const WM_LANG = 'zh-hans';
const WM_PLATFORM = 'pc';
const WM_CROSSPLAY = 'true';

const WM_IS_LOCAL = (function() {
  const h = location.hostname;
  if (h === '127.0.0.1' || h === 'localhost') return true;
  if (location.protocol === 'http:' && location.port) return true;
  return /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h);
})();

const WM_PROXY_PREFIX = '/proxy/';
const WM_CORS_PROXIES = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.org/latest?url=',
  'https://api-proxy-forever.vercel.app/proxy?url=',
  'https://corsproxy.anywhere.link/v1/?url=',
];

/**
 * 并行尝试所有可用 URL 获取 API 数据，返回最快成功的响应文本
 * - 本地 dev-server 代理
 * - 多个公共 CORS 代理（并行）
 * - 直连（兜底）
 */
async function wmFetch(path, options = {}) {
  const fullUrl = WM_API_ORIGIN + path;
  const urls = [];

  // 本地代理（仅本地环境且未加 ?noproxy）
  if (WM_IS_LOCAL && !location.search.includes('noproxy')) {
    urls.push(WM_PROXY_PREFIX + fullUrl);
  }

  // CORS 代理（并行）
  for (const proxy of WM_CORS_PROXIES) {
    urls.push(proxy + encodeURIComponent(fullUrl));
  }

  // 直连兜底
  urls.push(fullUrl);

  const errors = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WM_FETCH_TIMEOUT);
  const mergedOptions = { ...options, signal: controller.signal };

  // 使用 Promise.allSettled：将所有请求同时发出，取第一个成功
  const results = await Promise.allSettled(
    urls.map(url =>
      fetch(url, mergedOptions).then(async resp => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        // 确认返回的是 JSON（代理有时返回 HTML 错误页）
        try { JSON.parse(text); } catch (e) { throw new Error('非 JSON 响应'); }
        return { text, url };
      })
    )
  );

  clearTimeout(timer);

  // 找第一个成功的
  for (const result of results) {
    if (result.status === 'fulfilled') {
      return result.value.text;
    }
    errors.push(result.reason?.message || '未知错误');
  }

  // 所有带头的请求都失败后，尝试不带任何自定义头的纯直连
  try {
    const fallbackCtrl = new AbortController();
    const fallbackTimer = setTimeout(() => fallbackCtrl.abort(), WM_FETCH_TIMEOUT);
    const resp = await fetch(fullUrl, { signal: fallbackCtrl.signal });
    clearTimeout(fallbackTimer);
    if (resp.ok) {
      const text = await resp.text();
      try { JSON.parse(text); return text; } catch {}
    }
  } catch (fe) {
    errors.push('直连兜底: ' + (fe.message || '失败'));
  }

  throw new Error(`所有请求均失败: ${errors.join('; ')}`);
}

const WM_IMG_CDN_BASE = WM_IS_LOCAL ? WM_PROXY_PREFIX + WM_IMG_CDN_ORIGIN : WM_IMG_CDN_ORIGIN;
const WM_IMG_LOCAL_BASE = './data/img'; // GitHub Action 同步的同源图片目录
const WM_IMG_DB_NAME = 'wf_market_img_cache';
const WM_IMG_DB_STORE = 'images';
const WM_IMG_DB_VERSION = 1;

// ===== 工具函数 =====

// ===== 图片 IndexedDB 缓存 =====
const WmImgCache = {
  _db: null,
  _opening: null,

  _open() {
    if (this._db) return Promise.resolve(this._db);
    if (this._opening) return this._opening;
    this._opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(WM_IMG_DB_NAME, WM_IMG_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(WM_IMG_DB_STORE)) {
          db.createObjectStore(WM_IMG_DB_STORE);
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
    return this._opening;
  },

  async get(key) {
    try {
      const db = await this._open();
      return new Promise((resolve) => {
        const tx = db.transaction(WM_IMG_DB_STORE, 'readonly');
        const req = tx.objectStore(WM_IMG_DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  },

  async set(key, blob) {
    try {
      const db = await this._open();
      return new Promise((resolve) => {
        const tx = db.transaction(WM_IMG_DB_STORE, 'readwrite');
        tx.objectStore(WM_IMG_DB_STORE).put(blob, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch { return false; }
  },

};

// slug → GitHub warframe-items 图片文件名（PascalCase）
function wmSlugToImageFilename(slug) {
  let s = (slug || '').toLowerCase();
  if (s.endsWith('_set')) s = s.slice(0, -4);
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + '.png';
}

// 检测 slug 是否为蓝图/部件，返回占位符类型
function wmGetComponentType(slug) {
  const s = (slug || '').toLowerCase();
  if (s.includes('_neuroptics_blueprint')) return { type: 'neuroptics' };
  if (s.includes('_chassis_blueprint')) return { type: 'chassis' };
  if (s.includes('_systems_blueprint')) return { type: 'systems' };
  if (s.includes('_blueprint')) return { type: 'bp', label: 'Bp' };
  if (s.includes('_barrel')) return { type: 'barrel' };
  if (s.includes('_receiver')) return { type: 'receiver' };
  if (s.includes('_stock')) return { type: 'stock' };
  if (s.includes('_blade')) return { type: 'blade' };
  if (s.includes('_handle') || s.includes('_grip')) return { type: 'handle' };
  if (s.includes('_limb')) return { type: 'limb' };
  if (s.includes('_link') || s.includes('_connector')) return { type: 'link' };
  if (s.includes('_string')) return { type: 'string' };
  return null;
}

// 渲染部件占位符（Bp 用文字，其余用 SVG）
function wmRenderComponentPlaceholder(comp) {
  if (comp.type === 'bp') {
    const span = document.createElement('span');
    span.className = 'market-ac-thumb-bp';
    span.textContent = comp.label;
    return span;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('class', 'market-ac-thumb-svg');

  const fill = 'rgba(212,175,55,0.6)';
  const stroke = 'rgba(212,175,55,0.9)';

  const shapes = {
    neuroptics: `<path d="M16 3 C9 3 5 8 5 15 L5 22 C5 25 8 28 16 28 C24 28 27 25 27 22 L27 15 C27 8 23 3 16 3 Z" fill="${fill}" stroke="${stroke}"/><rect x="7" y="13" width="18" height="5" rx="1.5" fill="rgba(0,0,0,0.5)" stroke="${stroke}"/>`,
    chassis: `<path d="M6 6 L26 6 L24 18 L20 28 L12 28 L8 18 Z" fill="${fill}" stroke="${stroke}"/><path d="M13 4 L16 7 L19 4" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`,
    systems: (() => {
      const cx = 16, cy = 16, r = 8, teeth = 8;
      const pd = [];
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
        const rd = (i % 2 === 0) ? r + 3 : r;
        pd.push(`${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * rd).toFixed(1)},${(cy + Math.sin(a) * rd).toFixed(1)}`);
      }
      pd.push('Z');
      return `<path d="${pd.join(' ')}" fill="${fill}" stroke="${stroke}"/><circle cx="${cx}" cy="${cy}" r="3" fill="rgba(0,0,0,0.4)" stroke="${stroke}"/>`;
    })(),
    barrel: `<rect x="4" y="12" width="24" height="8" rx="2" fill="${fill}" stroke="${stroke}"/>`,
    receiver: `<rect x="12" y="4" width="8" height="24" rx="2" fill="${fill}" stroke="${stroke}"/>`,
    stock: `<rect x="8" y="8" width="16" height="16" rx="2" fill="${fill}" stroke="${stroke}"/>`,
    blade: `<polygon points="16,3 28,28 4,28" fill="${fill}" stroke="${stroke}"/>`,
    handle: `<g transform="rotate(45 16 16)"><rect x="10" y="4" width="12" height="24" rx="2" fill="${fill}" stroke="${stroke}"/></g>`,
    limb: `<polygon points="16,4 28,16 16,28 4,16" fill="${fill}" stroke="${stroke}"/>`,
    link: `<circle cx="16" cy="16" r="10" fill="${fill}" stroke="${stroke}"/>`,
    string: `<line x1="4" y1="16" x2="28" y2="16" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>`,
  };

  svg.innerHTML = shapes[comp.type] || '';
  return svg;
}

// ===== 中文别名映射（仅保留常用战甲 + 通用关键词） =====
const WM_CN_ALIASES = {
  // 战甲
  'rhino': 'rhino', '犀牛': 'rhino',
  'rhino prime': 'rhino_prime', '犀牛prime': 'rhino_prime', '犀牛 prime': 'rhino_prime',
  'excalibur': 'excalibur', '圣剑': 'excalibur',
  'excalibur prime': 'excalibur_prime', '圣剑prime': 'excalibur_prime',
  'mag': 'mag', '磁力': 'mag',
  'mag prime': 'mag_prime', '磁力prime': 'mag_prime',
  'volt': 'volt', '电男': 'volt', '伏特': 'volt',
  'ash': 'ash', '灰烬': 'ash',
  'ash prime': 'ash_prime', '灰烬prime': 'ash_prime',
  'ember': 'ember', '火女': 'ember',
  'ember prime': 'ember_prime', '火女prime': 'ember_prime',
  'frost': 'frost', '冰男': 'frost',
  'frost prime': 'frost_prime', '冰男prime': 'frost_prime',
  'nyx': 'nyx', '幻妹': 'nyx',
  'nyx prime': 'nyx_prime', '幻妹prime': 'nyx_prime',
  'nova': 'nova', '新星': 'nova',
  'nova prime': 'nova_prime', '新星prime': 'nova_prime',
  'trinity': 'trinity', '三位一体': 'trinity',
  'trinity prime': 'trinity_prime', '三位一体prime': 'trinity_prime',
  'saryn': 'saryn', '毒妈': 'saryn',
  'saryn prime': 'saryn_prime', '毒妈prime': 'saryn_prime',
  'wukong': 'wukong', '悟空': 'wukong',
  'wukong prime': 'wukong_prime', '悟空prime': 'wukong_prime',
  'gauss': 'gauss', '高斯': 'gauss',
  'wisp': 'wisp', '幽灯': 'wisp',
  'revenant': 'revenant', '亡魂': 'revenant',
  'revenant prime': 'revenant_prime', '亡魂prime': 'revenant_prime',
  'titania': 'titania', '蝶妹': 'titania',
  'titania prime': 'titania_prime', '蝶妹prime': 'titania_prime',
  'sevagoth': 'sevagoth', '石甲': 'sevagoth',
  'sevagoth prime': 'sevagoth_prime', '石甲prime': 'sevagoth_prime',
  'garuda': 'garuda', '迦楼罗': 'garuda',
  'khora': 'khora', '赫拉': 'khora',
  'nidus': 'nidus', '蛆男': 'nidus',
  'inaros': 'inaros', '沙男': 'inaros',
  'hildryn': 'hildryn',
  'equinox': 'equinox', '阴阳': 'equinox',
  'equinox prime': 'equinox_prime', '阴阳prime': 'equinox_prime',
  'vauban': 'vauban', '工程': 'vauban',
  'vauban prime': 'vauban_prime', '工程prime': 'vauban_prime',
  'oberon': 'oberon', '欧贝隆': 'oberon',
  'oberon prime': 'oberon_prime', '欧贝隆prime': 'oberon_prime',
  'baruuk': 'baruuk', 'protea': 'protea',

  // 武器类型
  '双剑': 'dual_swords', 'dual swords': 'dual_swords',
  '双枪': 'dual_pistols', 'dual pistols': 'dual_pistols',
  '长弓': 'bow', 'bow': 'bow',
  '匕首': 'dagger', 'dagger': 'dagger',
  '棍': 'polearm', 'polearm': 'polearm',
  '杖': 'staff', 'staff': 'staff',
  '镰刀': 'scythe', 'scythe': 'scythe',
  '双刀': 'nikanas', 'nikanas': 'nikanas',
  '拳套': 'melee', 'melee': 'melee',
  '枪刃': 'gunblade', 'gunblade': 'gunblade',
  '锤': 'hammer', 'hammer': 'hammer',

  // 通用关键词
  '战甲': 'warframe', 'warframe': 'warframe',
  'mod': 'mod', '强化': 'mod',
  'riven': 'riven_mod', '紫卡': 'riven_mod', 'riven mod': 'riven_mod',
  'prime': 'prime', 'p': 'prime',
  '套装': 'set', 'set': 'set',
  '蓝图': 'blueprint', 'blueprint': 'blueprint',
  '部件': 'component', 'component': 'component',
};

// ===== 主模块 =====
const Market = {
  _state: {
    allItems: [],
    itemsLoaded: false,
    isLoadingItems: false,
    isQuerying: false,
    activeIndex: -1,
    matches: [],
    selectedItem: null,
    lastStat: null,
    favorites: [],
    _searchCache: new Map(),
    _queryCache: new Map(),
    _debounceTimer: null,
  },

  _els: {},

  init(container) {
    container.innerHTML = `
      <div class="market-page">
        <div class="market-header page-header">
          <div class="header-row">
            <button class="nav-trigger-inline" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
              <span class="material-icons mi-md">dashboard</span>
            </button>
            <div>
              <div class="page-brand-title">WARFRAME</div>
              <div class="page-brand-sub">MARKET / 市场查价</div>
            </div>
            <div class="page-spacer"></div>
          </div>
        </div>

        <div class="market-content" id="mk-content">
          <div class="market-inner" id="mk-inner">
            <div class="wf-card silver market-search-card" style="--card-chamfer:12px">
              <div class="market-search-title">
                <span class="material-icons">search</span>
                <span>物品搜索</span>
              </div>
              <div class="market-search-desc">输入物品名称（中文/英文）查询实时在线卖价</div>

              <div class="market-search-wrap" id="mk-search-wrap">
                <span class="material-icons market-search-icon">manage_search</span>
                <input type="text" id="mk-search-input" class="market-search-input"
                       placeholder="例如：Rhino Prime / 大久和弓"
                       autocomplete="off" spellcheck="false" />
                <button class="wf-icon-btn wf-btn" id="mk-clear-btn" title="清空" style="display:none;">
                  <span class="material-icons">close</span>
                </button>
              </div>

              <div class="market-hint" id="mk-hint" style="display:none;"></div>
              <div class="market-fav-bar" id="mk-fav-bar" style="display:none;"></div>
            </div>

            <div class="market-result-area" id="mk-result-area">
              <div class="market-empty wf-empty-state" id="mk-empty">
                <div class="wf-empty-icon">
                  <span class="material-icons">storefront</span>
                </div>
                <div class="wf-empty-title">输入物品名开始查价</div>
                <div class="wf-empty-desc">数据来源：Warframe Market 官方 API v2</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._els.container = container;
    this._els.searchInput = document.getElementById('mk-search-input');
    this._els.searchWrap = document.getElementById('mk-search-wrap');
    this._els.clearBtn = document.getElementById('mk-clear-btn');
    this._els.hint = document.getElementById('mk-hint');
    this._els.resultArea = document.getElementById('mk-result-area');
    this._els.empty = document.getElementById('mk-empty');
    this._els.favBar = document.getElementById('mk-fav-bar');

    this._els.autocomplete = document.createElement('div');
    this._els.autocomplete.className = 'market-autocomplete';
    this._els.autocomplete.id = 'mk-autocomplete';
    this._els.autocomplete.style.display = 'none';
    document.body.appendChild(this._els.autocomplete);

    this._bindEvents();
    this._initLazyLoad();
    this._loadAllItems();
    this._loadFavorites();
    this._renderFavoritesBar();
  },

  reloadFromStore() {},

  /** 初始化缩略图懒加载（IntersectionObserver） */
  _initLazyLoad() {
    if ('IntersectionObserver' in window && !this._thumbsObserver) {
      this._thumbsObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const thumb = entry.target;
            this._thumbsObserver.unobserve(thumb);
            const fn = thumb._lazyLoad;
            if (fn) {
              delete thumb._lazyLoad;
              fn();
            }
          }
        }
      }, {
        rootMargin: '150px 0px', // 提前 150px 预加载
      });
    }
  },

  // ===== 物品清单加载 =====
  async _loadAllItems() {
    if (this._state.itemsLoaded) return;

    // 1. 优先读取本地缓存，命中则搜索立即可用（毫秒级）
    const cached = this._loadItemsCache();
    if (cached) {
      this._state.allItems = cached;
      this._state.itemsLoaded = true;
      this._hideHint();
      // 后台静默更新，用户无感
      this._refreshItemsFromNetwork(true);
      return;
    }

    // 2. 缓存未命中，显示加载提示并等待网络请求
    this._state.isLoadingItems = true;
    this._showHint('正在加载物品清单…', 'loading');

    await this._refreshItemsFromNetwork();

    this._state.isLoadingItems = false;
  },

  /** 从网络拉取最新物品清单并更新缓存 */
  async _refreshItemsFromNetwork(silent) {
    try {
      if (!silent) this._showProgress('正在连接 Warframe Market…', 0);
      // Language/Platform 头不通过 CORS 代理转发，改为 URL 查询参数
      const text = await wmFetch('/items?language=' + WM_LANG + '&platform=' + WM_PLATFORM, {
        method: 'GET',
        headers: {
          'Language': WM_LANG,
          'Platform': WM_PLATFORM,
          'Accept': 'application/json',
        },
      });

      if (!silent) this._showProgress('正在解析物品数据…', 100);
      const json = JSON.parse(text);
      const items = (json && json.data) || [];
      const processed = this._processItems(items);
      this._state.allItems = processed;
      this._state.itemsLoaded = true;
      this._saveItemsCache(processed);
      if (!silent) this._hideHint();
      return; // 在线加载成功
    } catch (e) {
      console.warn('WM API 在线加载失败:', e);
    }

    // 兜底：加载 GitHub Action 同步的同源本地缓存文件（无 CORS，适用于 GitHub Pages）
    if (!this._state.itemsLoaded) {
      try {
        if (!silent) this._showProgress('正在从本地缓存加载…', 50);
        const resp = await fetch('./data/wf_market_items.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const json = JSON.parse(text);
        const items = (json && json.data) || [];
        if (items.length === 0) throw new Error('空数据');
        const processed = this._processItems(items);
        this._state.allItems = processed;
        this._state.itemsLoaded = true;
        this._saveItemsCache(processed);
        if (!silent) this._hideHint();
        return;
      } catch (e2) {
        console.warn('本地缓存文件加载失败:', e2);
      }
    }

    // 全部失败
    if (!this._state.itemsLoaded) {
      this._showHint('物品清单加载失败，自动补全不可用（仍可直接输入物品名或 URL slug 查询）', 'error');
    }
  },

  /** 预计算所有小写字段，搜索时零开销 */
  _processItems(items) {
    return items.map(it => {
      const i18n = it.i18n || {};
      const zh = i18n['zh-hans'] || {};
      const en = i18n.en || {};
      const nameZh = zh.name || '';
      const nameEn = en.name || it.slug;
      const displayName = nameZh || nameEn;
      const slug = it.slug || '';
      return {
        id: it.id,
        slug,
        slugL: slug.toLowerCase(),
        name: displayName,
        nameL: displayName.toLowerCase(),
        nameEn,
        nameEnL: nameEn.toLowerCase(),
        nameZh,
        nameZhL: nameZh.toLowerCase(),
        isMod: it.tags ? it.tags.includes('mod') : false,
        isRelic: it.tags ? it.tags.includes('relic') : false,
        isArcane: it.tags ? it.tags.some(t => t.includes('arcane')) : false,
      };
    });
  },

  /** localStorage 缓存读取 */
  _loadItemsCache() {
    try {
      const raw = localStorage.getItem(WM_ITEMS_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items) || !data.ts) return null;
      if (Date.now() - data.ts > WM_ITEMS_CACHE_TTL) return null;
      return data.items;
    } catch (e) {
      return null;
    }
  },

  /** localStorage 缓存写入 */
  _saveItemsCache(items) {
    try {
      localStorage.setItem(WM_ITEMS_CACHE_KEY, JSON.stringify({
        items,
        ts: Date.now(),
      }));
    } catch (e) {
      console.warn('Market 物品缓存写入失败:', e);
    }
  },

  // ===== 事件绑定 =====
  _bindEvents() {
    this._els.searchInput.addEventListener('input', () => this._onInput());
    this._els.searchInput.addEventListener('keydown', (e) => this._onKeyDown(e));
    this._els.searchInput.addEventListener('focus', () => {
      if (this._state.matches.length > 0) this._showAutocomplete();
    });
    this._els.clearBtn.addEventListener('click', () => this._clearSearch());
    document.addEventListener('click', (e) => {
      if (!this._els.searchWrap.contains(e.target) &&
          !this._els.autocomplete.contains(e.target)) {
        this._hideAutocomplete();
      }
    });
  },

  // ===== 搜索输入（防抖） =====
  _onInput() {
    const val = this._els.searchInput.value;
    this._els.clearBtn.style.display = val ? '' : 'none';

    if (!val.trim()) {
      this._state.matches = [];
      this._hideAutocomplete();
      if (this._state._debounceTimer) {
        clearTimeout(this._state._debounceTimer);
        this._state._debounceTimer = null;
      }
      return;
    }

    if (!this._state.itemsLoaded) {
      this._state.matches = [];
      this._hideAutocomplete();
      return;
    }

    if (this._state._debounceTimer) clearTimeout(this._state._debounceTimer);
    this._state._debounceTimer = setTimeout(() => {
      this._state._debounceTimer = null;
      this._doSearch(val);
    }, WM_SEARCH_DEBOUNCE);
  },

  _doSearch(val) {
    const cacheKey = val.trim().toLowerCase();
    let matches = this._state._searchCache.get(cacheKey);
    if (!matches) {
      matches = this._matchItems(val, WM_AUTOCOMPLETE_LIMIT);
      this._state._searchCache.set(cacheKey, matches);
      if (this._state._searchCache.size > 200) {
        const keys = this._state._searchCache.keys();
        this._state._searchCache.delete(keys.next().value);
      }
    }
    this._state.matches = matches;
    this._state.activeIndex = -1;
    this._renderAutocomplete();
  },

  // ===== 匹配物品（使用预计算字段，零 toLowerCase） =====
  _matchItems(query, limit) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const queries = [q];
    const qNorm = q.replace(/\s+/g, '_');
    if (qNorm !== q) queries.push(qNorm);

    const alias = WM_CN_ALIASES[q] || WM_CN_ALIASES[qNorm];
    if (alias && alias !== q && alias !== qNorm) {
      queries.push(alias);
      const aNorm = alias.replace(/_/g, ' ');
      if (aNorm !== alias) queries.push(aNorm);
    }

    const startsWith = [];
    const contains = [];
    const seen = new Set();
    const target = limit * 2;

    const items = this._state.allItems;
    for (let i = 0, len = items.length; i < len; i++) {
      const it = items[i];
      const slugL = it.slugL;
      const nameL = it.nameL;
      const nameEnL = it.nameEnL;
      const nameZhL = it.nameZhL;

      let isStart = false;
      let isContain = false;

      for (let j = 0, ql = queries.length; j < ql; j++) {
        const eq = queries[j];
        if (!isStart) {
          if (slugL.startsWith(eq) || nameL.startsWith(eq) ||
              nameEnL.startsWith(eq) || nameZhL.startsWith(eq)) {
            isStart = true;
          }
        }
        if (!isContain) {
          if (slugL.includes(eq) || nameL.includes(eq) ||
              nameEnL.includes(eq) || nameZhL.includes(eq)) {
            isContain = true;
          }
        }
        if (isStart && isContain) break;
      }

      if (isStart) {
        if (!seen.has(it.id)) { seen.add(it.id); startsWith.push(it); }
      } else if (isContain) {
        if (!seen.has(it.id)) { seen.add(it.id); contains.push(it); }
      }

      if (startsWith.length + contains.length >= target) break;
    }

    const result = startsWith.slice(0, limit);
    for (let i = 0; i < contains.length && result.length < limit; i++) {
      result.push(contains[i]);
    }
    return result;
  },

  // ===== 自动补全渲染 =====
  _renderAutocomplete() {
    const matches = this._state.matches;
    const container = this._els.autocomplete;

    clearEl(container);
    if (matches.length === 0) { this._hideAutocomplete(); return; }

    const scroll = document.createElement('div');
    scroll.className = 'market-ac-scroll';
    const frag = document.createDocumentFragment();

    for (let i = 0; i < matches.length; i++) {
      const item = matches[i];
      const row = document.createElement('div');
      row.className = 'market-ac-item';
      row.dataset.index = i;

      const thumb = document.createElement('div');
      thumb.className = 'market-ac-thumb';
      if (item.isRelic) {
        thumb.className = 'market-ac-thumb relic';
        const ball = document.createElement('div');
        ball.className = 'market-ac-thumb-ball';
        thumb.appendChild(ball);
      } else if (item.isArcane) {
        thumb.className = 'market-ac-thumb arcane';
        const semi = document.createElement('div');
        semi.className = 'market-ac-thumb-arcane';
        thumb.appendChild(semi);
      } else if (item.isMod) {
        thumb.className = 'market-ac-thumb mod';
        const modCard = document.createElement('div');
        modCard.className = 'market-ac-thumb-mod';
        thumb.appendChild(modCard);
      } else {
        const comp = wmGetComponentType(item.slug);
        if (comp) {
          thumb.appendChild(wmRenderComponentPlaceholder(comp));
        } else {
          const imgFn = wmSlugToImageFilename(item.slug);
          const cdnUrl = `${WM_IMG_CDN_BASE}/${imgFn}`;
          const localUrl = `${WM_IMG_LOCAL_BASE}/${imgFn}`;
          const retryUrl = `${WM_IMG_CDN_BASE}/${imgFn}?_r=1`;
          const cacheKey = cdnUrl.replace(/^https?:\/\/[^/]+/, '');

          thumb.classList.add('is-loading');

          // 懒加载：仅当缩略图进入可视区域时才加载图片
          const loadImage = () => {
            (async () => {
              let blob = await WmImgCache.get(cacheKey);

            // 1. 优先尝试本地文件（同源，极快，无 CORS）
            if (!blob) {
              try {
                const resp = await fetch(localUrl);
                if (resp.ok) {
                  const newBlob = await resp.blob();
                  if (newBlob.type.startsWith('image/')) {
                    blob = newBlob;
                    WmImgCache.set(cacheKey, newBlob);
                  }
                }
              } catch {}
            }

            // 2. 再从 CDN 加载
            if (!blob) {
              try {
                const resp = await fetch(cdnUrl);
                if (resp.ok) {
                  const newBlob = await resp.blob();
                  if (newBlob.type.startsWith('image/')) {
                    blob = newBlob;
                    WmImgCache.set(cacheKey, newBlob);
                  }
                }
              } catch {}
            }

            // 3. 带 ?_r=1 重试 CDN
            if (!blob && retryUrl) {
              try {
                const resp = await fetch(retryUrl);
                if (resp.ok) {
                  const newBlob = await resp.blob();
                  if (newBlob.type.startsWith('image/')) {
                    blob = newBlob;
                    WmImgCache.set(cacheKey, newBlob);
                  }
                }
              } catch {}
            }

            if (blob) {
              const imgEl = document.createElement('img');
              imgEl.alt = '';
              imgEl.src = URL.createObjectURL(blob);
              imgEl.onload = () => thumb.classList.remove('is-loading');
              imgEl.onerror = () => {
                thumb.classList.remove('is-loading');
                imgEl.remove();
                const fb = wmGetComponentType(item.slug);
                if (fb) thumb.appendChild(wmRenderComponentPlaceholder(fb));
                else thumb.classList.add('fallback');
              };
              thumb.appendChild(imgEl);
              if (imgEl.complete) thumb.classList.remove('is-loading');
            } else {
              thumb.classList.remove('is-loading');
              const fb = wmGetComponentType(item.slug);
              if (fb) thumb.appendChild(wmRenderComponentPlaceholder(fb));
              else thumb.classList.add('fallback');
            }
          })();
        };

        if (this._thumbsObserver) {
          thumb._lazyLoad = loadImage;
          this._thumbsObserver.observe(thumb);
        } else {
          loadImage(); // 不支持 IntersectionObserver 时立即加载
        }
      }    // closes inner else (非部件物品分支)
      }    // closes outer else (图片/SVG分支)
      row.appendChild(thumb);

      const nameWrap = document.createElement('div');
      nameWrap.className = 'market-ac-name-wrap';
      const name = document.createElement('div');
      name.className = 'market-ac-name';
      name.textContent = item.name;
      nameWrap.appendChild(name);

      if (item.nameEn && item.nameZh && item.nameZh !== item.nameEn) {
        const sub = document.createElement('div');
        sub.className = 'market-ac-subname';
        sub.textContent = item.nameEn;
        nameWrap.appendChild(sub);
      } else {
        const slug = document.createElement('div');
        slug.className = 'market-ac-url';
        slug.textContent = item.slug;
        nameWrap.appendChild(slug);
      }
      row.appendChild(nameWrap);

      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', () => this._selectItem(i));
      row.addEventListener('mouseenter', () => this._setActiveIndex(i, false));
      frag.appendChild(row);
    }
    scroll.appendChild(frag);
    container.appendChild(scroll);
    this._showAutocomplete();
  },

  _showAutocomplete() {
    if (this._state.matches.length === 0) return;
    const rect = this._els.searchWrap.getBoundingClientRect();
    const ac = this._els.autocomplete;
    ac.style.position = 'fixed';
    ac.style.top = `${rect.bottom + 6}px`;
    ac.style.left = `${rect.left}px`;
    ac.style.width = `${rect.width}px`;
    ac.style.display = 'block';
  },

  _hideAutocomplete() {
    this._els.autocomplete.style.display = 'none';
    this._state.activeIndex = -1;
  },

  _setActiveIndex(idx, scrollIntoView = true) {
    const items = this._els.autocomplete.querySelectorAll('.market-ac-item');
    items.forEach((el, i) => el.classList.toggle('active', i === idx));
    this._state.activeIndex = idx;

    if (scrollIntoView && idx >= 0 && items[idx]) {
      const scrollEl = this._els.autocomplete.querySelector('.market-ac-scroll');
      if (scrollEl) {
        const ir = items[idx].getBoundingClientRect();
        const sr = scrollEl.getBoundingClientRect();
        if (ir.bottom > sr.bottom) scrollEl.scrollTop += ir.bottom - sr.bottom;
        else if (ir.top < sr.top) scrollEl.scrollTop -= sr.top - ir.top;
      } else {
        items[idx].scrollIntoView({ block: 'nearest' });
      }
    }
  },

  // ===== 键盘导航 =====
  _onKeyDown(e) {
    const matches = this._state.matches;
    if (matches.length === 0) {
      if (e.key === 'Enter') this._handleQuery();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._setActiveIndex((this._state.activeIndex + 1) % matches.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._setActiveIndex((this._state.activeIndex - 1 + matches.length) % matches.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (this._state.activeIndex >= 0) this._selectItem(this._state.activeIndex);
        else this._handleQuery();
        break;
      case 'Escape':
        e.preventDefault();
        this._hideAutocomplete();
        break;
      case 'Tab':
        if (this._state.activeIndex < 0 && matches.length > 0) {
          e.preventDefault();
          this._selectItem(0);
        }
        break;
    }
  },

  _selectItem(idx) {
    const item = this._state.matches[idx];
    if (!item) return;
    this._state.selectedItem = item;
    this._els.searchInput.value = item.name;
    this._hideAutocomplete();
    this._els.clearBtn.style.display = '';
    this._handleQuery();
  },

  _clearSearch() {
    this._els.searchInput.value = '';
    this._els.clearBtn.style.display = 'none';
    this._state.matches = [];
    this._state.selectedItem = null;
    this._hideAutocomplete();
    this._els.searchInput.focus();
  },

  // ===== 解析 slug =====
  _resolveSlug(input) {
    const val = input.trim().toLowerCase();
    if (!val) return null;

    if (this._state.itemsLoaded) {
      const valNorm = val.replace(/\s+/g, '_');
      const items = this._state.allItems;
      for (let i = 0, len = items.length; i < len; i++) {
        const it = items[i];
        if (it.slugL === val || it.slugL === valNorm) return it;
        if (it.nameZhL === val) return it;
        if (it.nameEnL === val) return it;
        if (it.nameL === val) return it;
      }
    }

    const alias = WM_CN_ALIASES[val] || WM_CN_ALIASES[val.replace(/\s+/g, '_')];
    if (alias && alias !== val && alias !== val.replace(/\s+/g, '_')) {
      const resolved = this._resolveSlug(alias);
      if (resolved) return resolved;
    }
    return null;
  },

  // ===== 查询 =====
  async _handleQuery() {
    const inputVal = this._els.searchInput.value.trim();
    if (!inputVal) { this._showHint('请输入物品名称', 'error'); return; }

    let slug, itemObj = null;

    if (this._state.selectedItem &&
        (this._state.selectedItem.name === inputVal ||
         this._state.selectedItem.slug === inputVal)) {
      slug = this._state.selectedItem.slug;
      itemObj = this._state.selectedItem;
    } else {
      itemObj = this._resolveSlug(inputVal);
      if (itemObj) {
        slug = itemObj.slug;
        this._state.selectedItem = itemObj;
      } else if (this._state.itemsLoaded) {
        const match = this._matchItems(inputVal, 1);
        if (match.length > 0) {
          slug = match[0].slug;
          itemObj = match[0];
          this._state.selectedItem = match[0];
        }
      }
      if (!slug) slug = inputVal.toLowerCase().replace(/\s+/g, '_');
    }

    this._hideAutocomplete();

    const cached = this._state._queryCache.get(slug);
    if (cached && (Date.now() - cached.ts) < WM_QUERY_CACHE_TTL) {
      this._state.lastStat = cached.stat;
      this._renderResult(cached.stat);
      return;
    }

    this._showResultState('loading');
    this._state.isQuerying = true;
    try {
      const orders = await this._fetchOrders(slug);
      const stat = this._computeStats(orders, slug, itemObj);
      this._state.lastStat = stat;
      this._setQueryCache(slug, stat);
      this._renderResult(stat);
    } catch (e) {
      console.warn('查价失败:', e);
      this._showResultState('error', e.message || '查询失败');
    } finally {
      this._state.isQuerying = false;
    }
  },

  /** 写入查询缓存 */
  _setQueryCache(slug, stat) {
    this._state._queryCache.set(slug, { stat, ts: Date.now() });
    if (this._state._queryCache.size > 50) {
      const keys = this._state._queryCache.keys();
      this._state._queryCache.delete(keys.next().value);
    }
  },

  async _fetchOrders(slug) {
    // 将 platform/crossplay 放在 URL 查询参数中，确保通过 CORS 代理也能正确传递
    const path = `/orders/item/${encodeURIComponent(slug)}?platform=${WM_PLATFORM}&crossplay=${WM_CROSSPLAY}`;
    const text = await wmFetch(path, {
      method: 'GET',
      headers: {
        'Platform': WM_PLATFORM,
        'Crossplay': WM_CROSSPLAY,
        'Accept': 'application/json',
      },
    });
    const json = JSON.parse(text);
    if (json && json.error) throw new Error(json.error);
    return (json && json.data) || [];
  },

  // ===== 统计计算 =====
  _computeStats(orders, slug, itemObj) {
    const valid = orders.filter(o =>
      o.type === 'sell' && o.user && (o.user.status === 'ingame' || o.user.status === 'online')
    );

    if (valid.length === 0) {
      return { empty: true, slug, itemName: itemObj ? itemObj.name : slug, sellers: 0 };
    }

    const prices = valid.map(o => o.platinum).sort((a, b) => a - b);
    const sellers = valid.length;
    const floor = prices[0];
    const mode = this._calcMode(prices);
    const avg = this._calcTrimmedAvg(prices, 0.05);

    const cheapest = valid.reduce((min, o) => o.platinum < min.platinum ? o : min, valid[0]);

    // 按 platinum 从低到高排序后取前10
    const sortedValid = valid.slice().sort((a, b) => a.platinum - b.platinum);
    const sampleOrders = sortedValid.slice(0, 10).map(o => ({
      platinum: o.platinum,
      quantity: o.quantity,
      ingameName: o.user.ingameName,
      platform: o.user.platform,
    }));

    return {
      empty: false,
      slug,
      itemName: itemObj ? itemObj.name : slug,
      itemNameEn: itemObj ? (itemObj.nameEn || itemObj.slug) : slug,
      floor,
      mode,
      avg: Math.round(avg * 10) / 10,
      sellers,
      cheapest: {
        name: cheapest.user.ingameName,
        platinum: cheapest.platinum,
        quantity: cheapest.quantity,
        platform: cheapest.user.platform,
      },
      sampleOrders,
    };
  },

  // ===== 收藏功能 =====
  _loadFavorites() {
    try {
      const raw = localStorage.getItem('wf_market_favorites_v1');
      this._state.favorites = raw ? JSON.parse(raw) : [];
    } catch { this._state.favorites = []; }
  },

  _saveFavorites() {
    try {
      localStorage.setItem('wf_market_favorites_v1', JSON.stringify(this._state.favorites));
    } catch {}
  },

  _renderFavoritesBar() {
    const bar = this._els.favBar;
    const favs = this._state.favorites;
    if (!bar) return;
    clearEl(bar);
    if (favs.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    favs.forEach((slug, i) => {
      // 从已加载物品中查找显示名（优先中文名）
      const item = this._state.allItems.find(it => it.slug === slug);
      const displayName = item ? item.name : slug.replace(/_/g, ' ');

      const tag = document.createElement('span');
      tag.className = 'market-fav-tag';
      tag.textContent = displayName;
      tag.title = `点击查询 ${displayName}`;
      tag.addEventListener('click', () => {
        this._els.searchInput.value = slug;
        this._handleQuery();
      });
      const del = document.createElement('span');
      del.className = 'material-icons mi-sm';
      del.textContent = 'close';
      del.style.cssText = 'cursor:pointer;opacity:0.5;margin-left:4px;font-size:14px;';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this._state.favorites.splice(i, 1);
        this._saveFavorites();
        this._renderFavoritesBar();
      });
      tag.appendChild(del);
      bar.appendChild(tag);
    });
  },

  _toggleFavorite(slug) {
    const idx = this._state.favorites.indexOf(slug);
    if (idx >= 0) {
      this._state.favorites.splice(idx, 1);
    } else {
      if (this._state.favorites.length >= 6) this._state.favorites.shift();
      this._state.favorites.push(slug);
    }
    this._saveFavorites();
    this._renderFavoritesBar();
    return idx < 0;
  },

  _calcMode(prices) {
    const counter = {};
    let maxCount = 0, mode = prices[0];
    for (let i = 0; i < prices.length; i++) {
      const p = prices[i];
      counter[p] = (counter[p] || 0) + 1;
      if (counter[p] > maxCount) { maxCount = counter[p]; mode = p; }
    }
    return mode;
  },

  _calcTrimmedAvg(prices, ratio) {
    const n = prices.length;
    if (n === 0) return 0;
    if (n <= 2) return prices.reduce((a, b) => a + b, 0) / n;
    const trimCount = Math.max(1, Math.floor(n * ratio));
    const end = n - trimCount;
    const trimmed = prices.slice(trimCount, end);
    if (trimmed.length === 0) return prices.reduce((a, b) => a + b, 0) / n;
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  },

  // ===== 统一结果状态渲染 =====
  _showResultState(kind, payload) {
    this._els.empty.style.display = 'none';
    clearEl(this._els.resultArea);

    if (kind === 'loading') {
      const el = document.createElement('div');
      el.className = 'market-loading';
      el.innerHTML = `
        <div class="market-loading-spinner"><span class="material-icons">sync</span></div>
        <div class="market-loading-text">正在查询在线卖单…</div>
      `;
      this._els.resultArea.appendChild(el);
    } else if (kind === 'error') {
      const el = document.createElement('div');
      el.className = 'market-error';
      el.innerHTML = `
        <div class="market-error-icon"><span class="material-icons">error_outline</span></div>
        <div class="market-error-text">查询失败</div>
        <div class="market-error-desc">${payload || ''}</div>
        <button class="wf-btn outline" id="mk-retry-btn">
          <span class="material-icons mi-sm">refresh</span><span>重试</span>
        </button>
      `;
      this._els.resultArea.appendChild(el);
      const btn = document.getElementById('mk-retry-btn');
      if (btn) btn.addEventListener('click', () => this._handleQuery());
    }
  },

  // ===== 结果渲染 =====
  _renderResult(stat) {
    clearEl(this._els.resultArea);

    if (stat.empty) {
      const el = document.createElement('div');
      el.className = 'market-no-result';
      el.innerHTML = `
        <div class="market-error-icon"><span class="material-icons">sentiment_dissatisfied</span></div>
        <div class="market-error-text">暂无在线卖家</div>
        <div class="market-error-desc">${stat.itemName} 当前没有游戏内在线的卖单，请稍后再来查看</div>
      `;
      this._els.resultArea.appendChild(el);
      return;
    }

    const card = document.createElement('div');
    card.className = 'wf-card gold flow market-result-card';
    card.style.setProperty('--card-chamfer', '14px');

    const head = document.createElement('div');
    head.className = 'market-result-head';
    head.innerHTML = `
      <span class="material-icons market-result-icon">shopping_bag</span>
      <span class="market-result-name">${stat.itemName}</span>
      <span class="market-result-url">${stat.slug}</span>
    `;
    card.appendChild(head);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'market-stats-grid';
    statsGrid.appendChild(this._createStatBox('建议价（众数）', stat.mode, 'gold', 'mode', '出现频率最高的价格，最贴近真实成交'));
    statsGrid.appendChild(this._createStatBox('最低底价', stat.floor, 'blue', 'floor', '当前在线卖家中最低报价'));
    statsGrid.appendChild(this._createStatBox('切尾均价', stat.avg, 'silver', 'avg', '剔除最高/最低 5% 后的均价'));
    statsGrid.appendChild(this._createStatBox('在线卖家', stat.sellers, 'green', 'sellers', '过滤后的有效卖单数'));
    card.appendChild(statsGrid);

    const seller = document.createElement('div');
    seller.className = 'market-seller-info';
    seller.innerHTML = `
      <div class="market-seller-label">
        <span class="material-icons">person</span><span class="market-seller-label-text">最低价卖家</span>
      </div>
      <div class="market-seller-detail">
        <span class="market-seller-name">${stat.cheapest.name}</span>
        <span class="market-seller-meta">${stat.cheapest.platinum} platinum × ${stat.cheapest.quantity || 1} · ${stat.cheapest.platform || ''}</span>
      </div>
    `;
    // 存储当前选中的卖家信息到 card.dataset，供复制使用
    card.dataset.sellerName = stat.cheapest.name;
    card.dataset.sellerPlatinum = stat.cheapest.platinum;
    card.appendChild(seller);

    const actions = document.createElement('div');
    actions.className = 'market-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'wf-btn primary';
    copyBtn.innerHTML = `<span class="material-icons mi-sm">content_copy</span><span>复制白金私聊</span>`;
    copyBtn.addEventListener('click', () => {
      // 从 card.dataset 读取当前选中的卖家信息
      const sellerName = card.dataset.sellerName;
      const sellerPlatinum = card.dataset.sellerPlatinum;
      this._copyWhisperWithSeller(stat, sellerName, sellerPlatinum);
    });
    actions.appendChild(copyBtn);

    const wmBtn = document.createElement('button');
    wmBtn.className = 'wf-btn outline';
    wmBtn.innerHTML = `<span class="material-icons mi-sm">open_in_new</span><span>WM 页面</span>`;
    wmBtn.addEventListener('click', () => window.open(`https://warframe.market/items/${stat.slug}`, '_blank'));
    actions.appendChild(wmBtn);

    const favBtn = document.createElement('button');
    favBtn.className = 'wf-btn outline';
    const isFav = this._state.favorites.includes(stat.slug);
    favBtn.innerHTML = `<span class="material-icons mi-sm">${isFav ? 'bookmark' : 'bookmark_border'}</span><span>${isFav ? '已收藏' : '收藏'}</span>`;
    favBtn.addEventListener('click', () => {
      const nowFav = this._toggleFavorite(stat.slug);
      favBtn.innerHTML = `<span class="material-icons mi-sm">${nowFav ? 'bookmark' : 'bookmark_border'}</span><span>${nowFav ? '已收藏' : '收藏'}</span>`;
    });
    actions.appendChild(favBtn);

    card.appendChild(actions);

    if (stat.sampleOrders && stat.sampleOrders.length > 0) {
      const sample = document.createElement('div');
      sample.className = 'market-sample';

      const label = document.createElement('div');
      label.className = 'market-sample-label';
      label.innerHTML = `<span class="material-icons">list</span><span>最低 ${stat.sampleOrders.length} 个报价</span>`;
      sample.appendChild(label);

      const list = document.createElement('div');
      list.className = 'market-sample-list';

      stat.sampleOrders.forEach((o, i) => {
        const chip = document.createElement('div');
        chip.className = `wf-chip ${i === 0 ? 'gold' : 'silver'} market-sample-chip`;
        chip.style.setProperty('--chip-chamfer', '5px');
        chip.style.setProperty('--chip-inset', '1px');
        chip.dataset.index = i;
        chip.innerHTML = `<span>${o.platinum}p</span>`;

        chip.addEventListener('click', () => {
          // 更新卖家信息
          const si = card.querySelector('.market-seller-info');
          if (!si) return;

          si.querySelector('.market-seller-name').textContent = o.ingameName;
          si.querySelector('.market-seller-meta').textContent = `${o.platinum} platinum × ${o.quantity || 1} · ${o.platform || ''}`;

          // 更新标签
          si.querySelector('.market-seller-label-text').textContent = i === 0 ? '最低价卖家' : '当前选中卖家';

          // 更新 card.dataset 供复制使用
          card.dataset.sellerName = o.ingameName;
          card.dataset.sellerPlatinum = o.platinum;

          // 更新高亮
          list.querySelectorAll('.market-sample-chip').forEach(c => { c.classList.remove('gold'); c.classList.add('silver'); });
          chip.classList.remove('silver');
          chip.classList.add('gold');
        });

        list.appendChild(chip);
      });

      sample.appendChild(list);
      card.appendChild(sample);
    }

    this._els.resultArea.appendChild(card);
  },

  _createStatBox(label, value, color, key, desc) {
    const box = document.createElement('div');
    box.className = `wf-chip ${color} market-stat-box`;
    box.style.setProperty('--chip-chamfer', '8px');
    box.style.setProperty('--chip-inset', '1.5px');
    const valStr = (typeof value === 'number' && key !== 'sellers') ? value + 'p' : String(value);
    box.innerHTML = `
      <div class="market-stat-label"><span>${label}</span></div>
      <div class="market-stat-value"><span>${valStr}</span></div>
      <div class="market-stat-desc"><span>${desc}</span></div>
    `;
    return box;
  },

  // ===== 操作：复制 =====
  _buildWhisperCommand(sellerName, itemNameEn, platinum) {
    return `/w ${sellerName} Hi! I want to buy: ${itemNameEn} for ${platinum} platinum. (warframe.market)`;
  },

  async _copyWhisperWithSeller(stat, sellerName, platinum) {
    const cmd = this._buildWhisperCommand(sellerName, stat.itemNameEn, platinum);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cmd);
      } else {
        const ta = document.createElement('textarea');
        ta.value = cmd;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showSnackbar('已复制白金私聊指令');
    } catch (e) {
      console.warn('复制失败:', e);
      showSnackbar('复制失败，请手动复制');
    }
  },

  _showProgress(msg, pct) {
    clearEl(this._els.hint);
    this._els.hint.className = 'market-hint loading';
    this._els.hint.style.display = '';

    const wrap = document.createElement('div');
    wrap.className = 'market-progress-wrap';

    const bar = document.createElement('div');
    bar.className = 'market-progress-bar' + (pct < 0 ? ' indeterminate' : '');

    if (pct >= 0) {
      const fill = document.createElement('div');
      fill.className = 'market-progress-fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
    }

    wrap.appendChild(bar);

    const meta = document.createElement('div');
    meta.className = 'market-progress-meta';
    const pctText = pct < 0 ? '加载中' : pct + '%';
    meta.innerHTML = `<span class="market-progress-text">${msg}</span><span class="market-progress-pct">${pctText}</span>`;
    wrap.appendChild(meta);

    this._els.hint.appendChild(wrap);
  },

  // ===== 提示条 =====
  _showHint(msg, kind) {
    clearEl(this._els.hint);
    this._els.hint.className = 'market-hint' + (kind ? ' ' + kind : '');
    this._els.hint.textContent = msg;
    this._els.hint.style.display = '';
  },

  _hideHint() {
    this._els.hint.style.display = 'none';
  },
};
