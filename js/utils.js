/**
 * utils.js — 工具函数模块
 * 包括：日期工具、DOM 辅助、Snackbar
 */

// =============================================================
// 重置常量
// =============================================================

const DAILY_RESET_HOUR = 8;
const WEEKLY_RESET_WEEKDAY = 1; // 周一
const WEEKLY_RESET_HOUR = 8;

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

const ACCENT_COLORS = ['#D4AF37', '#1FB6FF', '#c792ea', '#3FB950', '#E5534B'];
const DEFAULT_DAILY_ACCENT = '#FFD84D';
const DEFAULT_WEEKLY_ACCENT = '#1FB6FF';
const DEFAULT_REMINDER_ACCENT = '#FFD84D';
const DEFAULT_TASK_ACCENT = '#D4AF37';

// =============================================================
// 日期工具
// =============================================================

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 格式化日期为 "yyyy.MM.dd EEE"（例：2026.07.18 周六）
 */
function formatDate(now) {
  const d = now || new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${month}.${day} ${WEEKDAYS[d.getDay()]}`;
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
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() - diff);
}

/**
 * 格式化 Duration 为 "HH:MM:SS"
 */
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/**
 * 格式化时间为 "HH:MM"
 */
function formatHHMM(date) {
  const d = date || new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 计算日常/周常倒计时文字
 */
function countdownText(now) {
  now = now || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dailyReset = new Date(today.getTime() + DAILY_RESET_HOUR * HOUR_MS);
  const dailyTarget = now < dailyReset ? dailyReset : new Date(dailyReset.getTime() + DAY_MS);

  const thisWeekMonday = mostRecentWeekday(now, 1);
  let weeklyTarget = new Date(thisWeekMonday.getTime() + DAILY_RESET_HOUR * HOUR_MS);
  if (now >= weeklyTarget) {
    weeklyTarget = new Date(weeklyTarget.getTime() + 7 * DAY_MS);
  }

  return `日常 ${formatDuration(dailyTarget - now)}  ·  周常 ${formatDuration(weeklyTarget - now)}`;
}

// =============================================================
// file:// 协议支持
// =============================================================

// 双击打开 index.html 时 protocol 为 'file:'
const IS_FILE_PROTOCOL = location.protocol === 'file:';

/**
 * 通过 <script> 标签动态加载 JS 文件（file:// 协议下唯一可靠的本地数据加载方式）
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(script);
  });
}

// =============================================================
// DOM 辅助
// =============================================================

/**
 * 清空元素
 */
function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

/**
 * 显示 Snackbar 提示
 */
function showSnackbar(msg, duration = 2000) {
  let sb = document.getElementById('snackbar');
  if (!sb) {
    sb = document.createElement('div');
    sb.id = 'snackbar';
    sb.className = 'snackbar';
    document.body.appendChild(sb);
  }
  sb.textContent = msg;
  sb.classList.add('show');
  clearTimeout(sb._timer);
  sb._timer = setTimeout(() => sb.classList.remove('show'), duration);
}
