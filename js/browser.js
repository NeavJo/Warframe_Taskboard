/**
 * browser.js — 内置浏览器页面逻辑
 * 对应 Flutter 版 BrowserPage
 *
 * 职责：iframe 页面加载、预设站点切换、URL 导航、刷新/首页、URL 持久化
 *
 * 预设站点行为：
 *   - 灰机 Wiki（首个）：在 iframe 内加载
 *   - 其余站点：点击后在新标签页打开（window.open）
 */

const LAST_URL_KEY = 'wf_browser_last_url';

// 预设站点（首个为 iframe 内嵌站点，其余为外部新标签页）
const PRESET_SITES = [
  { name: '灰机 Wiki',  url: 'https://warframe.huijiwiki.com/wiki/Mainpage', accent: '#FFD84D', iframe: true },
  { name: 'wf.wiki 导航', url: 'https://wf.wiki',                          accent: '#D4AF37', iframe: false },
  { name: 'Warframe Market', url: 'https://warframe.market',                accent: '#1FB6FF', iframe: false },
];

/** iframe 默认加载站点的索引（首个 iframe: true 的项） */
const IFRAME_SITE_INDEX = PRESET_SITES.findIndex(s => s.iframe);

const Browser = {
  _state: {
    currentIframeUrl: '',
    isReady: false,
  },

  _els: {},

  init(container) {
    // 从 localStorage 加载上次 URL，无记录时使用默认 iframe 站点
    const lastUrl = localStorage.getItem(LAST_URL_KEY);
    const initialUrl = lastUrl || PRESET_SITES[IFRAME_SITE_INDEX].url;

    container.innerHTML = `
      <div class="browser-page">
        <!-- 窄屏内置工具栏 -->
        <div class="browser-toolbar page-header" id="br-toolbar">
          <div class="toolbar-top">
            <div class="toolbar-brand-group">
              <button class="nav-trigger-inline toolbar-trigger" onclick="window.App.openDrawer()" aria-label="打开导航菜单">
                <span class="material-icons mi-md">dashboard</span>
              </button>
              <span class="material-icons site-icon" id="br-site-icon" style="color:${PRESET_SITES[IFRAME_SITE_INDEX].accent};text-shadow:0 0 6px ${PRESET_SITES[IFRAME_SITE_INDEX].accent};">public</span>
              <span class="toolbar-brand">内置浏览器</span>
            </div>
            <div class="page-spacer"></div>
            <span class="toolbar-hint"></span>
          </div>
          <div class="site-tabs" id="br-site-tabs"></div>
        </div>

        <!-- iframe 视图 -->
        <div class="browser-view" id="br-view">
          <div class="browser-loading" id="br-loading">
            <div class="spinner"></div>
            <div class="loading-text">WebView 初始化中…</div>
          </div>
          <iframe id="br-frame" style="display:none;"></iframe>
        </div>
      </div>
    `;

    this._els.container = container;
    this._els.siteTabs = document.getElementById('br-site-tabs');
    this._els.iframe = document.getElementById('br-frame');
    this._els.loading = document.getElementById('br-loading');
    this._els.siteIcon = document.getElementById('br-site-icon');

    // 渲染预设站点按钮
    this._renderSiteTabs();

    // 绑定 iframe 加载事件
    this._els.iframe.addEventListener('load', () => {
      this._els.loading.style.display = 'none';
      this._els.iframe.style.display = 'block';
      this._state.isReady = true;
    });

    // 加载初始页面
    this._navigate(initialUrl);
  },

  _renderSiteTabs() {
    clearEl(this._els.siteTabs);
    PRESET_SITES.forEach((site, i) => {
      const isIframe = site.iframe;
      const btn = createBtn({
        text: site.name,
        active: isIframe,
        onClick: () => this._handleSiteClick(i),
      });
      btn.style.fontSize = '12px';
      // 非 iframe 站点加提示标记
      if (!isIframe) {
        btn.title = '在新标签页中打开';
      }
      this._els.siteTabs.appendChild(btn);
    });
  },

  /**
   * 站点点击处理：
   *   - iframe 站点 → iframe 内加载
   *   - 外部站点 → 新标签页打开
   */
  _handleSiteClick(index) {
    const site = PRESET_SITES[index];
    if (site.iframe) {
      // 如果已在加载该 URL 且 iframe 已就绪，跳过
      if (this._els.iframe.src === site.url && this._state.isReady) return;
      this._navigate(site.url);
    } else {
      window.open(site.url, '_blank');
    }
  },

  _navigate(url) {
    this._state.currentIframeUrl = url;
    this._els.loading.style.display = 'flex';
    this._els.iframe.style.display = 'none';
    this._els.iframe.src = url;
    localStorage.setItem(LAST_URL_KEY, url);
  },

  /**
   * 回到 iframe 默认站点首页
   */
  goHome() {
    const site = PRESET_SITES[IFRAME_SITE_INDEX];
    this._navigate(site.url);
  },

  /**
   * 刷新 iframe
   */
  reload() {
    if (this._els.iframe.src) {
      this._els.iframe.src = this._els.iframe.src;
    }
  },

  /**
   * URL 提交处理（由外部 URL 输入框调用）
   */
  handleUrlSubmit(val) {
    let url = val.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    this._navigate(url);
  },

  /**
   * 获取当前 iframe URL
   */
  getCurrentUrl() {
    return this._els.iframe.src || '';
  },
};
