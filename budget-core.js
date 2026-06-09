const STORAGE_KEY = "goal-mall-budget-dashboard-v3";
const LEGACY_KEYS = ["goal-mall-budget-dashboard-v2", "goal-mall-budget-dashboard-v1"];
const MAX_PINNED_GOALS = 3;
let remoteHydrationPromise = null;
let remoteSyncTimer = null;
let remoteSyncInFlight = null;

function readCookieValue(name) {
  const source = `; ${document.cookie || ""}`;
  const parts = source.split(`; ${name}=`);
  if (parts.length < 2) {
    return "";
  }
  return decodeURIComponent(parts.pop().split(";").shift() || "");
}

function getScopedStorageKey() {
  const userId = readCookieValue("wish_user");
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

function getScopedLegacyKeys() {
  const userId = readCookieValue("wish_user");
  if (!userId) {
    return [...LEGACY_KEYS];
  }
  return [
    `${LEGACY_KEYS[0]}:${userId}`,
    `${LEGACY_KEYS[1]}:${userId}`,
    STORAGE_KEY,
    ...LEGACY_KEYS
  ];
}

const motivationalQuotes = [
  { text: "先把今天的一点点做好，明天就会更靠近想去的地方。", author: "今日激励" },
  { text: "你不是在省钱，你是在为想要的人生提前铺路。", author: "目标提醒" },
  { text: "每一笔克制住的冲动消费，都会变成未来更自由的选择。", author: "自我鼓励" },
  { text: "慢慢存，也是在认真地爱自己的未来。", author: "温柔进步" },
  { text: "真正让人安心的，不是赚了多少，而是目标在一点点实现。", author: "进度宣言" },
  { text: "攒下来的不是小钱，是下一次出发的底气。", author: "愿望进度板" },
  { text: "今天少一点随手花，明天就多一点主动权。", author: "预算提醒" },
  { text: "钱慢慢到位，生活也会慢慢向理想靠近。", author: "稳稳前进" },
  { text: "愿望不是空想，愿意持续准备，它就会落地。", author: "给自己的话" },
  { text: "看见进度，就是继续坚持最好的理由。", author: "进度宣言" },
  { text: "你每一次认真分配收入，都是在保护未来的自己。", author: "理财提醒" },
  { text: "先照顾长期目标，短暂欲望就没那么吵了。", author: "自律时刻" },
  { text: "把钱放进愿望里，本身就是一种温柔的自我奖励。", author: "愿望杂货铺" },
  { text: "不乱花钱，不是委屈自己，是把快乐留给更重要的事。", author: "克制也自由" },
  { text: "一点一点凑齐目标，比突然努力更可靠。", author: "稳定积累" },
  { text: "预算清楚了，心也会更安定。", author: "生活秩序" },
  { text: "每一笔进入目标的钱，都在替未来铺灯。", author: "今日激励" },
  { text: "你现在的认真，正在给以后的自己腾出余地。", author: "长期主义" },
  { text: "不是所有喜欢都要立刻买下，很多愿望值得慢慢成全。", author: "消费提醒" },
  { text: "目标可视化之后，坚持会变得容易很多。", author: "进度观察" },
  { text: "账户有计划，生活就不容易慌张。", author: "日常管理" },
  { text: "每次拒绝无意义消费，都是在对重要愿望点头。", author: "愿望优先" },
  { text: "你不是在推迟快乐，你是在换一种更大的快乐。", author: "理性奖励" },
  { text: "能看见差多少，也就更知道下一步该往哪走。", author: "路线清晰" },
  { text: "别急，很多好事都是先准备，再抵达。", author: "慢慢实现" },
  { text: "今天存下的一小步，常常就是未来改变的一大步。", author: "今日激励" },
  { text: "有目标地花钱，会让辛苦赚来的钱更有意义。", author: "花钱有方向" },
  { text: "愿望不会自己长大，但会在你的安排里慢慢成真。", author: "愿望杂货铺" }
];

const palette = ["#d9754f", "#487a72", "#d5a95a", "#7f6af2", "#b55d88", "#5a7ecb"];
const goalIconLibrary = [
  { value: "✈", label: "旅行" },
  { value: "🎒", label: "出发" },
  { value: "🏡", label: "生活" },
  { value: "📚", label: "学习" },
  { value: "💻", label: "数码" },
  { value: "🎓", label: "成长" },
  { value: "💪", label: "健康" },
  { value: "🎨", label: "兴趣" },
  { value: "📷", label: "记录" },
  { value: "🎁", label: "奖励" },
  { value: "💍", label: "纪念" },
  { value: "🚗", label: "出行" },
  { value: "🏠", label: "家庭" },
  { value: "🛋", label: "家居" },
  { value: "🐈", label: "宠物" },
  { value: "🌿", label: "放松" },
  { value: "🍰", label: "美食" },
  { value: "☕", label: "日常" },
  { value: "📱", label: "手机" },
  { value: "🎯", label: "目标" }
];
const categoryColors = {
  "生活费": "#487a72",
  "备用金": "#d5a95a",
  "娱乐": "#b55d88",
  "自由奖励": "#8c6d62"
};
const archivedGoalColor = "#9a8e85";
const completedGoalColor = "#5d8b61";

const seedState = {
  goals: [
    {
      id: "goal-trip",
      name: "旅行基金",
      target: 2000,
      baseSaved: 500,
      note: "先把旅行预算准备好，攒够就可以立刻安排出发。",
      icon: "✈",
      image: "",
      hasDeadline: true,
      deadline: "2026-08-18",
      color: "#d9754f",
      isPinned: true,
      status: "active",
      sortOrder: 0,
      createdAt: "2026-05-12"
    },
    {
      id: "goal-course",
      name: "课程充电",
      target: 899,
      baseSaved: 120,
      note: "给自己留一笔学习升级的钱，合适的时候就报名。",
      icon: "📚",
      image: "",
      hasDeadline: true,
      deadline: "2026-07-30",
      color: "#487a72",
      isPinned: true,
      status: "active",
      sortOrder: 1,
      createdAt: "2026-05-21"
    }
  ],
  incomes: [
    {
      id: "income-1",
      date: "2026-06-02",
      source: "兼职设计",
      amount: 800,
      note: "把这笔收入优先推进旅行目标，剩下留作生活安排。",
      allocations: [
        { type: "goal", targetId: "goal-trip", targetName: "旅行基金", amount: 400 },
        { type: "category", label: "生活费", amount: 250 },
        { type: "category", label: "自由奖励", amount: 150 }
      ]
    },
    {
      id: "income-2",
      date: "2026-06-07",
      source: "月度工资",
      amount: 3200,
      note: "工资到账后先照顾长期目标，再补充备用资金。",
      allocations: [
        { type: "goal", targetId: "goal-trip", targetName: "旅行基金", amount: 350 },
        { type: "goal", targetId: "goal-course", targetName: "课程充电", amount: 240 },
        { type: "category", label: "生活费", amount: 1800 },
        { type: "category", label: "备用金", amount: 600 },
        { type: "category", label: "娱乐", amount: 210 }
      ]
    }
  ],
  ui: {
    showArchivedAllocations: true,
    wishShelfRows: 2,
    theme: {
      accent: "#d9754f",
      accentDeep: "#8f4d34",
      gold: "#d5a95a",
      bgStart: "#f6efe7",
      bgEnd: "#efe4d7"
    },
    allocationItemVisibility: {}
  }
};

function cloneSeed() {
  return structuredClone(seedState);
}

function loadState() {
  const keys = [getScopedStorageKey(), ...getScopedLegacyKeys()];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch {
      return cloneSeed();
    }
  }
  return cloneSeed();
}

