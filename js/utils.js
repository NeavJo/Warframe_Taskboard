/**
 * utils.js — 工具函数模块
 * 包括：日期工具、图标映射、颜色工具、DOM 辅助
 */

// =============================================================
// 图标映射表（字符串 ⇔ unicode/HTML）
// 对应 Flutter 版 Material Icons，这里用 unicode 符号近似
// =============================================================

const ICON_MAP = {
  'flash_on': '\u26A1',           // ⚡
  'card_giftcard': '\u1F381',     // 🎁 (需要span处理)
  'bolt': '\u26A1',               // ⚡
  'diamond_outlined': '\u25C6',   // ◆
  'gavel': '\u2696',              // ⚖
  'castle': '\u265F',             // ♟ (近似)
  'storefront': '\u1F3EA',        // 🏪
  'shield': '\u1F6E1',            // 🛡
  'star': '\u2B50',               // ⭐
  'track_changes': '\u1F4CD',     // 📍
  'rocket': '\u1F680',            // 🚀
  'military_tech': '\u1F396',     // 🎖
  'key': '\u1F511',               // 🔑
  'crisis_alert': '\u26A0',       // ⚠
  'check_circle_outline': '\u2714', // ✔
  'add': '\u002B',                // +
  'close': '\u2715',              // ✕
  'settings': '\u2699',           // ⚙
  'edit': '\u270E',               // ✎
  'delete': '\u2716',             // ✖
  'drag_handle': '\u2261',        // ≡
  'check': '\u2713',              // ✓
  'dashboard': '\u2630',          // ☰
  'public': '\u1F310',            // 🌐
  'refresh': '\u21BB',            // ↻
  'home': '\u2302',               // ⌂
  'link': '\u1F517',              // 🔗
  'shield_moon': '\u2726',        // ✦
  'moon': '\u23F0',               // (日用)
};

// 名称列表（不含 check_circle_outline，对应 kAvailableIcons）
const AVAILABLE_ICON_NAMES = Object.keys(ICON_MAP).filter(
  n => n !== 'check_circle_outline'
);

// 默认图标
const DEFAULT_ICON_KEY = 'check_circle_outline';

/**
 * 获取图标的 HTML 实体/字符
 * Material Icons 使用 unicode 范围在 E000-F8FF，无法在纯 HTML
 * 中直接用 unicode 表现。这里用 font-awesome 风格方案：
 * 我们使用 emoji/符号近似，但在 UI 中直接渲染字符。
 *
 * 更好的方案：使用 SVG 图标库或用 iconfont。
 * 这里为了视觉一致性，使用 Material Symbols 的 HTML 字面量。
 *
 * 实际上，index.html 已经引入了 Material Icons 的 CSS，
 * 所以这里保留名称映射，在使用时直接用 <span class="material-icons">name</span>
 */
function getIconHtml(iconKey, extraClass = '') {
  const name = iconKey || DEFAULT_ICON_KEY;
  return `<span class="material-icons ${extraClass}">${name.replace(/_/g, '_')}</span>`;
}

// =============================================================
// 日期工具
// =============================================================

/**
 * 格式化日期为 "yyyy.MM.dd EEE"（例：2026.07.18 周六）
 */
function formatDate(now) {
  const d = now || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const wd = weekdays[d.getDay()];
  return `${year}.${month}.${day} ${wd}`;
}

/**
 * 格式化日期为 yyyy-MM-dd（用于存储键值比较）
 */
function formatDateKey(dt) {
  const d = dt || new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * 从 from 回溯到最近的指定 weekday（含 from 当天）
 * weekday: 0=周日, 1=周一, ... 6=周六
 */
function mostRecentWeekday(from, weekday) {
  const diff = (from.getDay() - weekday + 7) % 7;
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return new Date(base.getTime() - diff * 86400000);
}

/**
 * 格式化 Duration 为 "HH:MM:SS"
 */
function formatDuration(d) {
  const totalSec = Math.floor(d / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/**
 * 计算日常/周常倒计时文字
 */
function countdownText(now) {
  now = now || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 日常倒计时：目标 = 今天 08:00（已过则明天 08:00）
  const dailyReset = new Date(today.getTime() + 8 * 3600000);
  const dailyTarget = now < dailyReset ? dailyReset : new Date(dailyReset.getTime() + 86400000);

  // 周常倒计时：目标 = 本周周一 08:00（已过则下周一 08:00）
  const thisWeekMonday = mostRecentWeekday(now, 1);
  let weeklyTarget = new Date(thisWeekMonday.getTime() + 8 * 3600000);
  if (now >= weeklyTarget) {
    weeklyTarget = new Date(weeklyTarget.getTime() + 7 * 86400000);
  }

  const dailyLeft = dailyTarget.getTime() - now.getTime();
  const weeklyLeft = weeklyTarget.getTime() - now.getTime();

  return `日常 ${formatDuration(dailyLeft)}  ·  周常 ${formatDuration(weeklyLeft)}`;
}

// 重置常量
const DAILY_RESET_HOUR = 8;
const WEEKLY_RESET_WEEKDAY = 1; // 周一
const WEEKLY_RESET_HOUR = 8;

// =============================================================
// DOM 辅助
// =============================================================

/**
 * 创建 DOM 元素
 */
function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') elem.className = val;
    else if (key === 'style' && typeof val === 'object') {
      Object.assign(elem.style, val);
    } else if (key.startsWith('on')) {
      elem.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'innerHTML') {
      elem.innerHTML = val;
    } else {
      elem.setAttribute(key, val);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
    else if (child instanceof Node) elem.appendChild(child);
  }
  return elem;
}

/**
 * 清空元素
 */
function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * 显示 Snackbar 提示
 */
function showSnackbar(msg, duration = 2000) {
  let sb = document.getElementById('snackbar');
  if (!sb) {
    sb = el('div', { id: 'snackbar', className: 'snackbar' });
    document.body.appendChild(sb);
  }
  sb.textContent = msg;
  sb.classList.add('show');
  clearTimeout(sb._timer);
  sb._timer = setTimeout(() => sb.classList.remove('show'), duration);
}
