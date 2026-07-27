/**
 * test_runner.js — 功能自检测试脚本
 * 
 * 使用方法：
 * 1. 在设置页面依次按下键盘 d-e-b-u-g 四个字母
 * 2. 隐藏的「功能自检」按钮将出现
 * 3. 点击按钮运行测试，测试结果将以弹窗形式展示
 * 4. 弹窗有「复制报告」按钮
 */

const TestRunner = {
  results: [],
  passed: 0,
  failed: 0,

  // ==================== 工具函数 ====================

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  $(sel) {
    return document.querySelector(sel);
  },

  $$(sel) {
    return Array.from(document.querySelectorAll(sel));
  },

  // 通过索引获取侧栏按钮
  navBtn(index) {
    const tiles = this.$$('.sidebar-tile');
    return tiles[index] || null;
  },

  // 通过图标名称获取侧栏按钮
  navBtnByIcon(iconName) {
    const tiles = this.$$('.sidebar-tile');
    return tiles.find(t => t.querySelector(`.material-icons`)?.textContent === iconName) || null;
  },

  waitFor(sel, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = this.$(sel);
      if (el) return el;
    }
    return null;
  },

  async click(sel) {
    const el = this.waitFor(sel, 2000);
    if (el) {
      el.click();
      await this.wait(100);
      return true;
    }
    return false;
  },

  exists(sel) {
    return !!this.$(sel);
  },

  // 检查页面是否可见（通过 page-view 的 active class）
  pageVisible(pageId) {
    const page = document.getElementById(pageId);
    if (!page) return false;
    return page.classList.contains('active');
  },

  // 通过索引切换页面
  switchPage(index) {
    const btn = this.navBtn(index);
    if (btn) btn.click();
  },

  visible(sel) {
    const el = this.$(sel);
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  },

  assert(condition, message) {
    return { pass: !!condition, message };
  },

  // ==================== 测试用例 ====================

  tests: [
    // ---------- 基础结构测试 ----------
    {
      name: '页面容器存在',
      exec: async (t) => {
        const app = t.$('#app');
        return t.assert(app, '#app 容器存在');
      }
    },
    {
      name: '侧栏导航存在',
      exec: async (t) => {
        const sidebar = t.$('.sidebar');
        return t.assert(sidebar, '.sidebar 存在');
      }
    },

    // ---------- 侧栏导航测试 ----------
    {
      name: '侧栏导航-看板',
      exec: async (t) => {
        t.switchPage(0);
        await t.wait(300);
        return t.assert(t.pageVisible('page-taskboard'), '看板页面可见');
      }
    },
    {
      name: '侧栏导航-提醒',
      exec: async (t) => {
        t.switchPage(1);
        await t.wait(300);
        return t.assert(t.pageVisible('page-reminder'), '提醒页面可见');
      }
    },
    {
      name: '侧栏导航-便签',
      exec: async (t) => {
        t.switchPage(2);
        await t.wait(300);
        return t.assert(t.pageVisible('page-notes'), '便签页面可见');
      }
    },
    {
      name: '侧栏导航-仲裁',
      exec: async (t) => {
        t.switchPage(3);
        await t.wait(300);
        return t.assert(t.pageVisible('page-arbitration'), '仲裁页面可见');
      }
    },
    {
      name: '侧栏导航-浏览器',
      exec: async (t) => {
        t.switchPage(4);
        await t.wait(300);
        return t.assert(t.pageVisible('page-browser'), '浏览器页面可见');
      }
    },
    {
      name: '侧栏导航-市场查价',
      exec: async (t) => {
        t.switchPage(5);
        await t.wait(300);
        return t.assert(t.pageVisible('page-market'), '市场查价页面可见');
      }
    },
    {
      name: '侧栏导航-设置',
      exec: async (t) => {
        t.switchPage(6);
        await t.wait(300);
        return t.assert(t.pageVisible('page-settings'), '设置页面可见');
      }
    },

    // ---------- 任务看板测试 ----------
    {
      name: '看板-日常面板存在',
      exec: async (t) => {
        t.switchPage(0);
        await t.wait(300);
        const panels = t.$$('.task-panel');
        const dailyPanel = panels.find(p => p.textContent.includes('DAILY'));
        return t.assert(dailyPanel, '日常任务面板存在');
      }
    },
    {
      name: '看板-周常面板存在',
      exec: async (t) => {
        const panels = t.$$('.task-panel');
        const weeklyPanel = panels.find(p => p.textContent.includes('WEEKLY'));
        return t.assert(weeklyPanel, '周常任务面板存在');
      }
    },
    {
      name: '看板-管理按钮切换',
      exec: async (t) => {
        const manageBtn = t.$('#manage-btn') || t.$('#wide-manage-btn');
        if (!manageBtn) return t.assert(false, '管理按钮不存在');
        manageBtn.click();
        await t.wait(200);
        const isActive = manageBtn.classList.contains('active');
        // 再次点击恢复
        manageBtn.click();
        await t.wait(200);
        return t.assert(isActive, '管理按钮可切换激活态');
      }
    },

    // ---------- 提醒页面测试 ----------
    {
      name: '提醒-页面结构',
      exec: async (t) => {
        t.switchPage(1);
        await t.wait(300);
        const header = t.$('.reminder-header') || t.$('.page-header');
        const content = t.$('.reminder-content') || t.$('.reminder-list');
        return t.assert(header && content, '提醒页面结构完整');
      }
    },
    {
      name: '提醒-新增对话框',
      exec: async (t) => {
        const addBtn = t.$('#rm-add-btn') || t.$('.reminder-add-btn');
        if (!addBtn) return t.assert(false, '新增按钮不存在');
        addBtn.click();
        await t.wait(300);
        const dialog = t.$('.dialog-overlay.open') || t.$('.dialog-box');
        const result = t.assert(dialog, '新增对话框弹出');
        t.$('.dialog-close')?.click();
        await t.wait(200);
        return result;
      }
    },

    // ---------- 便签页面测试 ----------
    {
      name: '便签-页面结构',
      exec: async (t) => {
        t.switchPage(2);
        await t.wait(300);
        const header = t.$('.notes-header') || t.$('.page-header');
        const content = t.$('.notes-content') || t.$('.notes-list');
        return t.assert(header && content, '便签页面结构完整');
      }
    },
    {
      name: '便签-新建对话框',
      exec: async (t) => {
        const addBtn = t.$('#nt-add-btn') || t.$('#nt-composer') || t.$('.notes-add-btn');
        if (!addBtn) return t.assert(false, '新建入口不存在');
        addBtn.click();
        await t.wait(300);
        const dialog = t.$('.dialog-overlay.open') || t.$('.dialog-box');
        const result = t.assert(dialog, '新建便签对话框弹出');
        t.$('.dialog-close')?.click();
        await t.wait(200);
        return result;
      }
    },
    {
      name: '便签-编辑器底部按钮',
      exec: async (t) => {
        const addBtn = t.$('#nt-add-btn') || t.$('#nt-composer') || t.$('.notes-add-btn');
        if (!addBtn) return t.assert(false, '新建入口不存在');
        addBtn.click();
        await t.wait(300);
        const footer = t.$('.dialog-footer');
        if (!footer) { t.$('.dialog-close')?.click(); return t.assert(false, '底部按钮区不存在'); }
        const cancelBtn = footer.querySelector('.wf-btn.outline');
        const submitBtn = footer.querySelector('.wf-btn.primary');
        t.$('.dialog-close')?.click();
        await t.wait(200);
        return t.assert(cancelBtn && submitBtn, '取消和保存按钮存在');
      }
    },

    // ---------- 浏览器页面测试 ----------
    {
      name: '浏览器-页面结构',
      exec: async (t) => {
        t.switchPage(4);
        await t.wait(300);
        const toolbar = t.$('.browser-toolbar') || t.$('.browser-controls');
        const view = t.$('.browser-view') || t.$('.browser-webview');
        return t.assert(toolbar || view, '浏览器页面结构存在');
      }
    },

    // ---------- 设置页面测试 ----------
    {
      name: '设置-页面结构',
      exec: async (t) => {
        t.switchPage(6);
        await t.wait(300);
        const header = t.$('.settings-header') || t.$('.page-header');
        const cards = t.$('.settings-cards');
        return t.assert(header && cards, '设置页面结构完整');
      }
    },
    {
      name: '设置-数据操作按钮',
      exec: async (t) => {
        const hasExport = !!t.$('#settings-export-btn') || !!t.$('#export-btn');
        const hasImport = !!t.$('#settings-import-btn') || !!t.$('#import-btn');
        const hasSyncCard = !!t.$('#settings-sync-card');
        return t.assert(hasExport && hasImport && hasSyncCard, '导出/导入/同步按钮齐全');
      }
    },

    // ---------- 对话框组件测试 ----------
    {
      name: '对话框-关闭按钮',
      exec: async (t) => {
        t.switchPage(2);
        await t.wait(200);
        const addBtn = t.$('#nt-add-btn') || t.$('#nt-composer') || t.$('.notes-add-btn');
        if (!addBtn) return t.assert(false, '新建入口不存在');
        addBtn.click();
        await t.wait(300);
        const closeBtn = t.$('.dialog-close');
        if (!closeBtn) return t.assert(false, '关闭按钮不存在');
        closeBtn.click();
        await t.wait(300);
        return t.assert(!t.$('.dialog-overlay.open'), '对话框可关闭');
      }
    },
    {
      name: '对话框-遮罩关闭',
      exec: async (t) => {
        t.switchPage(2);
        await t.wait(200);
        const addBtn = t.$('#nt-add-btn') || t.$('#nt-composer') || t.$('.notes-add-btn');
        if (!addBtn) return t.assert(false, '新建入口不存在');
        addBtn.click();
        await t.wait(300);
        const overlay = t.$('.dialog-overlay.open');
        if (!overlay) return t.assert(false, '对话框未打开');
        overlay.click();
        await t.wait(300);
        return t.assert(!t.$('.dialog-overlay.open'), '点击遮罩可关闭');
      }
    },

    // ---------- Snackbar 测试 ----------
    {
      name: 'Snackbar 显示',
      exec: async (t) => {
        if (typeof showSnackbar !== 'function') {
          return t.assert(false, 'showSnackbar 函数不存在');
        }
        showSnackbar('自检测试消息');
        await t.wait(200);
        return t.assert(t.$('.snackbar.show'), 'Snackbar 可显示');
      }
    },

    // ---------- 数据持久化测试 ----------
    {
      name: 'Store 数据加载',
      exec: async (t) => {
        if (typeof Store === 'undefined') return t.assert(false, 'Store 模块未加载');
        try {
          const notes = Store.loadNotes ? Store.loadNotes() : [];
          const tasks = Store.loadTasks ? Store.loadTasks() : null;
          return t.assert(true, `便签: ${Array.isArray(notes) ? notes.length : 'N/A'} 条, 任务: ${tasks ? '已加载' : 'N/A'}`);
        } catch (e) {
          return t.assert(false, `数据加载异常: ${e.message}`);
        }
      }
    },
  ],

  // ==================== 运行测试 ====================

  async run() {
    console.log('%c[自检] 功能自检测试开始', 'color: #D4AF37; font-weight: bold;');
    this.results = [];
    this.passed = 0;
    this.failed = 0;

    for (const test of this.tests) {
      try {
        const result = await test.exec(this);
        if (result.pass) {
          this.passed++;
        } else {
          this.failed++;
        }
        this.results.push({
          name: test.name,
          pass: result.pass,
          message: result.message
        });
        console.log(`${result.pass ? '✓' : '✗'} ${test.name}: ${result.message}`);
      } catch (error) {
        this.failed++;
        this.results.push({
          name: test.name,
          pass: false,
          message: `异常: ${error.message}`
        });
        console.log(`✗ ${test.name}: 异常 ${error.message}`);
      }
      await this.wait(80);
    }

    this._showResultDialog();
  },

  // ==================== 弹窗显示结果 ====================

  _showResultDialog() {
    const total = this.tests.length;
    const passRate = total > 0 ? Math.round(this.passed / total * 100) : 0;
    const hasFail = this.failed > 0;
    const statusIcon = hasFail ? '⚠️' : '✅';
    const statusColor = hasFail ? '#E5534B' : '#3FB950';

    // 构建报告文本（用于复制）
    const reportText = this._buildReportText(total, passRate);

    // 构建弹窗内容
    const itemsHtml = this.results.map(r => {
      const color = r.pass ? '#3FB950' : '#E5534B';
      const icon = r.pass ? '✓' : '✗';
      return `<div class="test-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;background:rgba(255,255,255,0.03);font-size:12px;">
        <span style="color:${color};font-weight:bold;flex-shrink:0;width:16px;">${icon}</span>
        <span style="color:var(--text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.name}</span>
        <span style="color:var(--text-muted);font-size:11px;flex-shrink:0;">${r.message}</span>
      </div>`;
    }).join('');

    const html = `
      <div style="padding:8px 12px 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bg-border);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;">${statusIcon}</span>
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--text-primary);letter-spacing:1px;">自检完成</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">共 ${total} 项 · 通过 ${this.passed} · 失败 ${this.failed}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:800;color:${statusColor};font-variant-numeric:tabular-nums;">${passRate}%</div>
            <div style="font-size:10px;color:var(--text-muted);letter-spacing:2px;">通过率</div>
          </div>
        </div>
        <div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
          ${itemsHtml}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;padding-top:10px;border-top:1px solid var(--bg-border);">
          <button class="wf-btn outline" id="test-copy-btn" style="flex:1;">
            <span class="material-icons" style="font-size:16px;">content_copy</span>
            <span>复制报告</span>
          </button>
          <button class="wf-btn primary" id="test-close-btn" style="flex:0 0 auto;min-width:100px;">
            <span>关闭</span>
          </button>
        </div>
      </div>
    `;

    // 使用 confirmDialog 风格弹窗
    const body = document.createElement('div');
    body.style.padding = '0';
    body.innerHTML = html;

    const dialog = createDialog({
      title: '功能自检报告',
      body: body,
      closeOnOverlay: true,
      closeOnEscape: true,
    });
    dialog.box.className = `wf-card ${hasFail ? 'silver' : 'gold'} dialog-box`;
    dialog.box.style.maxWidth = '520px';

    // 绑定按钮
    body.querySelector('#test-close-btn').addEventListener('click', () => dialog.close());
    body.querySelector('#test-copy-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(reportText);
        const btn = body.querySelector('#test-copy-btn');
        const span = btn.querySelector('span:last-child');
        const orig = span.textContent;
        span.textContent = '已复制 ✓';
        btn.style.opacity = '0.7';
        setTimeout(() => {
          span.textContent = orig;
          btn.style.opacity = '';
        }, 1500);
      } catch (e) {
        // 降级方案
        const ta = document.createElement('textarea');
        ta.value = reportText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showSnackbar('报告已复制');
      }
    });
  },

  _buildReportText(total, passRate) {
    const lines = [
      '=== Warframe Taskboard 功能自检报告 ===',
      `时间: ${new Date().toLocaleString()}`,
      `总计: ${total} 项`,
      `通过: ${this.passed} 项`,
      `失败: ${this.failed} 项`,
      `通过率: ${passRate}%`,
      '',
      '--- 详细结果 ---',
    ];
    this.results.forEach((r, i) => {
      lines.push(`${i + 1}. [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: ${r.message}`);
    });
    lines.push('');
    lines.push('=== 报告结束 ===');
    return lines.join('\n');
  }
};