function loadRawState() {
  const keys = [getScopedStorageKey(), ...getScopedLegacyKeys()];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return cloneSeed();
    }
  }
  return cloneSeed();
}

function normalizeState(raw) {
  const fallback = cloneSeed();
  return {
    goals: Array.isArray(raw.goals)
      ? raw.goals.map((goal, index) => ({
          status: "active",
          isPinned: index < MAX_PINNED_GOALS,
          note: "",
          icon: "🎯",
          image: "",
          hasDeadline: goal?.deadline ? true : false,
          sortOrder: index,
          ...goal
        }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      : fallback.goals,
    incomes: Array.isArray(raw.incomes)
      ? raw.incomes.map((income, incomeIndex) => normalizeIncome(income, incomeIndex))
      : fallback.incomes.map((income, incomeIndex) => normalizeIncome(income, incomeIndex)),
    ui: {
      showArchivedAllocations: raw.ui?.showArchivedAllocations ?? true,
      wishShelfRows: clampWishShelfRows(raw.ui?.wishShelfRows),
      theme: {
        accent: raw.ui?.theme?.accent ?? fallback.ui.theme.accent,
        accentDeep: raw.ui?.theme?.accentDeep ?? fallback.ui.theme.accentDeep,
        gold: raw.ui?.theme?.gold ?? fallback.ui.theme.gold,
        bgStart: raw.ui?.theme?.bgStart ?? fallback.ui.theme.bgStart,
        bgEnd: raw.ui?.theme?.bgEnd ?? fallback.ui.theme.bgEnd
      },
      allocationItemVisibility: raw.ui?.allocationItemVisibility ?? {}
    }
  };
}

function clampWishShelfRows(value) {
  const rows = Number(value || 2);
  if (!Number.isFinite(rows)) {
    return 2;
  }
  return Math.min(Math.max(Math.round(rows), 1), 999);
}

function saveState(state) {
  localStorage.setItem(getScopedStorageKey(), JSON.stringify(state));
  queueRemoteStateSync(state);
}

function applyTheme(theme) {
  if (!theme) {
    return;
  }
  const accentRgb = hexToRgb(theme.accent);
  const accentDeepRgb = hexToRgb(theme.accentDeep);
  const goldRgb = hexToRgb(theme.gold);
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--accent-deep", theme.accentDeep);
  document.documentElement.style.setProperty("--gold", theme.gold);
  document.documentElement.style.setProperty("--bg-start", theme.bgStart || "#f6efe7");
  document.documentElement.style.setProperty("--bg-end", theme.bgEnd || "#efe4d7");
  document.documentElement.style.setProperty("--accent-soft", `${theme.accent}22`);
  document.documentElement.style.setProperty("--gold-soft", `${theme.gold}33`);
  document.documentElement.style.setProperty("--accent-rgb", accentRgb);
  document.documentElement.style.setProperty("--accent-deep-rgb", accentDeepRgb);
  document.documentElement.style.setProperty("--gold-rgb", goldRgb);
  document.documentElement.style.setProperty("--panel-tint", `rgba(${accentRgb}, 0.08)`);
  document.documentElement.style.setProperty("--panel-border", `rgba(${accentRgb}, 0.18)`);
  document.documentElement.style.setProperty("--button-soft", `rgba(${accentRgb}, 0.1)`);
  document.documentElement.style.setProperty("--goal-soft", `rgba(${accentRgb}, 0.12)`);
  document.documentElement.style.setProperty("--gold-wash", `rgba(${goldRgb}, 0.16)`);
  document.documentElement.style.setProperty("--deep-shadow", `rgba(${accentDeepRgb}, 0.22)`);
}

function resetState() {
  const nextState = cloneSeed();
  saveState(nextState);
  return nextState;
}

async function fetchSessionUser() {
  if (typeof fetch !== "function") {
    return null;
  }
  try {
    const response = await fetch("/api/session", { credentials: "same-origin" });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return payload?.authenticated ? payload.user || null : null;
  } catch {
    return null;
  }
}

function queueRemoteStateSync(state) {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return;
  }
  window.clearTimeout(remoteSyncTimer);
  const snapshot = structuredClone(state);
  remoteSyncTimer = window.setTimeout(() => {
    remoteSyncInFlight = syncRemoteStateNow(snapshot).finally(() => {
      remoteSyncInFlight = null;
    });
  }, 320);
}

async function syncRemoteStateNow(state = loadState()) {
  const user = await fetchSessionUser();
  if (!user) {
    return false;
  }
  try {
    await fetch("/api/app-state", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ state })
    });
    return true;
  } catch {
    return false;
  }
}

