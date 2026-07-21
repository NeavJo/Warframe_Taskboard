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

// 一天的毫秒数（常量化避免重复计算）
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

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
// DOM 辅助
// =============================================================

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
