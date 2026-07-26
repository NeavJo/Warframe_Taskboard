/**
 * store.js — 数据持久化模块
 * 对应 Flutter 版 TaskStorageService + default_tasks.dart
 *
 * 职责：localStorage 读写、JSON 序列化、重置检测
 * UI 层不直接接触 localStorage
 */

// =============================================================
// 默认任务数据（对应 models/default_tasks.dart）
// =============================================================

function buildDefaultDailyTasks() {
  return [
    { id: 'sortie', name: '突击 (Sortie)', description: '完成今日 3 轮突击任务', icon: 'flash_on', accent: '#FFD84D', isCompleted: false },
    { id: 'daily_tribute', name: '每日献礼签到', description: '每日登录献礼 / Tribute 奖励', icon: 'card_giftcard', accent: '#D4AF37', isCompleted: false },
    { id: 'eidolon_culling', name: '大傻 / 三傻 夜灵捕获', description: '夜灵平原捕获 Teralyst / Gantulyst / Hydrolyst', icon: 'bolt', accent: '#1FB6FF', isCompleted: false },
    { id: 'void_fissure', name: '执政官裂缝 / 虚空裂缝', description: '完成今日虚空裂缝任务', icon: 'auto_awesome', accent: '#D4AF37', isCompleted: false },
  ];
}

function buildDefaultWeeklyTasks() {
  return [
    { id: 'archon_hunt', name: '执政官猎杀 (Archon Hunt)', description: '完成本周执政官猎杀', icon: 'gavel', accent: '#FFD84D', isCompleted: false },
    { id: 'kahl_garrison', name: '卡尔驻军任务 (Kahl\'s Garrison)', description: '完成本周卡尔驻军', icon: 'castle', accent: '#1FB6FF', isCompleted: false },
    { id: 'baro_kiteer', name: '虚空商人 (Baro Ki\'Teer)', description: '双周周末出现,记得查看虚空遗物 / 物品', icon: 'storefront', accent: '#D4AF37', isCompleted: false },
    { id: 'steel_path_rotation', name: '钢铁之路奖励轮换', description: '查看本周钢铁之路无尽奖励', icon: 'shield', accent: '#FFD84D', isCompleted: false },
  ];
}

// =============================================================
// 存储键名
// =============================================================

const STORE_KEYS = {
  DAILY: 'wf_daily_state',
  WEEKLY: 'wf_weekly_state',
  LAST_DAILY_RESET: 'wf_last_daily_reset',
  LAST_WEEKLY_RESET: 'wf_last_weekly_reset',
  REMINDERS: 'wf_reminders_state',
  NOTES: 'wf_notes_state',
  ARBI_AUTO_ADD: 'wf_arbi_auto_add',
};

const DATA_VERSION = 4;

// =============================================================
// TaskStorageService 等效实现
// =============================================================

