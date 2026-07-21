const ARBI_DATA_BASE_URL = 'https://arbi.wf.wiki/data';
const ARBI_PROXY_PREFIX = '/proxy/arbi.wf.wiki/data';
const ARBI_LOCAL_DATA_PATH = 'data';
const ARBI_HIGH_VALUE_TIERS = ['S', 'A+', 'A', 'A-'];
const ARBI_TEMP_REMINDER_TAG = 'arbi_temp';
const ARBI_LAST_DAILY_AUTO_ADD_KEY = 'wf_arbi_last_daily_auto_add';
const ARBI_DATA_CACHE_KEY = 'wf_arbi_data_cache';
const ARBI_DATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const ArbiData = {
  _state: {
    schedule: null,
    nodes: null,
    tierlist: null,
    tierMap: {},
    isLoaded: false,
    isLoading: false,
  },

  async load() {
    if (this._state.isLoaded) return true;
    if (this._state.isLoading) return false;

    this._state.isLoading = true;

    try {
      const cached = this._loadFromCache();
      if (cached) {
        this._state.schedule = cached.schedule;
        this._state.nodes = cached.nodes;
        this._state.tierlist = cached.tierlist;
        this._buildTierMap();
        this._state.isLoaded = true;
        this._state.isLoading = false;
        this._refreshInBackground();
        return true;
      }

      await this._fetchAndCache();
      this._state.isLoaded = true;
      this._state.isLoading = false;
      return true;
    } catch (e) {
      console.error('仲裁数据加载失败:', e);
      this._state.isLoading = false;
      return false;
    }
  },

  _loadFromCache() {
    try {
      const raw = localStorage.getItem(ARBI_DATA_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.schedule || !parsed.nodes || !parsed.tierlist) return null;
      const age = Date.now() - (parsed.cachedAt || 0);
      if (age > ARBI_DATA_CACHE_TTL_MS) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  },

  async _refreshInBackground() {
    try {
      await this._fetchAndCache();
    } catch (e) {
      // 静默失败，不影响当前缓存
    }
  },

  async _fetchAndCache() {
    const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    // 数据源优先级：本地 data/ 目录 > 本地代理（开发环境）> 远程直连（最后手段）
    const sources = [
      ARBI_LOCAL_DATA_PATH,
      ...(isLocal ? [ARBI_PROXY_PREFIX] : []),
      ARBI_DATA_BASE_URL,
    ];

    let lastError = null;
    for (const baseUrl of sources) {
      try {
        const [schedule, nodes, tierlist] = await Promise.all([
          fetch(`${baseUrl}/arbys.schedule.v2.json`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
          fetch(`${baseUrl}/arbys.nodes.zh.json`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
          fetch(`${baseUrl}/tierlist.default.json`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
        ]);

        this._state.schedule = schedule;
        this._state.nodes = nodes;
        this._state.tierlist = tierlist;
        this._buildTierMap();

        try {
          localStorage.setItem(ARBI_DATA_CACHE_KEY, JSON.stringify({
            schedule,
            nodes,
            tierlist,
            cachedAt: Date.now(),
          }));
        } catch (e) {
          // 忽略存储错误
        }
        return;
      } catch (e) {
        lastError = e;
        // 继续尝试下一个数据源
      }
    }
    throw lastError || new Error('所有数据源均不可用');
  },

  _buildTierMap() {
    const map = {};
    const buckets = this._state.tierlist?.tierBuckets || {};
    for (const [tier, nodeKeys] of Object.entries(buckets)) {
      for (const nk of nodeKeys) {
        map[nk] = tier;
      }
    }
    this._state.tierMap = map;
  },

  getCurrentArbitration(nowTs) {
    if (!this._state.isLoaded) return null;
    const now = nowTs || Math.floor(Date.now() / 1000);
    const node = this._getNodeAt(now);
    if (!node) return null;
    return {
      nodeKey: node.nodeKey,
      name: node.nameZh,
      mission: node.missionNameZh,
      system: node.systemNameZh,
      faction: node.factionNameZh,
      tier: this._state.tierMap[node.nodeKey] || '未评级',
      minLevel: node.minEnemyLevel,
      maxLevel: node.maxEnemyLevel,
      startTime: this._getHourStart(now),
      endTime: this._getHourStart(now) + this._state.schedule.stepSec,
    };
  },

  getUpcomingArbitrations(hours, nowTs) {
    if (!this._state.isLoaded) return [];
    const now = nowTs || Math.floor(Date.now() / 1000);
    const result = [];
    for (let i = 1; i <= hours; i++) {
      const ts = now + i * this._state.schedule.stepSec;
      const node = this._getNodeAt(ts);
      if (!node) continue;
      result.push({
        offsetHours: i,
        startTime: this._getHourStart(ts),
        nodeKey: node.nodeKey,
        name: node.nameZh,
        mission: node.missionNameZh,
        system: node.systemNameZh,
        faction: node.factionNameZh,
        tier: this._state.tierMap[node.nodeKey] || '未评级',
        minLevel: node.minEnemyLevel,
        maxLevel: node.maxEnemyLevel,
      });
    }
    return result;
  },

  getTodaysHighValueArbitrations(nowTs) {
    if (!this._state.isLoaded) return [];
    const now = nowTs || Math.floor(Date.now() / 1000);
    const midnight = this._getDayStart(now);
    const nextMidnight = midnight + 24 * 3600;

    const result = [];
    let ts = midnight;
    while (ts < nextMidnight) {
      const node = this._getNodeAt(ts);
      if (node) {
        const tier = this._state.tierMap[node.nodeKey] || '未评级';
        if (ARBI_HIGH_VALUE_TIERS.includes(tier)) {
          result.push({
            startTime: ts,
            endTime: ts + this._state.schedule.stepSec,
            nodeKey: node.nodeKey,
            name: node.nameZh,
            mission: node.missionNameZh,
            system: node.systemNameZh,
            faction: node.factionNameZh,
            tier: tier,
            minLevel: node.minEnemyLevel,
            maxLevel: node.maxEnemyLevel,
          });
        }
      }
      ts += this._state.schedule.stepSec;
    }
    return result;
  },

  _getNodeAt(ts) {
    if (!this._state.schedule || !this._state.nodes) return null;
    const { startTs, stepSec, nodes, seq } = this._state.schedule;
    const stepsSinceStart = Math.floor((ts - startTs) / stepSec);
    const seqLen = seq.length;
    const seqIndex = ((stepsSinceStart % seqLen) + seqLen) % seqLen;
    const nodeIdx = seq[seqIndex];
    const nodeKey = nodes[nodeIdx];
    return this._state.nodes.nodes[nodeKey] || null;
  },

  _getHourStart(ts) {
    const { stepSec } = this._state.schedule;
    return Math.floor(ts / stepSec) * stepSec;
  },

  _getDayStart(ts) {
    const d = new Date(ts * 1000);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  },

  getTierColor(tier) {
    const colors = {
      'S': '#FF6B6B',
      'A+': '#FFD84D',
      'A': '#FFD84D',
      'A-': '#D4AF37',
      'B': '#1FB6FF',
      'C': '#8B9AAA',
      '未评级': '#5C6773',
    };
    return colors[tier] || '#5C6773';
  },

  isHighValue(tier) {
    return ARBI_HIGH_VALUE_TIERS.includes(tier);
  },

  formatTime(ts) {
    const d = new Date(ts * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  formatDateTime(ts) {
    const d = new Date(ts * 1000);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (isToday) return `今天 ${timeStr}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
  },
};
