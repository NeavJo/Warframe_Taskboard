/**
 * sync_gist.js — GitHub Gist 云端同步模块
 *
 * 功能：
 *   - 全量数据打包上传至 Gist（4秒防抖）
 *   - 从 Gist 拉取并按时间戳覆盖本地数据
 *   - visibilitychange 切回前台自动静默同步
 *
 * 数据格式：
 *   {
 *     "updatedAt": timestamp,
 *     "data": { dailyTasks, weeklyTasks, reminders, notes, settings }
 *   }
 */

const GIST_CONFIG_KEYS = {
  TOKEN: 'wf_gist_token',
  GIST_ID: 'wf_gist_id',
  LAST_SYNC: 'wf_last_sync_time',
};

const GIST_FILENAME = 'wf_taskboard_data.json';
const UPLOAD_DEBOUNCE_MS = 4000;

const GistSync = {
  _uploadTimer: null,
  _isUploading: false,
  _isDownloading: false,
  _uploadListeners: [],

  /**
   * 注册上传成功回调
   * @param {function(timestamp: number)} listener
   */
  onUpload(listener) {
    this._uploadListeners.push(listener);
  },

  _notifyUpload(ts) {
    this._uploadListeners.forEach(fn => {
      try { fn(ts); } catch (e) { console.warn(e); }
    });
  },

  // =============================================================
  // 配置读写
  // =============================================================

  getConfig() {
    return {
      token: localStorage.getItem(GIST_CONFIG_KEYS.TOKEN) || '',
      gistId: localStorage.getItem(GIST_CONFIG_KEYS.GIST_ID) || '',
    };
  },

  setConfig({ token, gistId }) {
    if (typeof token === 'string') {
      localStorage.setItem(GIST_CONFIG_KEYS.TOKEN, token);
    }
    if (typeof gistId === 'string') {
      localStorage.setItem(GIST_CONFIG_KEYS.GIST_ID, gistId);
    }
  },

  isConfigured() {
    const cfg = this.getConfig();
    return !!(cfg.token && cfg.gistId);
  },

  getLastSyncTime() {
    const v = localStorage.getItem(GIST_CONFIG_KEYS.LAST_SYNC);
    return v ? parseInt(v, 10) : 0;
  },

  setLastSyncTime(ts) {
    localStorage.setItem(GIST_CONFIG_KEYS.LAST_SYNC, String(ts));
  },

  // =============================================================
  // 全量数据收集（与 settings.js 导出格式一致）
  // =============================================================

  collectAllData() {
    if (typeof Store === 'undefined') {
      console.warn('GistSync: Store 未就绪');
      return null;
    }
    return Store.exportAll();
  },

  // =============================================================
  // 防抖上传
  // =============================================================

  triggerUpload() {
    if (!this.isConfigured()) return;

    if (this._uploadTimer) {
      clearTimeout(this._uploadTimer);
    }
    this._uploadTimer = setTimeout(() => {
      this._uploadTimer = null;
      this._doUpload();
    }, UPLOAD_DEBOUNCE_MS);
  },

  /** 立即上传（绕过防抖），返回 Promise */
  uploadNow() {
    if (this._uploadTimer) {
      clearTimeout(this._uploadTimer);
      this._uploadTimer = null;
    }
    return this._doUpload();
  },

  async _doUpload() {
    if (this._isUploading) return;
    this._isUploading = true;

    try {
      const data = this.collectAllData();
      if (!data) throw new Error('数据收集失败');

      const payload = {
        updatedAt: Date.now(),
        data,
      };

      const result = await this._apiPatch(payload);
      if (result && result.updatedAt) {
        this.setLastSyncTime(result.updatedAt);
        this._notifyUpload(result.updatedAt);
      }
      return result;
    } catch (e) {
      console.warn('GistSync 上传失败:', e);
      if (typeof showSnackbar === 'function') {
        showSnackbar('云端同步失败：' + (e.message || '未知错误'));
      }
      return null;
    } finally {
      this._isUploading = false;
    }
  },

  // =============================================================
  // 下载 & 同步
  // =============================================================

  /** 从 Gist 拉取最新数据 */
  async download() {
    if (!this.isConfigured()) {
      throw new Error('未配置 Token 或 Gist ID');
    }
    if (this._isDownloading) return null;
    this._isDownloading = true;

    try {
      const remote = await this._apiGet();
      return remote;
    } finally {
      this._isDownloading = false;
    }
  },

  /**
   * 检查并同步（静默）
   * @param {Function} onUpdate 有更新时的回调，传入 remote.data
   * @returns {boolean} 是否执行了更新
   */
  async checkAndSync(onUpdateCallback) {
    if (!this.isConfigured()) return false;

    try {
      const remote = await this.download();
      if (!remote || !remote.updatedAt || !remote.data) return false;

      const localLast = this.getLastSyncTime();
      if (remote.updatedAt <= localLast) return false;

      // 应用到本地
      this._applyRemoteData(remote.data);
      this.setLastSyncTime(remote.updatedAt);

      if (typeof onUpdateCallback === 'function') {
        try { onUpdateCallback(remote.data); } catch (e) { console.warn(e); }
      }
      return true;
    } catch (e) {
      console.warn('GistSync 静默同步失败:', e);
      return false;
    }
  },

  _applyRemoteData(data) {
    if (!data) return;
    Store.importAll(data);
  },

  // =============================================================
  // GitHub Gist API
  // =============================================================

  async _request(method, body = null) {
    const { token, gistId } = this.getConfig();
    if (!token || !gistId) {
      return { ok: false, status: 401, data: null };
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'token ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (res.status === 404) {
      return { ok: false, status: 404, data: null };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, data: null };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }
    const data = await res.json();
    return { ok: true, status: res.status, data };
  },

  async _apiGet() {
    const result = await this._request('GET');

    if (!result.ok) {
      if (result.status === 404) throw new Error('Gist 不存在');
      if (result.status === 401 || result.status === 403) throw new Error('Token 无效或无权限');
      throw new Error(`HTTP ${result.status}`);
    }

    const gist = result.data;
    const file = gist.files && gist.files[GIST_FILENAME];
    if (!file) {
      return { updatedAt: 0, data: null };
    }

    try {
      const content = JSON.parse(file.content);
      return content;
    } catch (e) {
      throw new Error('Gist 文件内容不是有效的 JSON');
    }
  },

  async _apiPatch(payload) {
    const body = {
      description: 'Warframe Taskboard Sync Data',
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(payload, null, 2),
        },
      },
    };

    const result = await this._request('PATCH', body);

    if (!result.ok) {
      if (result.status === 404) throw new Error('Gist 不存在');
      if (result.status === 401 || result.status === 403) throw new Error('Token 无效或无权限');
      throw new Error(`HTTP ${result.status}`);
    }

    return { updatedAt: payload.updatedAt };
  },
};

window.GistSync = GistSync;