const Store = {
  /**
   * 读取日常任务；无数据或解析失败时返回默认列表
   */
  loadDailyTasks() {
    return this._load(STORE_KEYS.DAILY, buildDefaultDailyTasks);
  },

  /**
   * 读取周常任务
   */
  loadWeeklyTasks() {
    return this._load(STORE_KEYS.WEEKLY, buildDefaultWeeklyTasks);
  },

  _load(key, defaultBuilder) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return defaultBuilder();
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return defaultBuilder();
      return parsed;
    } catch (e) {
      console.warn('数据解析失败，回退默认任务:', e);
      return defaultBuilder();
    }
  },

  /**
   * 保存日常任务
   */
  saveDailyTasks(tasks) {
    this._save(STORE_KEYS.DAILY, tasks);
    this._triggerSync();
  },

  /**
   * 保存周常任务
   */
  saveWeeklyTasks(tasks) {
    this._save(STORE_KEYS.WEEKLY, tasks);
    this._triggerSync();
  },

  _save(key, tasks) {
    try {
      localStorage.setItem(key, JSON.stringify(tasks));
    } catch (e) {
      console.warn('数据保存失败 (key=' + key + '):', e);
      if (typeof showSnackbar === 'function') {
        showSnackbar('数据保存失败：存储空间可能已满');
      }
    }
  },

  /**
   * 检查并执行日常/周常重置。
   * 返回 true 表示有变更，调用方需刷新 UI 并重新持久化。
   */
  checkAndPerformReset(dailyTasks, weeklyTasks) {
    const now = new Date();
    let changed = false;

    // --- 日常重置：每日 08:00 ---
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayResetTime = new Date(today.getTime() + DAILY_RESET_HOUR * HOUR_MS);
    const lastDaily = localStorage.getItem(STORE_KEYS.LAST_DAILY_RESET);
    const todayKey = formatDateKey(now);

    if (now >= todayResetTime && lastDaily !== todayKey) {
      for (const t of dailyTasks) { t.isCompleted = false; }
      localStorage.setItem(STORE_KEYS.LAST_DAILY_RESET, todayKey);
      changed = true;
    }

    // --- 周常重置：每周一 08:00 ---
    const thisWeekMonday = mostRecentWeekday(now, WEEKLY_RESET_WEEKDAY);
    const thisWeekResetTime = new Date(thisWeekMonday.getTime() + WEEKLY_RESET_HOUR * HOUR_MS);
    const lastWeekly = localStorage.getItem(STORE_KEYS.LAST_WEEKLY_RESET);
    const weekKey = formatDateKey(thisWeekMonday);

    if (now >= thisWeekResetTime && lastWeekly !== weekKey) {
      for (const t of weeklyTasks) { t.isCompleted = false; }
      localStorage.setItem(STORE_KEYS.LAST_WEEKLY_RESET, weekKey);
      changed = true;
    }

    return changed;
  },

  /**
   * 生成唯一 ID（用于新建任务）
   */
  generateId() {
    return '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },

  // =============================================================
  // 提醒事项存储
  // =============================================================

  /**
   * 读取提醒事项列表
   */
  loadReminders() {
    return this._load(STORE_KEYS.REMINDERS, () => []);
  },

  /**
   * 保存提醒事项列表
   */
  saveReminders(reminders) {
    this._save(STORE_KEYS.REMINDERS, reminders);
    this._triggerSync();
  },

  // =============================================================
  // 便签数据存储
  // =============================================================

  /**
   * 读取便签列表
   */
  loadNotes() {
    return this._load(STORE_KEYS.NOTES, () => []);
  },

  /**
   * 保存便签列表
   */
  saveNotes(notes) {
    this._save(STORE_KEYS.NOTES, notes);
    this._triggerSync();
  },

  // =============================================================
  // 仲裁自动添加提醒开关
  // =============================================================

  /**
   * 读取仲裁自动添加提醒开关（默认开启）
   */
  loadArbiAutoAdd() {
    const val = localStorage.getItem(STORE_KEYS.ARBI_AUTO_ADD);
    return val === null ? true : val === 'true';
  },

  /**
   * 保存仲裁自动添加提醒开关
   */
  saveArbiAutoAdd(enabled) {
    localStorage.setItem(STORE_KEYS.ARBI_AUTO_ADD, enabled ? 'true' : 'false');
    this._triggerSync();
  },

  // =============================================================
  // 导出/导入全部数据
  // =============================================================

  /**
   * 导出全部数据（用于导入导出和云端同步）
   */
  exportAll() {
    return {
      version: DATA_VERSION,
      exportTime: new Date().toISOString(),
      dailyTasks: this.loadDailyTasks(),
      weeklyTasks: this.loadWeeklyTasks(),
      reminders: this.loadReminders(),
      notes: this.loadNotes(),
      settings: {
        arbiAutoAdd: this.loadArbiAutoAdd(),
      },
    };
  },

  /**
   * 导入全部数据（覆盖式）
   */
  importAll(data) {
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.dailyTasks)) this.saveDailyTasks(data.dailyTasks);
    if (Array.isArray(data.weeklyTasks)) this.saveWeeklyTasks(data.weeklyTasks);
    if (Array.isArray(data.reminders)) this.saveReminders(data.reminders);
    if (Array.isArray(data.notes)) this.saveNotes(data.notes);
    if (data.settings && typeof data.settings.arbiAutoAdd === 'boolean') {
      this.saveArbiAutoAdd(data.settings.arbiAutoAdd);
    }
    return true;
  },

  // =============================================================
  // 云端同步触发
  // =============================================================

  _triggerSync() {
    if (typeof GistSync !== 'undefined' && GistSync.isConfigured()) {
      GistSync.triggerUpload();
    }
  },
};