async function hydrateRemoteState() {
  if (remoteHydrationPromise) {
    return remoteHydrationPromise;
  }

  remoteHydrationPromise = (async () => {
    const user = await fetchSessionUser();
    if (!user) {
      return loadState();
    }

    try {
      const response = await fetch("/api/app-state", { credentials: "same-origin" });
      if (!response.ok) {
        return loadState();
      }

      const payload = await response.json();
      if (payload?.state) {
        const normalized = normalizeState(payload.state);
        localStorage.setItem(getScopedStorageKey(), JSON.stringify(normalized));
        return normalized;
      }

      const localState = loadRawState();
      const normalizedLocal = normalizeState(localState);
      await syncRemoteStateNow(normalizedLocal);
      return normalizedLocal;
    } catch {
      return loadState();
    }
  })();

  return remoteHydrationPromise;
}

async function bootstrapState() {
  const hydrated = await hydrateRemoteState();
  return normalizeState(hydrated);
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return `${Math.round(value).toLocaleString("zh-CN")} 元`;
}

function formatDate(dateString) {
  if (!dateString) {
    return "未设置";
  }
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric"
  }).format(date);
}

function daysBetween(from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) ? diff : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (normalized.length !== 6) {
    return "217, 117, 79";
  }
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return "217, 117, 79";
  }
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r}, ${g}, ${b}`;
}

function createAllocationId(incomeId, allocationIndex, item) {
  const label = item.targetId || item.targetName || item.label || item.type || "item";
  return `${incomeId}-allocation-${allocationIndex}-${label}`;
}

function normalizeIncome(income, incomeIndex) {
  const incomeId = income?.id || `income-${incomeIndex + 1}`;
  return {
    ...income,
    id: incomeId,
    allocations: Array.isArray(income?.allocations)
      ? income.allocations.map((item, allocationIndex) => ({
          ...item,
          itemId: item?.itemId || createAllocationId(incomeId, allocationIndex, item)
        }))
      : []
  };
}

function getRandomQuote(exclusions = []) {
  if (motivationalQuotes.length <= 1) {
    return motivationalQuotes[0];
  }

  const exclusionList = Array.isArray(exclusions)
    ? exclusions.filter(Boolean)
    : [exclusions].filter(Boolean);
  const excludedTexts = new Set(exclusionList);
  const pool = excludedTexts.size
    ? motivationalQuotes.filter((item) => !excludedTexts.has(item.text))
    : motivationalQuotes;

  const safePool = pool.length ? pool : motivationalQuotes;
  return safePool[Math.floor(Math.random() * safePool.length)];
}

function getMotivationalQuotes() {
  return motivationalQuotes.map((quote) => ({ ...quote }));
}

function getGoalIconLibrary() {
  return goalIconLibrary.map((icon) => ({ ...icon }));
}

function getPinnedGoalCount(state) {
  return state.goals.filter((goal) => goal.isPinned && goal.status === "active").length;
}

function togglePinnedGoal(state, goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal || goal.status !== "active") {
    return { ok: false, reason: "missing" };
  }
  if (!goal.isPinned && getPinnedGoalCount(state) >= MAX_PINNED_GOALS) {
    return { ok: false, reason: "limit" };
  }
  goal.isPinned = !goal.isPinned;
  saveState(state);
  return { ok: true };
}

function calculateGoalSaved(state, goal) {
  const allocated = state.incomes.reduce((sum, income) => {
    return sum + income.allocations.reduce((innerSum, item) => {
      if (item.type === "goal" && item.targetId === goal.id) {
        return innerSum + item.amount;
      }
      return innerSum;
    }, 0);
  }, 0);
  return (goal.baseSaved || 0) + allocated;
}

function buildGoalView(state, goal) {
  const saved = calculateGoalSaved(state, goal);
  const safeTarget = goal.target > 0 ? goal.target : 1;
  const progress = Math.min(saved / safeTarget, 1);
  const remaining = Math.max(goal.target - saved, 0);
  const daysLeft = goal.deadline ? daysBetween(getToday(), goal.deadline) : null;

  let tip = remaining === 0
    ? "已经攒够啦，可以开始计划出发或购买了。"
    : `还差 ${formatCurrency(remaining)}，继续靠近这个目标。`;
  if (remaining > 0 && daysLeft !== null && daysLeft > 0) {
    const dailyNeed = Math.ceil(remaining / daysLeft);
    tip = `${tip} 如果想在 ${formatDate(goal.deadline)} 前完成，平均每天存 ${formatCurrency(dailyNeed)}。`;
  }

  return {
    ...goal,
    saved,
    progress,
    remaining,
    tip,
    daysLeft
  };
}

function getGoalViews(state, options = {}) {
  const { includeCompleted = true } = options;
  const filteredGoals = state.goals.filter((goal) => includeCompleted || goal.status === "active");
  return filteredGoals
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    })
    .map((goal) => buildGoalView(state, goal));
}

function buildMetrics(state, goalViews) {
  const totalIncome = state.incomes.reduce((sum, income) => sum + income.amount, 0);
  const activeGoals = goalViews.filter((goal) => goal.status === "active");
  const totalGoalSaved = activeGoals.reduce((sum, goal) => sum + goal.saved, 0);
  const totalGoalTarget = activeGoals.reduce((sum, goal) => sum + goal.target, 0);
  const completionRate = totalGoalTarget ? Math.round((totalGoalSaved / totalGoalTarget) * 100) : 0;

  return [
    {
      label: "累计收入",
      value: formatCurrency(totalIncome),
      detail: "把所有进账先记下来，再决定去向。"
    },
    {
      label: "进入目标的钱",
      value: formatCurrency(totalGoalSaved),
      detail: "你已经把这些钱真正推到了愿望上。"
    },
    {
      label: "目标总数",
      value: `${state.goals.filter((goal) => goal.status === "active").length} 个`,
      detail: "这里只计算当前仍在推进中的目标。"
    },
    {
      label: "目标完成率",
      value: `${completionRate}%`,
      detail: "当前所有活跃目标的整体推进情况。"
    }
  ];
}

function getActiveGoals(state) {
  return getGoalViews(state, { includeCompleted: false }).filter((goal) => goal.status === "active");
}

function getCompletedGoals(state) {
  return getGoalViews(state, { includeCompleted: true }).filter((goal) => goal.status === "completed");
}

function getGoalById(state, goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) {
    return null;
  }
  return buildGoalView(state, goal);
}

function addGoal(state, draft) {
  state.goals.unshift({
    id: `goal-${Date.now()}`,
    name: draft.name,
    target: draft.target,
    baseSaved: draft.baseSaved,
    note: draft.note,
    icon: draft.icon,
    image: draft.image,
    hasDeadline: draft.hasDeadline,
    deadline: draft.hasDeadline ? draft.deadline : "",
    color: draft.color,
    isPinned: getPinnedGoalCount(state) < MAX_PINNED_GOALS,
    status: "active",
    sortOrder: -1,
    createdAt: new Date().toISOString().slice(0, 10)
  });
  normalizeSortOrder(state);
  saveState(state);
}

function updateGoal(state, goalId, draft) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) {
    return false;
  }
  goal.name = draft.name;
  goal.target = draft.target;
  goal.baseSaved = draft.baseSaved;
  goal.note = draft.note;
  goal.icon = draft.icon;
  goal.image = draft.image;
  goal.hasDeadline = draft.hasDeadline;
  goal.deadline = draft.hasDeadline ? draft.deadline : "";
  goal.color = draft.color;
  syncGoalNameAcrossAllocations(state, goal.id, goal.name);
  saveState(state);
  return true;
}

function completeGoal(state, goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) {
    return { ok: false };
  }
  goal.status = "completed";
  goal.isPinned = false;
  state.incomes.forEach((income) => {
    income.allocations = income.allocations.map((item, allocationIndex) => {
      if (item.type === "goal" && item.targetId === goalId) {
        return {
          type: "completed-goal",
          label: `已完成目标 · ${item.targetName || goal.name}`,
          targetName: item.targetName || goal.name,
          amount: item.amount,
          itemId: item.itemId || createAllocationId(income.id, allocationIndex, item)
        };
      }
      return item;
    });
  });
  saveState(state);
  return { ok: true };
}

function reopenGoal(state, goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) {
    return { ok: false };
  }
  goal.status = "active";
  saveState(state);
  return { ok: true };
}

function deleteGoal(state, goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) {
    return { ok: false };
  }
  state.goals = state.goals.filter((item) => item.id !== goalId);
  state.incomes.forEach((income) => {
    income.allocations = income.allocations.map((item, allocationIndex) => {
      if (item.type === "goal" && item.targetId === goalId) {
        return {
          type: "archived-goal",
          label: `已删除目标 · ${item.targetName || goal.name}`,
          targetName: item.targetName || goal.name,
          amount: item.amount,
          itemId: item.itemId || createAllocationId(income.id, allocationIndex, item)
        };
      }
      return item;
    });
  });
  saveState(state);
  return { ok: true, goal };
}

function reorderGoal(state, goalId, direction) {
  const activeGoals = state.goals.filter((goal) => goal.status === "active").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const index = activeGoals.findIndex((goal) => goal.id === goalId);
  if (index === -1) {
    return { ok: false };
  }
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= activeGoals.length) {
    return { ok: false };
  }
  const current = activeGoals[index];
  const swap = activeGoals[swapIndex];
  const currentOrder = current.sortOrder ?? index;
  current.sortOrder = swap.sortOrder ?? swapIndex;
  swap.sortOrder = currentOrder;
  normalizeSortOrder(state);
  saveState(state);
  return { ok: true };
}

function moveGoalToIndex(state, goalId, targetIndex) {
  const activeGoals = state.goals.filter((goal) => goal.status === "active").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const fromIndex = activeGoals.findIndex((goal) => goal.id === goalId);
  if (fromIndex === -1 || targetIndex < 0 || targetIndex >= activeGoals.length) {
    return { ok: false };
  }
  const [moved] = activeGoals.splice(fromIndex, 1);
  activeGoals.splice(targetIndex, 0, moved);
  activeGoals.forEach((goal, index) => {
    const original = state.goals.find((item) => item.id === goal.id);
    if (original) {
      original.sortOrder = index;
    }
  });
  saveState(state);
  return { ok: true };
}

function syncGoalNameAcrossAllocations(state, goalId, newName) {
  state.incomes.forEach((income) => {
    income.allocations.forEach((item) => {
      if (item.targetId === goalId) {
        item.targetName = newName;
        if (item.type === "archived-goal") {
          item.label = `已删除目标 · ${newName}`;
        }
        if (item.type === "completed-goal") {
          item.label = `已完成目标 · ${newName}`;
        }
      }
    });
  });
}

function addIncomeRecord(state, payload) {
  const incomeId = `income-${Date.now()}`;
  state.incomes.unshift({
    id: incomeId,
    date: payload.date,
    source: payload.source,
    amount: payload.amount,
    note: payload.note,
    allocations: payload.allocations.map((item, allocationIndex) => ({
      ...item,
      itemId: item.itemId || createAllocationId(incomeId, allocationIndex, item)
    }))
  });
  saveState(state);
}

function getVisibleAllocations(state, allocations, income = null) {
  return allocations.filter((item, index) => {
    const key = getAllocationVisibilityKey(item, {
      incomeId: income?.id,
      allocationIndex: index
    });
    const archivedLike = item.type === "archived-goal" || item.type === "completed-goal";
    if (archivedLike && !state.ui.showArchivedAllocations) {
      return false;
    }
    return state.ui.allocationItemVisibility[key] !== false;
  });
}

function getAllocationSummary(state) {
  const totals = new Map();
  state.incomes.forEach((income) => {
    getVisibleAllocations(state, income.allocations, income).forEach((item) => {
      const label = getAllocationLabel(item, true);
      const current = totals.get(label) || { label, amount: 0, color: pickColor(state, item) };
      current.amount += item.amount;
      totals.set(label, current);
    });
  });
  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
}

function getVisibleIncomeRecords(state) {
  return state.incomes.map((income) => ({
    ...income,
    allocations: getVisibleAllocations(state, income.allocations, income)
  })).filter((income) => income.allocations.length > 0);
}

function setArchivedVisibility(state, visible) {
  state.ui.showArchivedAllocations = visible;
  saveState(state);
}

function countArchivedAllocations(state) {
  return state.incomes.reduce((sum, income) => {
    return sum + income.allocations.filter((item) => item.type === "archived-goal" || item.type === "completed-goal").length;
  }, 0);
}

function clearArchivedAllocations(state) {
  state.incomes = state.incomes.map((income) => ({
    ...income,
    allocations: income.allocations.filter((item) => item.type !== "archived-goal" && item.type !== "completed-goal")
  })).filter((income) => income.allocations.length > 0);
  saveState(state);
}

function getAllocationVisibilityKey(item, context = {}) {
  if (item.type === "goal") {
    return `goal:${item.targetId}:${item.targetName}`;
  }
  if (item.type === "archived-goal" || item.type === "completed-goal") {
    if (item.itemId) {
      return `${item.type}:${item.itemId}`;
    }
    if (context.incomeId && Number.isInteger(context.allocationIndex)) {
      return `${item.type}:${context.incomeId}:${context.allocationIndex}:${item.label}`;
    }
    return `${item.type}:${item.label}`;
  }
  return `category:${item.label}`;
}

function setAllocationVisibility(state, item, visible, context = {}) {
  state.ui.allocationItemVisibility[getAllocationVisibilityKey(item, context)] = visible;
  saveState(state);
}

function setAllocationVisibilityByKey(state, key, visible) {
  state.ui.allocationItemVisibility[key] = visible;
  saveState(state);
}

function getArchivedAllocationEntries(state) {
  const entries = [];
  state.incomes.forEach((income) => {
    income.allocations.forEach((item, allocationIndex) => {
      if (item.type !== "archived-goal" && item.type !== "completed-goal") {
        return;
      }
      const key = getAllocationVisibilityKey(item, { incomeId: income.id, allocationIndex });
      entries.push({
        key,
        itemId: item.itemId,
        incomeId: income.id,
        incomeSource: income.source,
        incomeDate: income.date,
        allocationIndex,
        visible: state.ui.allocationItemVisibility[key] !== false,
        item: {
          ...item
        }
      });
    });
  });
  return entries;
}

function updateTheme(state, theme) {
  state.ui.theme = {
    ...state.ui.theme,
    ...theme
  };
  saveState(state);
}

function updateWishShelfRows(state, rows) {
  state.ui.wishShelfRows = clampWishShelfRows(rows);
  saveState(state);
}

function deleteArchivedAllocationEntry(state, itemId) {
  let changed = false;
  state.incomes = state.incomes
    .map((income) => {
      const nextAllocations = income.allocations.filter((item) => {
        if (item.itemId === itemId && (item.type === "archived-goal" || item.type === "completed-goal")) {
          const key = getAllocationVisibilityKey(item);
          delete state.ui.allocationItemVisibility[key];
          changed = true;
          return false;
        }
        return true;
      });
      return {
        ...income,
        allocations: nextAllocations
      };
    })
    .filter((income) => income.allocations.length > 0);

  if (changed) {
    saveState(state);
  }
  return { ok: changed };
}

function getAllocationLabel(item, compact) {
  if (item.type === "goal") {
    return compact ? item.targetName : `目标 · ${item.targetName}`;
  }
  return item.label;
}

function pickColor(state, item) {
  if (item.type === "goal") {
    const goal = state.goals.find((goalItem) => goalItem.id === item.targetId);
    return goal?.color || palette[0];
  }
  if (item.type === "archived-goal") {
    return archivedGoalColor;
  }
  if (item.type === "completed-goal") {
    return completedGoalColor;
  }
  return categoryColors[item.label] || palette[item.label.length % palette.length];
}

function normalizeSortOrder(state) {
  state.goals
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .forEach((goal, index) => {
      goal.sortOrder = index;
    });
}

window.BudgetCore = {
  STORAGE_KEY,
  MAX_PINNED_GOALS,
  palette,
  bootstrapState,
  hydrateRemoteState,
  syncRemoteStateNow,
  loadState,
  saveState,
  applyTheme,
  resetState,
  getToday,
  formatCurrency,
  formatDate,
  daysBetween,
  escapeHtml,
  getRandomQuote,
  getMotivationalQuotes,
  getGoalIconLibrary,
  getPinnedGoalCount,
  togglePinnedGoal,
  getGoalViews,
  getActiveGoals,
  getCompletedGoals,
  getGoalById,
  buildMetrics,
  addGoal,
  updateGoal,
  completeGoal,
  reopenGoal,
  deleteGoal,
  reorderGoal,
  moveGoalToIndex,
  addIncomeRecord,
  getAllocationSummary,
  getVisibleIncomeRecords,
  setArchivedVisibility,
  countArchivedAllocations,
  clearArchivedAllocations
  ,
  updateTheme,
  updateWishShelfRows,
  setAllocationVisibility,
  setAllocationVisibilityByKey,
  getAllocationVisibilityKey,
  getArchivedAllocationEntries,
  deleteArchivedAllocationEntry
};
