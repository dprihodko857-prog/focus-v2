import { createFocusStorage, DIARY_PIN_KEY, LEGACY_BIRTHDAYS_KEY, LEGACY_DIARY_KEY, LEGACY_NOTES_KEY, LEGACY_SCHEDULES_KEY, LEGACY_TASKS_KEY, parseScheduleList, REMINDERS_KEY } from "./storage.js";
import { createFocusAuthClient } from "./auth.js";
import { createFocusSyncClient } from "./sync.js";
import { createFocusNotifications, createLocalReminder } from "./notifications.js";

const quotes = [
  "Делай сегодня то, что приблизит тебя к завтра.",
  "Фокус начинается там, где день становится чуть тише.",
  "Не всё нужно успеть. Важно не потерять главное.",
  "Спокойный шаг всё равно двигает вперёд.",
  "Пусть день будет не идеальным, а настоящим."
];

const labels = [
  ["Напоминание", "#5678F5"],
  ["День рождения", "#D96B5F"],
  ["Учёба", "#5F9073"],
  ["Работа", "#D89A3D"],
  ["Творчество", "#8C7AE6"],
  ["Спорт", "#47A7B8"]
];

const summaryItems = [
  { time: "10:00", title: "Урок математики", subtitle: "Школа №12, 8 В", color: "#D89A3D" },
  { time: "12:30", title: "Встреча с родителями", subtitle: "Онлайн", color: "#C96A87" },
  { time: "16:00", title: "Тренировка по плаванию", subtitle: "Бассейн «Дельфин»", color: "#47A7B8" },
  { time: "Весь день", title: "День рождения: мама", subtitle: "Позвонить вечером", color: "#D96B5F" }
];

const tasks = [
  { title: "Подготовить презентацию", label: "Работа", done: false },
  { title: "Позвонить Сергею", label: "Личное", done: true },
  { title: "Купить продукты", label: "Дом", done: false },
  { title: "Разобрать фотографии", label: "Творчество", done: false }
];

const scheduleStorage = createFocusStorage();
const focusAuth = createFocusAuthClient();
const scheduleSync = createFocusSyncClient();
const focusNotifications = createFocusNotifications();
let savedSchedules = [];
let savedTasks = [];
let savedNotes = [];
let savedBirthdays = [];
let savedDiaryEntries = [];
let localReminders = [];
let reminderPushDiagnostics = null;
let deviceCheckPushTestState = "";
let reminderFilter = "active";
let reminderEditId = null;
let scheduledReminderIds = new Set();
let noteEditId = null;
let birthdayEditId = null;
let diaryEditId = null;
let diaryDraftDateKey = "";
let diaryPinSettings = null;
let diaryPinSettingsLoaded = false;
let diaryUnlocked = false;
let diaryPendingModal = "";
let diaryPinMode = "setup";
let authSession = null;
let syncAccountProfile = null;
let scheduleEditDraft = null;
let scheduleFilter = "all";

const syncCollectionItems = [
  { key: "schedules", title: "Расписания", getCount: () => savedSchedules.length },
  { key: "reminders", title: "Напоминания", getCount: () => localReminders.length },
  { key: "tasks", title: "Дела на сегодня", getCount: () => savedTasks.length },
  { key: "notes", title: "Заметки", getCount: () => savedNotes.length },
  { key: "birthdays", title: "Дни рождения", getCount: () => savedBirthdays.length },
  { key: "diary", title: "Дневник", getCount: () => savedDiaryEntries.length },
];

const syncCollectionStates = Object.fromEntries(syncCollectionItems.map(item => [
  item.key,
  { status: "idle", updatedAt: "", revision: 0 },
]));

const paidFeatureItems = [
  {
    key: "voiceTranscription",
    title: "Голосовой ввод",
    shortTitle: "Диктовка",
    description: "Надиктовывайте расписания, дела, заметки и записи дневника вместо ручного ввода.",
    priceLabel: "Focus Plus · 199 ₽/мес",
    subscriptionUrl: "/subscription.html",
  },
];

let accountEntitlementsState = {
  status: "idle",
  accountId: "",
  checkedAt: "",
  entitlements: createDefaultAccountEntitlements(),
  usage: createDefaultAccountFeatureUsage(),
};
let accountEntitlementEventsState = {
  status: "idle",
  accountId: "",
  checkedAt: "",
  events: [],
};
let accountTranscriptionStatusState = {
  status: "idle",
  accountId: "",
  checkedAt: "",
  providerConfigured: false,
  provider: null,
  providerModel: null,
  monthlyLimit: 0,
  maxDurationMs: 0,
};
let accountTranscriptionEventsState = {
  status: "idle",
  accountId: "",
  checkedAt: "",
  events: [],
};
let paidFeatureCheckoutState = {
  status: "idle",
  featureKey: "",
};
const VOICE_RECORDING_MAX_MS = 15000;
let activeVoiceRecognition = null;
let activeVoiceButton = null;
let activeVoiceRecorder = null;
let activeVoiceRecorderButton = null;
let activeVoiceRecorderChunks = [];
let activeVoiceRecorderTimer = null;
let activeVoiceRecorderStartedAt = 0;
let activeVoiceTranscriptionButton = null;

function createDefaultAccountEntitlements() {
  return {
    voiceTranscription: {
      enabled: false,
      source: "none",
      updatedAt: null,
      activatedAt: null,
      expiresAt: null,
      paymentId: null,
    },
  };
}

function createDefaultAccountFeatureUsage() {
  return {
    voiceTranscription: null,
  };
}

function createEmptyAccountEntitlementEventsState(status = "idle") {
  return {
    status,
    accountId: scheduleSync.peekAccountId(),
    checkedAt: "",
    events: [],
  };
}

function createEmptyAccountTranscriptionEventsState(status = "idle") {
  return {
    status,
    accountId: scheduleSync.peekAccountId(),
    checkedAt: "",
    events: [],
  };
}

function createEmptyAccountTranscriptionStatusState(status = "idle") {
  return {
    status,
    accountId: scheduleSync.peekAccountId(),
    checkedAt: "",
    providerConfigured: false,
    provider: null,
    providerModel: null,
    monthlyLimit: 0,
    maxDurationMs: 0,
  };
}

const installShortcutTargets = new Set([
  "reminder",
  "schedules",
  "diary"
]);

function getInitialLaunchTarget() {
  try {
    const target = new URLSearchParams(window.location.search).get("open") || "";
    return installShortcutTargets.has(target) ? target : "";
  } catch {
    return "";
  }
}

function clearInitialLaunchTarget() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("open")) return;
    url.searchParams.delete("open");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // The launch shortcut can be retried on the next app start if history is unavailable.
  }
}

function readLocalStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readLegacyScheduleList(key) {
  return parseScheduleList(readLocalStorageItem(key));
}

function lockViewportScale() {
  const preventScale = event => event.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach(type => {
    document.addEventListener(type, preventScale, { passive: false });
  });
  document.addEventListener("touchmove", event => {
    if (event.touches?.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });
}

const COMPACT_WINDOW_WIDTH = 1720;
const RESTORED_WINDOW_TOLERANCE = 24;

function syncCompactWindowMode() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;

  const layoutWidth = Math.min(
    window.innerWidth || Number.POSITIVE_INFINITY,
    window.visualViewport?.width || Number.POSITIVE_INFINITY
  );
  const screenWidth = window.screen?.availWidth || 0;
  const outerWidth = window.outerWidth || layoutWidth;
  const isRestoredDesktopWindow = screenWidth >= COMPACT_WINDOW_WIDTH
    && outerWidth < screenWidth - RESTORED_WINDOW_TOLERANCE;
  const isCompactWindow = Number.isFinite(layoutWidth)
    && (layoutWidth <= COMPACT_WINDOW_WIDTH || isRestoredDesktopWindow);

  shell.classList.toggle("app-shell--compact-window", isCompactWindow);
  document.documentElement.dataset.windowMode = isCompactWindow ? "compact" : "desktop";
}

function bindCompactWindowMode() {
  syncCompactWindowMode();
  window.addEventListener("resize", syncCompactWindowMode, { passive: true });
  window.visualViewport?.addEventListener?.("resize", syncCompactWindowMode, { passive: true });
}

const scheduleTypes = {
  participant: [
    { id: "sport", title: "Спорт", description: "Тренировки, секции, зал или бассейн" },
    { id: "school", title: "Уроки", description: "Школа, техникум, институт или недельная сетка" },
    { id: "classes", title: "Занятия", description: "Курсы, кружки, репетиторы и дополнительные занятия" },
    { id: "arts", title: "Школа искусств", description: "Музыка, рисунок, танцы, театр и творческие занятия" },
    { id: "custom", title: "Своё", description: "Любой повторяющийся ритм или личное расписание" }
  ],
  mentor: [
    { id: "mentor-school", title: "Уроки", description: "Классы, группы, предметы и учебные дни" },
    { id: "tutoring", title: "Репетиторство", description: "Индивидуальные или групповые занятия" },
    { id: "training", title: "Тренировки", description: "Секции, команды и персональные тренировки" },
    { id: "mentor-arts", title: "Школа искусств", description: "Музыка, рисунок, театр, танцы и творческие группы" },
    { id: "mentor-custom", title: "Своё", description: "Любые занятия, встречи или консультации" }
  ]
};

const scheduleDetails = {
  sport: {
    title: "Что за тренировка?",
    fields: [
      { label: "Вид спорта / название", placeholder: "Например: футбол, плавание, зал" }
    ],
    chips: ["Футбол", "Плавание", "Бокс", "Йога", "Зал", "Бег"]
  },
  school: {
    title: "Основная информация",
    fields: [
      { label: "Учебное заведение", placeholder: "Например: школа №5, техникум Волкова" },
      { label: "Класс / курс / группа", placeholder: "Например: 5 В, 2 курс, группа 12" },
      { label: "Название расписания", placeholder: "Например: №5, 5 В класс" }
    ]
  },
  classes: {
    title: "Что за занятие?",
    fields: [
      { label: "Название занятия", placeholder: "Например: английский, музыка, математика" },
      { label: "Тип занятия", placeholder: "Курс, репетитор, кружок, секция" }
    ],
    chips: ["Курс", "Репетитор", "Кружок", "Секция", "Другое"]
  },
  arts: {
    title: "Какое направление школы искусств?",
    fields: [
      { label: "Своё направление", placeholder: "Если нужного направления нет в списке" }
    ],
    chips: ["Музыка", "Художественное", "Хореография", "Театр", "ДПИ"]
  },
  custom: {
    title: "Что повторяется?",
    fields: [
      { label: "Название расписания", placeholder: "Например: работа, прогулка, таблетки" }
    ]
  },
  "mentor-school": {
    title: "Где и что вы ведёте?",
    fields: [
      { label: "Учебное заведение", placeholder: "Например: №5, техникум Волкова" },
      { label: "Предмет", placeholder: "Например: математика" },
      { label: "Кабинет", placeholder: "Необязательно" },
      { label: "Название расписания", placeholder: "Например: Математика, №5" }
    ]
  },
  tutoring: {
    title: "Что преподаёте?",
    fields: [
      { label: "Предмет / направление", placeholder: "Например: математика, английский, ЕГЭ" },
      { label: "Формат", placeholder: "Индивидуально, группа или смешанный формат" }
    ],
    chips: ["Индивидуально", "Группа", "Смешанный формат"]
  },
  training: {
    title: "Вид тренировок",
    fields: [
      { label: "Спорт / направление", placeholder: "Например: футбол, бокс, плавание" },
      { label: "Формат", placeholder: "Персональные, групповые, секция" }
    ],
    chips: ["Персональные", "Групповые", "Секция", "Смешанный формат"]
  },
  "mentor-arts": {
    title: "Какое направление вы ведёте?",
    fields: [
      { label: "Своё направление", placeholder: "Если нужного направления нет в списке" }
    ],
    chips: ["Музыка", "Художественное", "Хореография", "Театр", "ДПИ"]
  },
  "mentor-custom": {
    title: "Что вы ведёте?",
    fields: [
      { label: "Название расписания", placeholder: "Например: консультации, встречи, смены" },
      { label: "Описание", placeholder: "Необязательно" }
    ]
  }
};

const scheduleFollowups = {
  sport: {
    title: "В какие дни проходят занятия?",
    kind: "days",
    note: "Выберите день и добавьте время занятия. Позже можно будет добавить несколько занятий в один день."
  },
  school: {
    title: "Когда действует расписание?",
    kind: "period",
    note: "Период поможет отделять учебный год, семестр или другой отрезок расписания."
  },
  classes: {
    title: "В какие дни проходит занятие?",
    kind: "days",
    note: "Добавьте дни и время занятий. Если время плавающее, его можно уточнить позже."
  },
  arts: {
    title: "Какое направление посещаете?",
    kind: "chips",
    chips: ["Музыка", "Художественное", "Хореография", "Театр", "ДПИ"],
    note: "Сначала выберем общее направление, затем покажем только подходящие предметы."
  },
  custom: {
    title: "Когда повторяется расписание?",
    kind: "days",
    note: "Выберите дни и добавьте время. Для расписания без времени этот шаг можно будет пропустить."
  },
  "mentor-school": {
    title: "Когда действует расписание?",
    kind: "period",
    note: "После периода перейдём к длительности уроков, переменам и распределению по дням."
  },
  tutoring: {
    title: "Кого добавим в расписание?",
    kind: "people",
    note: "Здесь будет список учеников или групп, с возможностью позже учитывать оплату."
  },
  training: {
    title: "Кого тренируете?",
    kind: "people",
    note: "Добавьте подопечных или группы, а затем соберём расписание тренировок по дням."
  },
  "mentor-arts": {
    title: "Какое направление вы ведёте?",
    kind: "chips",
    chips: ["Музыка", "Художественное", "Хореография", "Театр", "ДПИ"],
    note: "После выбора направления покажем релевантные дисциплины и перейдём к ученикам или группам."
  },
  "mentor-custom": {
    title: "Для кого это расписание?",
    kind: "people",
    note: "Можно привязать расписание к человеку, группе или оставить без привязки."
  }
};

const schedulePlaceSteps = {
  sport: {
    title: "Где проходят занятия?",
    fields: [
      { label: "Место", placeholder: "Например: стадион, зал, бассейн, адрес" },
      { label: "Тренер / секция", placeholder: "Необязательно" }
    ],
    note: "Место можно оставить пустым и добавить позже. Главное — чтобы расписание уже было собрано по дням."
  },
  classes: {
    title: "Где проходит занятие?",
    fields: [
      { label: "Место / ссылка", placeholder: "Адрес, кабинет или ссылка на онлайн-занятие" },
      { label: "Преподаватель / наставник", placeholder: "Необязательно" }
    ],
    note: "Если занятие проходит онлайн, сюда можно добавить ссылку. Если место пока неизвестно, его можно уточнить позже."
  },
  custom: {
    title: "Где это происходит?",
    fields: [
      { label: "Место / ссылка", placeholder: "Дом, офис, адрес или ссылка" },
      { label: "Дополнение", placeholder: "Необязательно" }
    ],
    note: "Это поле можно оставить пустым, если расписание не привязано к месту."
  }
};

const scheduleLessonTimeSteps = {
  school: {
    title: "Время учебного дня",
    fields: [
      { label: "Первый урок начинается", placeholder: "08:30", value: "08:30", inputmode: "numeric" },
      { label: "Длительность урока, минут", placeholder: "45", value: "45", inputmode: "numeric" },
      { label: "Обычная перемена, минут", placeholder: "10", value: "10", inputmode: "numeric" }
    ],
    note: "Эти значения помогут автоматически рассчитывать время уроков в недельной сетке."
  }
};

const scheduleLongBreakSteps = {
  school: {
    title: "Большая перемена",
    options: ["Нет", "Да"],
    fields: [
      { label: "После какого урока", placeholder: "3", value: "3", inputmode: "numeric" },
      { label: "Длительность, минут", placeholder: "20", value: "20", inputmode: "numeric" }
    ],
    note: "Если большая перемена есть, эти значения будут учитываться при расчёте времени уроков."
  }
};

const scheduleSubjectSteps = {
  school: {
    title: "Предметы",
    subjects: [
      "Русский язык",
      "Литература",
      "Математика",
      "Алгебра",
      "Иностранный язык",
      "История",
      "Физика",
      "Химия",
      "Биология",
      "География",
      "Информатика",
      "Физкультура",
      "Основы безопасности и защиты Родины"
    ],
    note: "Выберите предметы, которые есть в расписании. На следующем шаге из них будет собираться недельная сетка."
  }
};

const scheduleTeacherSteps = {
  school: {
    title: "Преподаватели",
    note: "Если преподавателя пока не знаете, поле можно оставить пустым и вернуться позже."
  }
};

const scheduleDayLessonSteps = {
  school: {
    days: [
      { key: "monday", title: "Понедельник", short: "Пн" },
      { key: "tuesday", title: "Вторник", short: "Вт" },
      { key: "wednesday", title: "Среда", short: "Ср" },
      { key: "thursday", title: "Четверг", short: "Чт" },
      { key: "friday", title: "Пятница", short: "Пт" },
      { key: "saturday", title: "Суббота", short: "Сб" },
      { key: "sunday", title: "Воскресенье", short: "Вс" }
    ],
    note: "Добавьте уроки в том порядке, в котором они идут в этот день. Время будет рассчитываться по настройкам учебного дня."
  }
};

let schoolDayLessonIndex = 0;
let schoolDayLessonsByDay = {};

function resetSchoolDayLessons() {
  schoolDayLessonIndex = 0;
  schoolDayLessonsByDay = {};
}

function hydrateSchoolDayLessons(schedule) {
  resetSchoolDayLessons();
  if (!schedule?.schoolLessonRows?.length) return;

  const dayKeyByTitle = Object.fromEntries(scheduleDayLessonSteps.school.days.map(day => [day.title, day.key]));
  schedule.schoolLessonRows.forEach(day => {
    const key = dayKeyByTitle[day.day];
    if (!key) return;
    schoolDayLessonsByDay[key] = day.lessons.map(lesson => lesson.subject).filter(Boolean);
  });
}

function getDraftSchoolSubjects(typeId) {
  if (scheduleEditDraft?.type !== typeId || !scheduleEditDraft.schoolLessonRows?.length) return [];
  return [...new Set(scheduleEditDraft.schoolLessonRows
    .flatMap(day => day.lessons || [])
    .map(lesson => lesson.subject)
    .filter(Boolean))];
}

function getDraftSchoolTeachers(typeId) {
  if (scheduleEditDraft?.type !== typeId || !scheduleEditDraft.schoolLessonRows?.length) return {};
  return scheduleEditDraft.schoolLessonRows
    .flatMap(day => day.lessons || [])
    .reduce((teachers, lesson) => {
      if (lesson.subject && lesson.teacher && !teachers[lesson.subject]) {
        teachers[lesson.subject] = lesson.teacher;
      }
      return teachers;
    }, {});
}

const scheduleReminderSteps = {
  school: {
    title: "Когда напомнить об уроках?",
    options: [
      "Без напоминания",
      "За 5 минут",
      "За 10 минут",
      "За 15 минут",
      "За 30 минут"
    ],
    note: "Напоминание будет применяться к урокам этого расписания. Его можно будет изменить позже."
  },
  sport: {
    title: "Когда напомнить?",
    options: [
      "Без напоминания",
      "За 5 минут",
      "За 15 минут",
      "За 30 минут",
      "За 1 час"
    ],
    note: "Напоминание можно будет изменить позже в карточке расписания."
  },
  classes: {
    title: "Когда напомнить?",
    options: [
      "Без напоминания",
      "За 5 минут",
      "За 15 минут",
      "За 30 минут",
      "За 1 час"
    ],
    note: "Напоминание можно будет изменить позже в карточке занятия."
  },
  custom: {
    title: "Когда напомнить?",
    options: [
      "Без напоминания",
      "За 5 минут",
      "За 15 минут",
      "За 30 минут",
      "За 1 час"
    ],
    note: "Напоминание можно будет изменить позже в карточке расписания."
  }
};

const scheduleColorSteps = {
  school: {
    title: "Цвет и детали",
    colors: ["#5678F5", "#5F9073", "#D89A3D", "#8C7AE6", "#47A7B8", "#C96A87", "#C56A4B"],
    defaultColor: "#5678F5",
    notePlaceholder: "Например: смены кабинетов, учебники или особенности расписания",
    statusLabel: "Активно"
  },
  sport: {
    title: "Цвет и детали",
    colors: ["#47A7B8", "#5678F5", "#D89A3D", "#C56A4B", "#8C7AE6", "#5F9073", "#C96A87"],
    defaultColor: "#47A7B8",
    notePlaceholder: "Например: форма, абонемент, что взять с собой",
    statusLabel: "Активно"
  },
  classes: {
    title: "Цвет и детали",
    colors: ["#8C7AE6", "#5678F5", "#D89A3D", "#5F9073", "#C96A87", "#47A7B8", "#C56A4B"],
    defaultColor: "#8C7AE6",
    notePlaceholder: "Например: учебник, тетрадь, ссылка на материалы",
    statusLabel: "Активно"
  },
  custom: {
    title: "Цвет и детали",
    colors: ["#D89A3D", "#5678F5", "#5F9073", "#C96A87", "#8C7AE6", "#47A7B8", "#C56A4B"],
    defaultColor: "#D89A3D",
    notePlaceholder: "Например: что подготовить или не забыть",
    statusLabel: "Активно"
  }
};

const markerMap = {
  2: ["#8C7AE6", "#D89A3D"],
  5: ["#5678F5"],
  9: ["#5F9073", "#8C7AE6"],
  12: ["#D96B5F", "#D89A3D"],
  16: ["#47A7B8"],
  19: ["#D89A3D", "#C96A87"],
  23: ["#5678F5", "#D89A3D"],
  26: ["#D96B5F"],
  28: ["#8C7AE6", "#47A7B8"]
};

const monthImageSlugs = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december"
];

let quoteIndex = 0;
let currentCalendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDayCardDate = new Date();

function formatDate() {
  const now = new Date();
  const day = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(now);

  document.querySelector("#currentDay").textContent = day[0].toUpperCase() + day.slice(1);
  document.querySelector("#currentDate").textContent = date;
}

function renderQuote() {
  document.querySelector("#quoteText").textContent = quotes[quoteIndex];
}

function renderCalendar() {
  const grid = document.querySelector("#calendarGrid");
  if (!grid) return;

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const title = document.querySelector(".calendar-card h1");
  if (title) {
    title.textContent = formatMonthTitle(currentCalendarDate);
  }
  applySeasonalBackground(currentCalendarDate);

  const cells = getCalendarCells(year, month);
  const today = new Date();

  grid.innerHTML = cells.map((cell, index) => {
    const weekday = index % 7;
    const markers = !cell.muted ? getCalendarMarkers(new Date(cell.year, cell.month, cell.n)) : [];
    const isCurrent = !cell.muted
      && cell.n === today.getDate()
      && cell.month === today.getMonth()
      && cell.year === today.getFullYear();
    const classes = [
      "day-cell",
      cell.muted ? "day-cell--muted" : "",
      weekday >= 5 ? "day-cell--weekend" : "",
      isCurrent ? "day-cell--current" : ""
    ].filter(Boolean).join(" ");
    const ariaLabel = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long"
    }).format(new Date(cell.year, cell.month, cell.n));

    const isoDate = toIsoDate(new Date(cell.year, cell.month, cell.n));

    return `
      <button class="${classes}" type="button" aria-label="${ariaLabel}" data-calendar-date="${isoDate}">
        <span class="day-cell__num">${cell.n}</span>
        <span class="markers">
          ${markers.map(color => `<span class="dot" style="background:${color}"></span>`).join("")}
        </span>
      </button>
    `;
  }).join("");
}

function getCalendarCells(year, month) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const date = new Date(year, month - 1, daysInPreviousMonth - index);
    cells.push({
      n: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      muted: true
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ n: day, month, year, muted: false });
  }

  const totalCells = Math.ceil(cells.length / 7) * 7;
  for (let day = 1; cells.length < totalCells; day += 1) {
    const date = new Date(year, month + 1, day);
    cells.push({
      n: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      muted: true
    });
  }

  return cells;
}

function formatMonthTitle(date) {
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(date);
  return `${month[0].toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

function applySeasonalBackground(date) {
  const slug = monthImageSlugs[date.getMonth()] || "may";
  const shell = document.querySelector(".app-shell");
  if (shell) {
    shell.dataset.calendarMonth = slug;
  }
  document.documentElement.style.setProperty(
    "--seasonal-bg",
    `url("/assets/months/large/${slug}.webp"), url("/assets/months/large/may.webp")`
  );
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDayTitle(date) {
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(date);
  const day = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${day}`;
}

function getCalendarMarkers(date) {
  const markers = [...(markerMap[date.getDate()] || [])];
  if (getBirthdaysForDate(date).length) {
    markers.push("#D96B5F");
  }
  if (getDiaryEntriesForDate(date).length) {
    markers.push("#8C7AE6");
  }
  return markers;
}

function getEventsForDate(date) {
  const day = date.getDate();
  const events = [];
  const markers = markerMap[day] || [];
  const labelByColor = Object.fromEntries(labels.map(([label, color]) => [color, label]));

  if (date.toDateString() === new Date().toDateString()) {
    summaryItems.forEach(item => {
      events.push({
        time: item.time,
        title: item.title,
        subtitle: item.subtitle,
        color: item.color
      });
    });
  }

  markers.forEach((color, index) => {
    events.push({
      time: index === 0 ? "Весь день" : "",
      title: labelByColor[color] || "Событие",
      subtitle: "Метка в календаре",
      color
    });
  });

  if (day === 12) {
    events.push({
      time: "Весь день",
      title: "День рождения: мама",
      subtitle: "Позвонить вечером",
      color: "#D96B5F"
    });
  }

  getBirthdaysForDate(date).forEach(birthday => {
    events.push({
      time: "Весь день",
      title: `День рождения: ${birthday.name}`,
      subtitle: getBirthdayEventSubtitle(birthday, date),
      color: "#D96B5F"
    });
  });

  getDiaryEntriesForDate(date).forEach(entry => {
    events.push({
      time: "Дневник",
      title: `Дневник: ${getDiaryEntryTitle(entry)}`,
      subtitle: entry.mood ? `${entry.mood} · ${getDiaryPreview(entry)}` : getDiaryPreview(entry),
      color: "#8C7AE6"
    });
  });

  return events;
}

function renderDayCard(date) {
  selectedDayCardDate = new Date(date);
  const title = document.querySelector("#dayCardTitle");
  const body = document.querySelector("#dayCardBody");
  if (!title || !body) return;

  const events = getEventsForDate(date);
  title.textContent = formatDayTitle(date);
  body.innerHTML = `
    <div class="day-card-panel">
      <div class="day-card-panel__head">
        <div>
          <span>События рядом с этой датой</span>
          <strong>${events.length ? `${events.length} события` : "Пока спокойно"}</strong>
        </div>
        <button class="primary-button primary-button--compact" type="button" data-open-week-view>
          Открыть неделю
        </button>
      </div>
      <div class="day-card-list">
        ${events.length ? events.map(item => `
          <article class="day-card-event" style="--event-color:${item.color}">
            <span class="day-card-event__time">${escapeHtml(item.time || "Без времени")}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.subtitle)}</small>
            </div>
            <button class="icon-button icon-button--tiny" type="button" aria-label="Удалить">
              <span class="icon icon-trash"></span>
            </button>
          </article>
        `).join("") : `
          <div class="day-card-empty">
            <strong>На эту дату пока ничего не запланировано.</strong>
            <span>Можно добавить напоминание или просто оставить день свободным.</span>
          </div>
        `}
      </div>
      <div class="day-card-actions">
        <button class="secondary-button" type="button" data-open-modal="reminder">+ Напоминание</button>
        <button class="secondary-button" type="button" data-open-diary-entry-for-day>+ Дневник</button>
      </div>
    </div>
  `;
}

function getWeekStart(date) {
  const result = new Date(date);
  const weekday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - weekday);
  return result;
}

function renderWeekView(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const title = document.querySelector("#weekViewTitle");
  const body = document.querySelector("#weekViewBody");
  if (!title || !body) return;

  title.textContent = `Неделя ${start.getDate()}–${end.getDate()} ${new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(end)}`;
  const days = Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });

  body.innerHTML = `
    <div class="week-view-grid">
      ${days.map(day => {
        const events = getEventsForDate(day);
        return `
          <article class="week-day-card">
            <header>
              <span>${new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(day)}</span>
              <strong>${day.getDate()}</strong>
            </header>
            <div class="week-day-card__events">
              ${events.length ? events.slice(0, 3).map(item => `
                <span style="--event-color:${item.color}">
                  ${escapeHtml(item.time && item.time !== "Весь день" ? `${item.time} · ` : "")}${escapeHtml(item.title)}
                </span>
              `).join("") : `<em>Свободно</em>`}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderSummary() {
  document.querySelector("#summaryList").innerHTML = getTodaySummaryItems().map(item => `
    <div class="summary-item">
      <span class="summary-time">${item.time}</span>
      <span>
        <span class="summary-title" style="--summary-color:${item.color}">${item.title}</span>
        <span class="summary-subtitle">${item.subtitle}</span>
      </span>
    </div>
  `).join("");
}

function getTodaySummaryItems() {
  const today = new Date();
  const birthdayItems = getBirthdaysForDate(today).map(birthday => ({
    time: "Весь день",
    title: `День рождения: ${birthday.name}`,
    subtitle: getBirthdayEventSubtitle(birthday, today),
    color: "#D96B5F",
  }));
  const diaryItems = getDiaryEntriesForDate(today).map(entry => ({
    time: "Дневник",
    title: getDiaryEntryTitle(entry),
    subtitle: entry.mood ? `${entry.mood} · ${getDiaryPreview(entry)}` : getDiaryPreview(entry),
    color: "#8C7AE6",
  }));

  return [...summaryItems, ...birthdayItems, ...diaryItems];
}

function getTodayTaskKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTaskList(tasksList) {
  const now = new Date().toISOString();
  return (Array.isArray(tasksList) ? tasksList : [])
    .map((task, index) => {
      const title = String(task?.title || "").trim();
      if (!title) return null;

      const createdAt = task.createdAt || now;
      return {
        id: String(task.id || `task-${Date.now()}-${index}`),
        title,
        label: String(task.label || "Личное").trim() || "Личное",
        done: Boolean(task.done),
        dateKey: String(task.dateKey || getTodayTaskKey()),
        createdAt,
        updatedAt: task.updatedAt || createdAt,
      };
    })
    .filter(Boolean);
}

function renderTasks() {
  const taskList = document.querySelector("#taskList");
  if (!taskList) return;

  const todayKey = getTodayTaskKey();
  const todayTasks = savedTasks
    .filter(task => task.dateKey === todayKey)
    .sort(compareTodayTasks);

  if (!todayTasks.length) {
    taskList.innerHTML = `
      <div class="task-empty">
        <strong>Сегодня дел пока нет</strong>
        <span>Добавьте одно главное дело или оставьте день свободным.</span>
      </div>
    `;
    return;
  }

  taskList.innerHTML = todayTasks.map(task => `
    <button class="task-item ${task.done ? "task-item--done" : ""}" type="button" data-task-id="${escapeHtml(task.id)}">
      <span class="task-check"></span>
      <span>
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-label">${escapeHtml(task.label)}</span>
      </span>
    </button>
  `).join("");

  taskList.querySelectorAll("[data-task-id]").forEach(button => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.taskId;
      savedTasks = savedTasks.map(task => {
        if (task.id !== taskId) return task;
        return { ...task, done: !task.done, updatedAt: new Date().toISOString() };
      });
      persistSavedTasks();
      renderTasks();
    });
  });
}

function compareTodayTasks(first, second) {
  if (first.done !== second.done) {
    return first.done ? 1 : -1;
  }

  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
}

function clearTaskForm() {
  ["#taskText", "#taskLabel"].forEach(selector => {
    const field = document.querySelector(selector);
    if (field) {
      field.value = "";
    }
  });
}

async function saveTodayTask(onSaved) {
  const textField = document.querySelector("#taskText");
  const labelField = document.querySelector("#taskLabel");
  const title = textField?.value.trim() || "";

  if (!title) {
    textField?.focus();
    return;
  }

  const now = new Date().toISOString();
  const task = {
    id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    label: labelField?.value.trim() || "Личное",
    done: false,
    dateKey: getTodayTaskKey(),
    createdAt: now,
    updatedAt: now,
  };

  savedTasks = normalizeTaskList([task, ...savedTasks]);
  await saveTasksLocally(savedTasks);
  const tasksSnapshot = [...savedTasks];
  runBackgroundSync(() => scheduleSync.pushTasks(tasksSnapshot), "tasks");
  clearTaskForm();
  renderTasks();
  onSaved?.();
}

function normalizeNoteList(notesList) {
  const now = new Date().toISOString();
  return (Array.isArray(notesList) ? notesList : [])
    .map((note, index) => {
      const body = String(note?.body || note?.text || "").trim();
      if (!body) return null;

      const createdAt = note.createdAt || now;
      return {
        id: String(note.id || `note-${Date.now()}-${index}`),
        body,
        createdAt,
        updatedAt: note.updatedAt || createdAt,
      };
    })
    .filter(Boolean);
}

function renderNotes() {
  const list = document.querySelector("#savedNotesList");
  if (!list) return;

  const notes = [...savedNotes].sort(compareNotesByUpdatedAt);

  if (!notes.length) {
    list.innerHTML = `
      <div class="saved-notes-empty">
        <strong>Заметок пока нет</strong>
        <span>Добавьте идею, мысль или деталь, чтобы вернуться к ней позже.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = notes.map(note => `
    <article class="saved-note-card" data-note-card="${escapeHtml(note.id)}">
      <div>
        <span class="saved-note-card__date">${escapeHtml(formatNoteTimestamp(note.updatedAt))}</span>
        <h3>${escapeHtml(getNoteTitle(note))}</h3>
        <p>${escapeHtml(note.body)}</p>
      </div>
      <div class="saved-note-card__actions">
        <button class="icon-button icon-button--tiny" type="button" aria-label="Редактировать заметку" data-edit-note="${escapeHtml(note.id)}">
          <span class="icon icon-note"></span>
        </button>
        <button class="icon-button icon-button--tiny" type="button" aria-label="Удалить заметку" data-delete-note="${escapeHtml(note.id)}">
          <span class="icon icon-close"></span>
        </button>
      </div>
    </article>
  `).join("");
}

function compareNotesByUpdatedAt(first, second) {
  return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
}

function getNoteTitle(note) {
  const firstLine = String(note.body || "").split(/\r?\n/).find(line => line.trim()) || "Заметка";
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;
}

function formatNoteTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Без даты";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function clearNoteForm() {
  const field = document.querySelector("#noteText");
  if (field) {
    field.value = "";
  }
}

function prepareNewNote() {
  noteEditId = null;
  clearNoteForm();
  renderNoteEditorState();
}

function prepareNoteEdit(noteId) {
  const note = savedNotes.find(item => item.id === noteId);
  if (!note) return false;

  noteEditId = note.id;
  const field = document.querySelector("#noteText");
  if (field) {
    field.value = note.body;
  }
  renderNoteEditorState();
  return true;
}

function renderNoteEditorState() {
  const title = document.querySelector("#noteTitle");
  const saveButton = document.querySelector("#noteSaveButton");

  if (title) {
    title.textContent = noteEditId ? "Редактировать заметку" : "Добавить заметку";
  }

  if (saveButton) {
    saveButton.textContent = noteEditId ? "Сохранить изменения" : "Сохранить";
  }
}

async function saveNote(onSaved) {
  const field = document.querySelector("#noteText");
  const body = field?.value.trim() || "";

  if (!body) {
    field?.focus();
    return;
  }

  const editingNote = noteEditId
    ? savedNotes.find(note => note.id === noteEditId)
    : null;
  const now = new Date().toISOString();
  const note = {
    id: editingNote?.id || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    body,
    createdAt: editingNote?.createdAt || now,
    updatedAt: now,
  };

  savedNotes = normalizeNoteList(editingNote
    ? savedNotes.map(item => item.id === editingNote.id ? note : item)
    : [note, ...savedNotes]);
  await saveNotesLocally(savedNotes);
  const notesSnapshot = [...savedNotes];
  runBackgroundSync(() => scheduleSync.pushNotes(notesSnapshot), "notes");
  noteEditId = null;
  clearNoteForm();
  renderNoteEditorState();
  renderNotes();
  onSaved?.();
}

function normalizeBirthdayList(birthdaysList) {
  const now = new Date().toISOString();
  return (Array.isArray(birthdaysList) ? birthdaysList : [])
    .map((birthday, index) => {
      const name = String(birthday?.name || birthday?.title || "").trim();
      const parsedDate = parseBirthdayDateValue(birthday?.dateOfBirth || birthday?.date || "");
      if (!name || !parsedDate) return null;

      const createdAt = birthday.createdAt || now;
      return {
        id: String(birthday.id || `birthday-${Date.now()}-${index}`),
        name,
        dateOfBirth: parsedDate.iso,
        note: String(birthday.note || "").trim(),
        reminderEnabled: birthday.reminderEnabled !== false,
        createdAt,
        updatedAt: birthday.updatedAt || createdAt,
      };
    })
    .filter(Boolean);
}

function parseBirthdayDateValue(value) {
  const raw = String(value || "").trim();
  const localMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const parts = localMatch
    ? { day: Number(localMatch[1]), month: Number(localMatch[2]), year: Number(localMatch[3]) }
    : isoMatch
      ? { day: Number(isoMatch[3]), month: Number(isoMatch[2]), year: Number(isoMatch[1]) }
      : null;

  if (!parts) return null;

  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (
    date.getFullYear() !== parts.year ||
    date.getMonth() !== parts.month - 1 ||
    date.getDate() !== parts.day
  ) {
    return null;
  }

  return {
    day: parts.day,
    month: parts.month,
    year: parts.year,
    iso: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
  };
}

function getBirthdayParts(birthday) {
  return parseBirthdayDateValue(birthday?.dateOfBirth);
}

function getBirthdaysForDate(date) {
  return savedBirthdays.filter(birthday => {
    const parts = getBirthdayParts(birthday);
    return parts && parts.day === date.getDate() && parts.month === date.getMonth() + 1;
  });
}

function getBirthdayAge(birthday, date = new Date()) {
  const parts = getBirthdayParts(birthday);
  if (!parts) return null;
  return date.getFullYear() - parts.year;
}

function getBirthdayEventSubtitle(birthday, date = new Date()) {
  const age = getBirthdayAge(birthday, date);
  const ageText = Number.isFinite(age) && age > 0 ? `${age} лет` : "Возраст не указан";
  return birthday.note ? `${ageText} · ${birthday.note}` : ageText;
}

function getNextBirthdayDate(birthday, now = new Date()) {
  const parts = getBirthdayParts(birthday);
  if (!parts) return null;

  let next = new Date(now.getFullYear(), parts.month - 1, parts.day, 9, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next = new Date(now.getFullYear() + 1, parts.month - 1, parts.day, 9, 0, 0, 0);
  }
  return next;
}

function getBirthdayReminderId(birthday) {
  return `birthday-reminder-${birthday.id}`;
}

function renderBirthdays() {
  const list = document.querySelector("#savedBirthdaysList");
  if (!list) return;

  const birthdays = [...savedBirthdays].sort(compareBirthdaysByUpcomingDate);

  if (!birthdays.length) {
    list.innerHTML = `
      <div class="saved-birthdays-empty">
        <strong>Дней рождения пока нет</strong>
        <span>Добавьте важные даты, чтобы они появились в календаре и напоминаниях.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = birthdays.map(birthday => {
    const nextDate = getNextBirthdayDate(birthday);
    const age = nextDate ? getBirthdayAge(birthday, nextDate) : null;
    return `
      <article class="saved-birthday-card" data-birthday-card="${escapeHtml(birthday.id)}">
        <div class="saved-birthday-card__date">
          <strong>${escapeHtml(formatBirthdayDayMonth(birthday))}</strong>
          <span>${nextDate ? escapeHtml(formatBirthdayUpcoming(nextDate)) : "Дата не указана"}</span>
        </div>
        <div class="saved-birthday-card__main">
          <h3>${escapeHtml(birthday.name)}</h3>
          <p>${Number.isFinite(age) && age > 0 ? `${age} лет` : "Возраст не указан"}</p>
          ${birthday.note ? `<small>${escapeHtml(birthday.note)}</small>` : ""}
          ${birthday.reminderEnabled ? `<small>Напоминание утром включено</small>` : ""}
        </div>
        <div class="saved-birthday-card__actions">
          <button class="icon-button icon-button--tiny" type="button" aria-label="Редактировать день рождения" data-edit-birthday="${escapeHtml(birthday.id)}">
            <span class="icon icon-gift"></span>
          </button>
          <button class="icon-button icon-button--tiny" type="button" aria-label="Удалить день рождения" data-delete-birthday="${escapeHtml(birthday.id)}">
            <span class="icon icon-close"></span>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function compareBirthdaysByUpcomingDate(first, second) {
  const firstDate = getNextBirthdayDate(first)?.getTime() || Number.MAX_SAFE_INTEGER;
  const secondDate = getNextBirthdayDate(second)?.getTime() || Number.MAX_SAFE_INTEGER;
  return firstDate - secondDate;
}

function formatBirthdayDayMonth(birthday) {
  const parts = getBirthdayParts(birthday);
  if (!parts) return "--.--";
  return `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}`;
}

function formatBirthdayUpcoming(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function clearBirthdayForm() {
  ["#birthdayName", "#birthdayDate", "#birthdayNote"].forEach(selector => {
    const field = document.querySelector(selector);
    if (field) {
      field.value = "";
    }
  });
  const reminder = document.querySelector("#birthdayReminder");
  if (reminder) {
    reminder.checked = true;
  }
}

function prepareNewBirthday() {
  birthdayEditId = null;
  clearBirthdayForm();
  renderBirthdayEditorState();
}

function prepareBirthdayEdit(birthdayId) {
  const birthday = savedBirthdays.find(item => item.id === birthdayId);
  if (!birthday) return false;

  birthdayEditId = birthday.id;
  const name = document.querySelector("#birthdayName");
  const date = document.querySelector("#birthdayDate");
  const note = document.querySelector("#birthdayNote");
  const reminder = document.querySelector("#birthdayReminder");

  if (name) name.value = birthday.name;
  if (date) date.value = formatBirthdayDateInput(birthday);
  if (note) note.value = birthday.note || "";
  if (reminder) reminder.checked = birthday.reminderEnabled !== false;

  renderBirthdayEditorState();
  return true;
}

function formatBirthdayDateInput(birthday) {
  const parts = getBirthdayParts(birthday);
  if (!parts) return "";
  return `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}.${parts.year}`;
}

function renderBirthdayEditorState() {
  const title = document.querySelector("#birthdayTitle");
  const saveButton = document.querySelector("#birthdaySaveButton");

  if (title) {
    title.textContent = birthdayEditId ? "Редактировать день рождения" : "Добавить день рождения";
  }

  if (saveButton) {
    saveButton.textContent = birthdayEditId ? "Сохранить изменения" : "Сохранить";
  }
}

async function saveBirthday(onSaved) {
  const nameField = document.querySelector("#birthdayName");
  const dateField = document.querySelector("#birthdayDate");
  const noteField = document.querySelector("#birthdayNote");
  const reminderField = document.querySelector("#birthdayReminder");
  const name = nameField?.value.trim() || "";
  const parsedDate = parseBirthdayDateValue(dateField?.value);

  if (!name) {
    nameField?.focus();
    return;
  }

  if (!parsedDate) {
    dateField?.focus();
    return;
  }

  const editingBirthday = birthdayEditId
    ? savedBirthdays.find(birthday => birthday.id === birthdayEditId)
    : null;
  const now = new Date().toISOString();
  const birthday = {
    id: editingBirthday?.id || `birthday-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    dateOfBirth: parsedDate.iso,
    note: noteField?.value.trim() || "",
    reminderEnabled: reminderField?.checked !== false,
    createdAt: editingBirthday?.createdAt || now,
    updatedAt: now,
  };

  savedBirthdays = normalizeBirthdayList(editingBirthday
    ? savedBirthdays.map(item => item.id === editingBirthday.id ? birthday : item)
    : [birthday, ...savedBirthdays]);
  await saveBirthdaysLocally(savedBirthdays);
  const birthdaysSnapshot = [...savedBirthdays];
  runBackgroundSync(() => scheduleSync.pushBirthdays(birthdaysSnapshot), "birthdays");
  await syncBirthdayReminder(birthday);
  birthdayEditId = null;
  clearBirthdayForm();
  renderBirthdayEditorState();
  renderBirthdays();
  renderCalendar();
  renderSummary();
  onSaved?.();
}

async function syncBirthdayReminder(birthday) {
  const reminderId = getBirthdayReminderId(birthday);
  localReminders = localReminders.filter(reminder => reminder.id !== reminderId);

  if (birthday.reminderEnabled !== false) {
    const nextDate = getNextBirthdayDate(birthday);
    if (nextDate) {
      const result = createLocalReminder({
        id: reminderId,
        title: `Поздравить: ${birthday.name}`,
        date: formatDateValue(nextDate),
        time: "09:00",
        createdAt: birthday.createdAt ? new Date(birthday.createdAt) : new Date(),
      });

      if (result.ok) {
        localReminders = [result.reminder, ...localReminders];
      }
    }
  }

  await persistLocalReminders();
  scheduleLocalReminders();
  renderReminderList();
}

function normalizeDiaryEntryList(entriesList) {
  const now = new Date().toISOString();
  return (Array.isArray(entriesList) ? entriesList : [])
    .map((entry, index) => {
      const heading = String(entry?.heading || entry?.title || "").trim();
      const text = String(entry?.text || entry?.body || "").trim();
      const mood = String(entry?.mood || "").trim();
      const parsedDate = parseDiaryDateValue(entry?.dateKey || entry?.date || entry?.createdAt || "");

      if (!heading && !text) return null;

      const createdAt = entry.createdAt || now;
      return {
        id: String(entry.id || `diary-${Date.now()}-${index}`),
        dateKey: parsedDate?.iso || toIsoDate(new Date()),
        heading,
        mood,
        text,
        createdAt,
        updatedAt: entry.updatedAt || createdAt,
      };
    })
    .filter(Boolean);
}

function parseDiaryDateValue(value) {
  const raw = String(value || "").trim();
  const localMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const parts = localMatch
    ? { day: Number(localMatch[1]), month: Number(localMatch[2]), year: Number(localMatch[3]) }
    : isoMatch
      ? { day: Number(isoMatch[3]), month: Number(isoMatch[2]), year: Number(isoMatch[1]) }
      : null;

  if (parts) {
    const date = new Date(parts.year, parts.month - 1, parts.day);
    if (
      date.getFullYear() === parts.year &&
      date.getMonth() === parts.month - 1 &&
      date.getDate() === parts.day
    ) {
      return {
        day: parts.day,
        month: parts.month,
        year: parts.year,
        iso: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
        date,
      };
    }
    return null;
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
    iso: toIsoDate(parsed),
    date: parsed,
  };
}

function getDiaryEntriesForDate(date) {
  const dateKey = toIsoDate(date);
  return savedDiaryEntries.filter(entry => entry.dateKey === dateKey);
}

function getDiaryEntryTitle(entry) {
  const fallback = String(entry?.text || "").split(/\r?\n/).find(line => line.trim()) || "Запись";
  const title = String(entry?.heading || fallback).trim();
  return title.length > 64 ? `${title.slice(0, 61)}...` : title;
}

function getDiaryPreview(entry) {
  const preview = String(entry?.text || entry?.heading || "Без текста").replace(/\s+/g, " ").trim();
  return preview.length > 96 ? `${preview.slice(0, 93)}...` : preview;
}

function renderDiaryEntries() {
  const list = document.querySelector("#savedDiaryList");
  if (!list) return;

  const entries = [...savedDiaryEntries].sort(compareDiaryEntriesByDate);

  if (!entries.length) {
    list.innerHTML = `
      <div class="saved-diary-empty">
        <strong>Записей пока нет</strong>
        <span>Добавьте первую запись дня, чтобы сохранить мысли, настроение и важные итоги.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = entries.map(entry => `
    <article class="saved-diary-card" data-diary-card="${escapeHtml(entry.id)}">
      <div class="saved-diary-card__date">
        <strong>${escapeHtml(formatDiaryDay(entry.dateKey))}</strong>
        <span>${escapeHtml(formatDiaryMonth(entry.dateKey))}</span>
      </div>
      <div class="saved-diary-card__main">
        <h3>${escapeHtml(getDiaryEntryTitle(entry))}</h3>
        ${entry.mood ? `<small>${escapeHtml(entry.mood)}</small>` : ""}
        <p>${escapeHtml(getDiaryPreview(entry))}</p>
      </div>
      <div class="saved-diary-card__actions">
        <button class="icon-button icon-button--tiny" type="button" aria-label="Редактировать запись дневника" data-edit-diary="${escapeHtml(entry.id)}">
          <span class="icon icon-book"></span>
        </button>
        <button class="icon-button icon-button--tiny" type="button" aria-label="Удалить запись дневника" data-delete-diary="${escapeHtml(entry.id)}">
          <span class="icon icon-close"></span>
        </button>
      </div>
    </article>
  `).join("");
}

function compareDiaryEntriesByDate(first, second) {
  const firstDate = new Date(`${first.dateKey}T00:00:00`).getTime();
  const secondDate = new Date(`${second.dateKey}T00:00:00`).getTime();
  if (secondDate !== firstDate) return secondDate - firstDate;
  return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
}

function formatDiaryDateInput(dateKey) {
  const parsed = parseDiaryDateValue(dateKey);
  if (!parsed) return "";
  return `${String(parsed.day).padStart(2, "0")}.${String(parsed.month).padStart(2, "0")}.${parsed.year}`;
}

function formatDiaryDay(dateKey) {
  const parsed = parseDiaryDateValue(dateKey);
  return parsed ? String(parsed.day).padStart(2, "0") : "--";
}

function formatDiaryMonth(dateKey) {
  const parsed = parseDiaryDateValue(dateKey);
  if (!parsed) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(parsed.date);
}

function clearDiaryForm() {
  ["#diaryDate", "#diaryMood", "#diaryEntryHeading", "#diaryText"].forEach(selector => {
    const field = document.querySelector(selector);
    if (field) {
      field.value = "";
    }
  });
}

function prepareNewDiaryEntry(date = new Date()) {
  diaryEditId = null;
  clearDiaryForm();
  const dateField = document.querySelector("#diaryDate");
  if (dateField) {
    dateField.value = formatDiaryDateInput(toIsoDate(date));
  }
  renderDiaryEditorState();
}

function prepareDiaryEntryEdit(entryId) {
  const entry = savedDiaryEntries.find(item => item.id === entryId);
  if (!entry) return false;

  diaryEditId = entry.id;
  const date = document.querySelector("#diaryDate");
  const mood = document.querySelector("#diaryMood");
  const heading = document.querySelector("#diaryEntryHeading");
  const text = document.querySelector("#diaryText");

  if (date) date.value = formatDiaryDateInput(entry.dateKey);
  if (mood) mood.value = entry.mood || "";
  if (heading) heading.value = entry.heading || "";
  if (text) text.value = entry.text || "";

  renderDiaryEditorState();
  return true;
}

function renderDiaryEditorState() {
  const title = document.querySelector("#diaryEntryTitle");
  const saveButton = document.querySelector("#diarySaveButton");

  if (title) {
    title.textContent = diaryEditId ? "Редактировать запись" : "Добавить запись";
  }

  if (saveButton) {
    saveButton.textContent = diaryEditId ? "Сохранить изменения" : "Сохранить";
  }
}

function isValidDiaryPin(pin) {
  return /^\d{4}$/.test(String(pin || ""));
}

function normalizeDiaryPinSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const salt = String(settings.salt || "");
  const hash = String(settings.hash || "");
  const iterations = Number(settings.iterations || 120000);

  if (!salt || !hash || !Number.isFinite(iterations) || iterations < 1) {
    return null;
  }

  return {
    salt,
    hash,
    iterations,
    updatedAt: settings.updatedAt || null,
  };
}

function getDiaryPinFromLocalStorage() {
  try {
    return normalizeDiaryPinSettings(JSON.parse(readLocalStorageItem(DIARY_PIN_KEY) || "null"));
  } catch {
    return null;
  }
}

function saveDiaryPinToLocalStorage(settings) {
  try {
    if (settings) {
      localStorage.setItem(DIARY_PIN_KEY, JSON.stringify(settings));
    } else {
      localStorage.removeItem(DIARY_PIN_KEY);
    }
  } catch {
    // Дневник остается защищенным в текущей сессии, даже если резервное хранилище недоступно.
  }
}

function clearDiaryPinFromLocalStorage() {
  saveDiaryPinToLocalStorage(null);
}

async function loadDiaryPinSettings() {
  if (diaryPinSettingsLoaded) {
    return diaryPinSettings;
  }

  try {
    diaryPinSettings = normalizeDiaryPinSettings(await scheduleStorage.loadDiaryPinSettings());
    if (diaryPinSettings) {
      clearDiaryPinFromLocalStorage();
    } else {
      const legacyDiaryPinSettings = getDiaryPinFromLocalStorage();
      if (legacyDiaryPinSettings) {
        diaryPinSettings = legacyDiaryPinSettings;
        await scheduleStorage.saveDiaryPinSettings(legacyDiaryPinSettings);
        clearDiaryPinFromLocalStorage();
      }
    }
  } catch {
    diaryPinSettings = getDiaryPinFromLocalStorage();
  }

  diaryPinSettingsLoaded = true;
  renderDiaryPinSummary();
  return diaryPinSettings;
}

async function saveDiaryPinSettings(settings) {
  const normalizedSettings = normalizeDiaryPinSettings(settings);
  diaryPinSettings = normalizedSettings;
  diaryPinSettingsLoaded = true;

  try {
    await scheduleStorage.saveDiaryPinSettings(normalizedSettings);
    clearDiaryPinFromLocalStorage();
  } catch {
    saveDiaryPinToLocalStorage(normalizedSettings);
  }

  renderDiaryPinSummary();
  return normalizedSettings;
}

function hasDiaryPin() {
  return Boolean(diaryPinSettings);
}

function createDiaryPinSalt() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

async function hashDiaryPin(pin, salt, iterations = 120000) {
  const normalizedPin = String(pin || "");
  const saltBytes = hexToBytes(salt);

  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(normalizedPin),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: saltBytes,
        iterations,
      },
      keyMaterial,
      256
    );
    return bytesToHex(new Uint8Array(bits));
  }

  let hash = 2166136261;
  const source = `${salt}:${normalizedPin}`;
  for (let round = 0; round < Math.max(iterations, 1); round += 1) {
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

function bytesToHex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const normalizedHex = String(hex || "").replace(/[^0-9a-f]/gi, "");
  const bytes = new Uint8Array(Math.floor(normalizedHex.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalizedHex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifyDiaryPin(pin) {
  await loadDiaryPinSettings();
  if (!diaryPinSettings || !isValidDiaryPin(pin)) {
    return false;
  }

  const hash = await hashDiaryPin(pin, diaryPinSettings.salt, diaryPinSettings.iterations);
  return hash === diaryPinSettings.hash;
}

function setDiaryPinStatus(message) {
  const status = document.querySelector("#diaryPinStatus");
  if (status) {
    status.textContent = message;
  }
}

function setDiaryUnlockStatus(message) {
  const status = document.querySelector("#diaryUnlockStatus");
  if (status) {
    status.textContent = message;
  }
}

function renderDiaryPinSummary() {
  const summary = document.querySelector("#diaryPinSummary");
  const setupButton = document.querySelector("#diaryPinSetupButton");

  if (summary) {
    summary.textContent = hasDiaryPin()
      ? "PIN включён. Дневник будет запрашивать 4 цифры при входе после перезагрузки или блокировки."
      : "PIN пока не установлен. Дневник предложит создать 4-значный код при первом входе.";
  }

  if (setupButton) {
    setupButton.textContent = hasDiaryPin() ? "Сменить PIN" : "Установить PIN";
  }
}

function prepareDiaryPinForm(mode = "setup") {
  diaryPinMode = mode;
  const title = document.querySelector("#diaryPinTitle");
  const currentGroup = document.querySelector("#diaryPinCurrentGroup");
  const saveButton = document.querySelector("#diaryPinSaveButton");
  const current = document.querySelector("#diaryPinCurrent");
  const pin = document.querySelector("#diaryPinNew");
  const confirm = document.querySelector("#diaryPinConfirm");

  if (title) {
    title.textContent = mode === "change" ? "Сменить PIN дневника" : "Установить PIN дневника";
  }

  if (currentGroup) {
    currentGroup.hidden = mode !== "change";
  }

  [current, pin, confirm].forEach(field => {
    if (field) {
      field.value = "";
    }
  });

  if (saveButton) {
    saveButton.textContent = mode === "change" ? "Сменить PIN" : "Установить PIN";
  }

  setDiaryPinStatus(mode === "change"
    ? "Введите текущий PIN и новый код из 4 цифр."
    : "Создайте 4-значный цифровой PIN для входа в личный дневник.");
}

function prepareDiaryUnlockForm() {
  const field = document.querySelector("#diaryUnlockPin");
  if (field) {
    field.value = "";
  }
  setDiaryUnlockStatus("Введите 4-значный PIN, чтобы открыть личный дневник.");
}

async function saveDiaryPin(onSaved) {
  const currentField = document.querySelector("#diaryPinCurrent");
  const pinField = document.querySelector("#diaryPinNew");
  const confirmField = document.querySelector("#diaryPinConfirm");
  const currentPin = currentField?.value.trim() || "";
  const pin = pinField?.value.trim() || "";
  const confirm = confirmField?.value.trim() || "";

  if (diaryPinMode === "change" && hasDiaryPin()) {
    const currentPinMatches = await verifyDiaryPin(currentPin);
    if (!currentPinMatches) {
      setDiaryPinStatus("Текущий PIN не подошёл.");
      currentField?.focus();
      return;
    }
  }

  if (!isValidDiaryPin(pin)) {
    setDiaryPinStatus("PIN должен состоять ровно из 4 цифр.");
    pinField?.focus();
    return;
  }

  if (pin !== confirm) {
    setDiaryPinStatus("PIN и повтор PIN не совпадают.");
    confirmField?.focus();
    return;
  }

  const salt = createDiaryPinSalt();
  const iterations = 120000;
  const hash = await hashDiaryPin(pin, salt, iterations);
  await saveDiaryPinSettings({
    salt,
    hash,
    iterations,
    updatedAt: new Date().toISOString(),
  });

  diaryUnlocked = true;
  setDiaryPinStatus("PIN установлен.");
  onSaved?.();
}

async function unlockDiary(onUnlocked) {
  const field = document.querySelector("#diaryUnlockPin");
  const pin = field?.value.trim() || "";

  if (!isValidDiaryPin(pin)) {
    setDiaryUnlockStatus("Введите 4 цифры.");
    field?.focus();
    return;
  }

  if (!await verifyDiaryPin(pin)) {
    setDiaryUnlockStatus("PIN не подошёл.");
    field?.focus();
    return;
  }

  diaryUnlocked = true;
  field.value = "";
  onUnlocked?.();
}

function lockDiary(onLocked) {
  diaryUnlocked = false;
  diaryEditId = null;
  diaryDraftDateKey = "";
  diaryPendingModal = "";
  onLocked?.();
}

async function saveDiaryEntry(onSaved) {
  const dateField = document.querySelector("#diaryDate");
  const moodField = document.querySelector("#diaryMood");
  const headingField = document.querySelector("#diaryEntryHeading");
  const textField = document.querySelector("#diaryText");
  const parsedDate = parseDiaryDateValue(dateField?.value);
  const heading = headingField?.value.trim() || "";
  const text = textField?.value.trim() || "";

  if (!parsedDate) {
    dateField?.focus();
    return;
  }

  if (!heading && !text) {
    textField?.focus();
    return;
  }

  const editingEntry = diaryEditId
    ? savedDiaryEntries.find(entry => entry.id === diaryEditId)
    : null;
  const now = new Date().toISOString();
  const entry = {
    id: editingEntry?.id || `diary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    dateKey: parsedDate.iso,
    heading,
    mood: moodField?.value.trim() || "",
    text,
    createdAt: editingEntry?.createdAt || now,
    updatedAt: now,
  };

  savedDiaryEntries = normalizeDiaryEntryList(editingEntry
    ? savedDiaryEntries.map(item => item.id === editingEntry.id ? entry : item)
    : [entry, ...savedDiaryEntries]);
  await saveDiaryEntriesLocally(savedDiaryEntries);
  const entriesSnapshot = [...savedDiaryEntries];
  runBackgroundSync(() => scheduleSync.pushDiaryEntries(entriesSnapshot), "diary");
  diaryEditId = null;
  clearDiaryForm();
  renderDiaryEditorState();
  renderDiaryEntries();
  renderCalendar();
  renderSummary();
  onSaved?.();
}

function renderLabels() {
  document.querySelector("#labelsRow").innerHTML = labels.map(([label, color]) => `
    <span class="label-chip"><span class="dot" style="background:${color}"></span>${label}</span>
  `).join("");
}

function renderScheduleTypes(role = "participant") {
  const typeGrid = document.querySelector("#scheduleTypeGrid");
  if (!typeGrid) return;

  typeGrid.innerHTML = scheduleTypes[role].map(type => `
    <button class="choice-card" type="button" data-schedule-type="${type.id}">
      <span>${type.title}</span>
      <small>${type.description}</small>
    </button>
  `).join("");
}

function renderScheduleDetails(typeId, role) {
  const detailsBody = document.querySelector("#scheduleDetailsBody");
  const detailsTitle = document.querySelector("#scheduleDetailsTitle");
  const detail = scheduleDetails[typeId];
  if (!detailsBody || !detailsTitle || !detail) return;

  const draftDetails = scheduleEditDraft?.type === typeId ? scheduleEditDraft.details || {} : {};
  detailsTitle.textContent = detail.title;
  detailsBody.innerHTML = `
    ${detail.chips ? `
      <div class="mini-chip-row" aria-label="Быстрый выбор">
        ${detail.chips.map(chip => `<button class="mini-chip" type="button">${chip}</button>`).join("")}
      </div>
    ` : ""}
    <div class="scenario-grid">
      ${detail.fields.map(field => `
        <label class="field-block">
          <span>${field.label}</span>
          <input type="text" placeholder="${field.placeholder}" value="${escapeHtml(draftDetails[field.label] || "")}" />
        </label>
      `).join("")}
    </div>
    <p class="scenario-note">${role === "mentor" ? "Сначала зафиксируем основу расписания наставника, потом перейдём к дням и занятиям." : "Сначала зафиксируем основу расписания, потом перейдём к дням и времени."}</p>
  `;
}

function renderScheduleFollowup(typeId) {
  const followupBody = document.querySelector("#scheduleFollowupBody");
  const followupTitle = document.querySelector("#scheduleFollowupTitle");
  const followup = scheduleFollowups[typeId];
  if (!followupBody || !followupTitle || !followup) return;

  const draftPeriod = scheduleEditDraft?.type === typeId ? scheduleEditDraft.period || {} : {};
  followupTitle.textContent = followup.title;

  let content = "";

  if (followup.kind === "period") {
    content = `
      <div class="scenario-grid">
        <label class="field-block">
          <span>Действует с</span>
          <input type="text" placeholder="дд.мм.гггг" inputmode="numeric" value="${escapeHtml(draftPeriod["Действует с"] || "")}" />
        </label>
        <label class="field-block">
          <span>Действует до</span>
          <input type="text" placeholder="дд.мм.гггг" inputmode="numeric" value="${escapeHtml(draftPeriod["Действует до"] || "")}" />
        </label>
      </div>
    `;
  }

  if (followup.kind === "days") {
    const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
    const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

    content = `
      <div class="day-time-list">
        ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => `
          <div class="day-time-row" data-day-time-row>
            <button class="day-time-day" type="button">${day}</button>
            <div class="day-time-content">
              <div class="day-time-values" aria-live="polite"></div>
              <button class="day-time-add" type="button">+ Добавить время</button>
              <div class="time-picker" hidden>
                <div class="time-picker__display" data-time-display>18:00</div>
                <div class="time-picker__columns">
                  <div class="time-picker__column" aria-label="Часы">
                    ${hours.map(hour => `<button class="time-picker__value ${hour === "18" ? "is-selected" : ""}" type="button" data-hour="${hour}">${hour}</button>`).join("")}
                  </div>
                  <div class="time-picker__column" aria-label="Минуты">
                    ${minutes.map(minute => `<button class="time-picker__value ${minute === "00" ? "is-selected" : ""}" type="button" data-minute="${minute}">${minute}</button>`).join("")}
                  </div>
                </div>
                <button class="time-picker__save" type="button">Добавить</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  if (followup.kind === "chips") {
    content = `
      <div class="mini-chip-row mini-chip-row--large" aria-label="Выбор направления">
        ${followup.chips.map(chip => `<button class="mini-chip" type="button">${chip}</button>`).join("")}
      </div>
      <label class="field-block">
        <span>Своё направление</span>
        <input type="text" placeholder="Если нужного направления нет в списке" />
      </label>
    `;
  }

  if (followup.kind === "people") {
    content = `
      <div class="scenario-grid">
        <label class="field-block">
          <span>Имя или название группы</span>
          <input type="text" placeholder="Например: Иван, 7 В, группа рисунка" />
        </label>
        <label class="field-block">
          <span>Контакт</span>
          <input type="text" placeholder="Необязательно" />
        </label>
      </div>
      <button class="secondary-button scenario-add-button" type="button">+ Добавить</button>
    `;
  }

  followupBody.innerHTML = `
    ${content}
    <p class="scenario-note">${followup.note}</p>
  `;

  bindDayTimeControls(followupBody);
}

function bindDayTimeControls(scope) {
  scope.querySelectorAll("[data-day-time-row]").forEach(row => {
    const addButton = row.querySelector(".day-time-add");
    const picker = row.querySelector(".time-picker");
    const display = row.querySelector("[data-time-display]");
    const values = row.querySelector(".day-time-values");
    const saveButton = row.querySelector(".time-picker__save");
    if (!addButton || !picker || !display || !values || !saveButton) return;

    let hour = "18";
    let minute = "00";

    function syncDisplay() {
      display.textContent = `${hour}:${minute}`;
      row.querySelectorAll("[data-hour]").forEach(button => {
        button.classList.toggle("is-selected", button.dataset.hour === hour);
      });
      row.querySelectorAll("[data-minute]").forEach(button => {
        button.classList.toggle("is-selected", button.dataset.minute === minute);
      });
    }

    addButton.addEventListener("click", () => {
      scope.querySelectorAll(".time-picker").forEach(otherPicker => {
        if (otherPicker !== picker) {
          otherPicker.hidden = true;
        }
      });
      picker.hidden = !picker.hidden;
      syncDisplay();
    });

    picker.addEventListener("click", event => {
      const hourButton = event.target.closest("[data-hour]");
      const minuteButton = event.target.closest("[data-minute]");
      if (hourButton) {
        hour = hourButton.dataset.hour;
        syncDisplay();
      }
      if (minuteButton) {
        minute = minuteButton.dataset.minute;
        syncDisplay();
      }
    });

    saveButton.addEventListener("click", () => {
      const time = `${hour}:${minute}`;
      if ([...values.querySelectorAll(".day-time-pill")].some(pill => pill.dataset.time === time)) {
        picker.hidden = true;
        return;
      }
      const pill = document.createElement("span");
      pill.className = "day-time-pill";
      pill.dataset.time = time;
      pill.innerHTML = `${time}<button type="button" aria-label="Удалить время ${time}">×</button>`;
      values.append(pill);
      picker.hidden = true;
    });

    values.addEventListener("click", event => {
      const removeButton = event.target.closest("button");
      if (removeButton) {
        removeButton.closest(".day-time-pill")?.remove();
      }
    });
  });
}

function renderScheduleLessonTime(typeId) {
  const lessonTimeBody = document.querySelector("#scheduleLessonTimeBody");
  const lessonTimeTitle = document.querySelector("#scheduleLessonTimeTitle");
  const lessonTime = scheduleLessonTimeSteps[typeId];
  if (!lessonTimeBody || !lessonTimeTitle || !lessonTime) return;

  lessonTimeTitle.textContent = lessonTime.title;
  lessonTimeBody.innerHTML = `
    <div class="scenario-grid">
      ${lessonTime.fields.map(field => `
        <label class="field-block">
          <span>${field.label}</span>
          <input
            type="text"
            placeholder="${field.placeholder}"
            value="${field.value}"
            ${field.inputmode ? `inputmode="${field.inputmode}"` : ""}
          />
        </label>
      `).join("")}
    </div>
    <p class="scenario-note">${lessonTime.note}</p>
  `;
}

function renderScheduleLongBreak(typeId) {
  const longBreakBody = document.querySelector("#scheduleLongBreakBody");
  const longBreakTitle = document.querySelector("#scheduleLongBreakTitle");
  const longBreak = scheduleLongBreakSteps[typeId];
  if (!longBreakBody || !longBreakTitle || !longBreak) return;

  longBreakTitle.textContent = longBreak.title;
  longBreakBody.innerHTML = `
    <div class="choice-grid choice-grid--reminders choice-grid--long-break" aria-label="${longBreak.title}">
      ${longBreak.options.map((option, index) => `
        <button
          class="choice-card choice-card--compact ${index === 0 ? "choice-card--active" : ""}"
          type="button"
          data-long-break-option="${option}"
          aria-pressed="${index === 0 ? "true" : "false"}"
        >
          <span>${option}</span>
        </button>
      `).join("")}
    </div>
    <div class="scenario-grid">
      ${longBreak.fields.map(field => `
        <label class="field-block">
          <span>${field.label}</span>
          <input
            type="text"
            placeholder="${field.placeholder}"
            value="${field.value}"
            ${field.inputmode ? `inputmode="${field.inputmode}"` : ""}
          />
        </label>
      `).join("")}
    </div>
    <p class="scenario-note">${longBreak.note}</p>
  `;

  longBreakBody.querySelectorAll("[data-long-break-option]").forEach(button => {
    button.addEventListener("click", () => {
      longBreakBody.querySelectorAll("[data-long-break-option]").forEach(optionButton => {
        const isActive = optionButton === button;
        optionButton.classList.toggle("choice-card--active", isActive);
        optionButton.setAttribute("aria-pressed", String(isActive));
      });
    });
  });
}

function renderScheduleSubjects(typeId) {
  const subjectsBody = document.querySelector("#scheduleSubjectsBody");
  const subjectsTitle = document.querySelector("#scheduleSubjectsTitle");
  const subjectStep = scheduleSubjectSteps[typeId];
  if (!subjectsBody || !subjectsTitle || !subjectStep) return;

  subjectsTitle.textContent = subjectStep.title;
  subjectsBody.innerHTML = `
    <div class="subject-picker">
      <div class="subject-picker__add">
        <label class="field-block">
          <span>Добавить свой предмет</span>
          <input type="text" placeholder="Например: обществознание" data-subject-input />
        </label>
        <button class="secondary-button scenario-add-button" type="button" data-subject-add>Добавить</button>
      </div>
      <div class="mini-chip-row mini-chip-row--large" aria-label="Какие предметы добавить">
        ${subjectStep.subjects.map(subject => `<button class="mini-chip" type="button" data-subject-chip="${subject}">${subject}</button>`).join("")}
      </div>
      <div class="selected-subjects">
        <span>Выбранные предметы</span>
        <div class="mini-chip-row" data-selected-subjects>
          <span class="selected-subjects__empty">Предметы пока не выбраны</span>
        </div>
      </div>
    </div>
    <p class="scenario-note">${subjectStep.note}</p>
  `;

  const input = subjectsBody.querySelector("[data-subject-input]");
  const addButton = subjectsBody.querySelector("[data-subject-add]");
  const selected = subjectsBody.querySelector("[data-selected-subjects]");
  const draftSubjects = getDraftSchoolSubjects(typeId);

  function syncEmptyState() {
    const hasItems = Boolean(selected.querySelector("[data-selected-subject]"));
    const empty = selected.querySelector(".selected-subjects__empty");
    if (empty) empty.hidden = hasItems;
  }

  function addSubject(subject) {
    const normalized = subject.trim();
    if (!normalized) return;
    const exists = [...selected.querySelectorAll("[data-selected-subject]")]
      .some(item => item.dataset.selectedSubject.toLowerCase() === normalized.toLowerCase());
    if (exists) return;

    const item = document.createElement("span");
    item.className = "mini-chip mini-chip--selected";
    item.dataset.selectedSubject = normalized;
    item.innerHTML = `${normalized}<button type="button" aria-label="Удалить предмет ${normalized}">×</button>`;
    selected.append(item);
    syncEmptyState();
  }

  draftSubjects.forEach(addSubject);

  subjectsBody.querySelectorAll("[data-subject-chip]").forEach(chip => {
    chip.addEventListener("click", () => addSubject(chip.dataset.subjectChip));
  });

  addButton.addEventListener("click", () => {
    addSubject(input.value);
    input.value = "";
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      addButton.click();
    }
  });

  selected.addEventListener("click", event => {
    const removeButton = event.target.closest("button");
    if (!removeButton) return;
    removeButton.closest("[data-selected-subject]")?.remove();
    syncEmptyState();
  });

  syncEmptyState();
}

function getSelectedSchoolSubjects() {
  return [...document.querySelectorAll("#scheduleSubjectsBody [data-selected-subject]")]
    .map(item => item.dataset.selectedSubject)
    .filter(Boolean);
}

function renderScheduleTeachers(typeId) {
  const teachersBody = document.querySelector("#scheduleTeachersBody");
  const teachersTitle = document.querySelector("#scheduleTeachersTitle");
  const teacherStep = scheduleTeacherSteps[typeId];
  if (!teachersBody || !teachersTitle || !teacherStep) return;

  const subjects = getSelectedSchoolSubjects();
  const draftTeachers = getDraftSchoolTeachers(typeId);
  teachersTitle.textContent = teacherStep.title;

  if (!subjects.length) {
    teachersBody.innerHTML = `
      <p class="scenario-note">Предметы пока не выбраны. Вернитесь назад и выберите хотя бы один предмет, чтобы указать преподавателей.</p>
    `;
    return;
  }

  teachersBody.innerHTML = `
    <div class="scenario-grid">
      ${subjects.map(subject => `
        <label class="field-block">
          <span>${escapeHtml(subject)}</span>
          <input type="text" placeholder="Фамилия, имя, отчество" value="${escapeHtml(draftTeachers[subject] || "")}" />
        </label>
      `).join("")}
    </div>
    <p class="scenario-note">${teacherStep.note}</p>
  `;
}

function renderScheduleDayLessons(typeId) {
  const dayLessonsBody = document.querySelector("#scheduleDayLessonsBody");
  const dayLessonsTitle = document.querySelector("#scheduleDayLessonsTitle");
  const dayStep = scheduleDayLessonSteps[typeId];
  if (!dayLessonsBody || !dayLessonsTitle || !dayStep) return;

  const subjects = getSelectedSchoolSubjects();
  const day = dayStep.days[schoolDayLessonIndex] || dayStep.days[0];
  schoolDayLessonsByDay[day.key] ||= [];
  dayLessonsTitle.textContent = day.title;

  if (!subjects.length) {
    dayLessonsBody.innerHTML = `
      <p class="scenario-note">Предметы пока не выбраны. Вернитесь к шагу «Предметы», чтобы собрать уроки на день.</p>
    `;
    return;
  }

  dayLessonsBody.innerHTML = `
    <div class="day-lessons">
      <div class="day-lessons__days" aria-label="Дни недели">
        ${dayStep.days.map((item, index) => `
          <button
            class="day-lessons__day ${index === schoolDayLessonIndex ? "is-active" : ""}"
            type="button"
            data-school-day-index="${index}"
            aria-pressed="${index === schoolDayLessonIndex ? "true" : "false"}"
          >
            ${item.short}
          </button>
        `).join("")}
      </div>
      <div class="day-lessons__subject-area">
        <span>Добавить урок</span>
        <div class="mini-chip-row mini-chip-row--large" aria-label="Выбор предмета для дня">
          ${subjects.map((subject, index) => `<button class="mini-chip" type="button" data-day-lesson-subject-index="${index}">${escapeHtml(subject)}</button>`).join("")}
        </div>
      </div>
      <div class="day-lessons__list-area">
        <span>Уроки на этот день</span>
        <div class="day-lessons__list" data-day-lessons-list>
          <p class="day-lessons__empty">Уроков пока нет</p>
          ${schoolDayLessonsByDay[day.key].map(subject => `
            <div class="day-lesson-row" data-day-lesson-row>
              <strong><span data-day-lesson-number></span> ${escapeHtml(subject)}</strong>
              <button type="button" aria-label="Удалить урок ${escapeHtml(subject)}">×</button>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
    <p class="scenario-note">${dayStep.note}</p>
  `;

  const list = dayLessonsBody.querySelector("[data-day-lessons-list]");

  function syncLessonNumbers() {
    const rows = [...list.querySelectorAll("[data-day-lesson-row]")];
    schoolDayLessonsByDay[day.key] = rows.map(row => row.dataset.lessonSubject).filter(Boolean);
    rows.forEach((row, index) => {
      row.querySelector("[data-day-lesson-number]").textContent = `${index + 1}.`;
    });
    const empty = list.querySelector(".day-lessons__empty");
    if (empty) empty.hidden = rows.length > 0;
  }

  function addLesson(subject) {
    const row = document.createElement("div");
    row.className = "day-lesson-row";
    row.dataset.dayLessonRow = "true";
    row.dataset.lessonSubject = subject;
    row.innerHTML = `
      <strong><span data-day-lesson-number></span> ${escapeHtml(subject)}</strong>
      <button type="button" aria-label="Удалить урок ${escapeHtml(subject)}">×</button>
    `;
    list.append(row);
    syncLessonNumbers();
  }

  dayLessonsBody.querySelectorAll("[data-day-lesson-row]").forEach(row => {
    const subjectText = row.querySelector("strong")?.textContent.replace(/^\d+\.\s*/, "").trim();
    row.dataset.lessonSubject = subjectText || "";
  });

  dayLessonsBody.querySelectorAll("[data-day-lesson-subject-index]").forEach(button => {
    button.addEventListener("click", () => addLesson(subjects[Number(button.dataset.dayLessonSubjectIndex)]));
  });

  dayLessonsBody.querySelectorAll("[data-school-day-index]").forEach(button => {
    button.addEventListener("click", () => {
      syncLessonNumbers();
      schoolDayLessonIndex = Number(button.dataset.schoolDayIndex);
      renderScheduleDayLessons(typeId);
    });
  });

  list.addEventListener("click", event => {
    const removeButton = event.target.closest("button");
    if (!removeButton) return;
    removeButton.closest("[data-day-lesson-row]")?.remove();
    syncLessonNumbers();
  });

  syncLessonNumbers();
}

function renderSchedulePlace(typeId) {
  const placeBody = document.querySelector("#schedulePlaceBody");
  const placeTitle = document.querySelector("#schedulePlaceTitle");
  const place = schedulePlaceSteps[typeId];
  if (!placeBody || !placeTitle || !place) return;

  placeTitle.textContent = place.title;
  placeBody.innerHTML = `
    <div class="scenario-grid">
      ${place.fields.map(field => `
        <label class="field-block">
          <span>${field.label}</span>
          <input type="text" placeholder="${field.placeholder}" />
        </label>
      `).join("")}
    </div>
    <p class="scenario-note">${place.note}</p>
  `;
}

function renderScheduleReminder(typeId) {
  const reminderBody = document.querySelector("#scheduleReminderBody");
  const reminderTitle = document.querySelector("#scheduleReminderTitle");
  const reminder = scheduleReminderSteps[typeId];
  if (!reminderBody || !reminderTitle || !reminder) return;

  const draftReminder = scheduleEditDraft?.type === typeId ? scheduleEditDraft.reminder : "";
  const activeReminder = reminder.options.includes(draftReminder) ? draftReminder : reminder.options[0];
  reminderTitle.textContent = reminder.title;
  reminderBody.innerHTML = `
    <div class="choice-grid choice-grid--reminders" aria-label="${reminder.title}">
      ${reminder.options.map(option => `
        <button
          class="choice-card choice-card--compact ${option === activeReminder ? "choice-card--active" : ""}"
          type="button"
          data-reminder-option="${option}"
          aria-pressed="${option === activeReminder ? "true" : "false"}"
        >
          <span>${option}</span>
        </button>
      `).join("")}
    </div>
    <p class="scenario-note">${reminder.note}</p>
  `;

  reminderBody.querySelectorAll("[data-reminder-option]").forEach(button => {
    button.addEventListener("click", () => {
      reminderBody.querySelectorAll("[data-reminder-option]").forEach(item => {
        const isActive = item === button;
        item.classList.toggle("choice-card--active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });
    });
  });
}

function renderScheduleColor(typeId) {
  const colorBody = document.querySelector("#scheduleColorBody");
  const colorTitle = document.querySelector("#scheduleColorTitle");
  const colorStep = scheduleColorSteps[typeId];
  if (!colorBody || !colorTitle || !colorStep) return;

  const draftColor = scheduleEditDraft?.type === typeId ? scheduleEditDraft.color : "";
  const selectedColor = colorStep.colors.includes(draftColor) ? draftColor : colorStep.defaultColor;
  const draftNote = scheduleEditDraft?.type === typeId ? scheduleEditDraft.note || "" : "";
  const isDraftActive = scheduleEditDraft?.type === typeId ? scheduleEditDraft.isActive !== false : true;
  const statusLabel = isDraftActive ? "Активно" : "Пауза";
  colorTitle.textContent = colorStep.title;
  colorBody.innerHTML = `
    <label class="field-block">
      <span>Заметка</span>
      <textarea placeholder="${colorStep.notePlaceholder}">${escapeHtml(draftNote)}</textarea>
    </label>
    <div class="schedule-color-field">
      <span class="schedule-color-field__label">Цвет расписания</span>
      <div class="schedule-color-palette" aria-label="Цвет расписания">
        ${colorStep.colors.map(color => `
          <button
            class="schedule-color-dot ${color === selectedColor ? "is-selected" : ""}"
            type="button"
            style="--schedule-color:${color}"
            data-schedule-color="${color}"
            aria-label="Выбрать цвет ${color}"
            aria-pressed="${color === selectedColor ? "true" : "false"}"
          ></button>
        `).join("")}
      </div>
    </div>
    <button class="schedule-status-toggle ${isDraftActive ? "is-active" : ""}" type="button" aria-pressed="${isDraftActive ? "true" : "false"}">
      <span>${statusLabel}</span>
      <i aria-hidden="true"></i>
    </button>
  `;

  colorBody.querySelectorAll("[data-schedule-color]").forEach(button => {
    button.addEventListener("click", () => {
      colorBody.querySelectorAll("[data-schedule-color]").forEach(item => {
        const isSelected = item === button;
        item.classList.toggle("is-selected", isSelected);
        item.setAttribute("aria-pressed", String(isSelected));
      });
    });
  });

  const statusToggle = colorBody.querySelector(".schedule-status-toggle");
  statusToggle?.addEventListener("click", () => {
    const isActive = !statusToggle.classList.contains("is-active");
    statusToggle.classList.toggle("is-active", isActive);
    statusToggle.setAttribute("aria-pressed", String(isActive));
    statusToggle.querySelector("span").textContent = isActive ? "Активно" : "Пауза";
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function runBackgroundSync(syncAction, collectionKey = "") {
  if (collectionKey) {
    setSyncCollectionState(collectionKey, { status: "pending" });
  }

  try {
    Promise.resolve(syncAction())
      .then(result => {
        if (collectionKey) {
          updateSyncCollectionFromResult(collectionKey, result);
        }

        if (result?.status === "offline") {
          setSyncStatus("Локальные данные сохранены. Синхронизация повторится при подключении.");
        }
      })
      .catch(() => {
        if (collectionKey) {
          setSyncCollectionState(collectionKey, { status: "failed" });
        }

        setSyncStatus("Локальные данные сохранены. Синхронизация повторится при подключении.");
      });
  } catch {
    if (collectionKey) {
      setSyncCollectionState(collectionKey, { status: "failed" });
    }

    setSyncStatus("Локальные данные сохранены. Синхронизация повторится при подключении.");
  }
}

function loadLegacySavedSchedules() {
  return readLegacyScheduleList(LEGACY_SCHEDULES_KEY);
}

function saveSchedulesLocally(schedules) {
  return scheduleStorage.saveSchedules(schedules).catch(() => {
    try {
      localStorage.setItem(LEGACY_SCHEDULES_KEY, JSON.stringify(schedules));
    } catch {
      // Keep the current in-memory list if persistent browser storage is unavailable.
    }
  });
}

function persistSavedSchedules() {
  const schedulesSnapshot = [...savedSchedules];
  saveSchedulesLocally(schedulesSnapshot);
  runBackgroundSync(() => scheduleSync.pushSchedules(schedulesSnapshot), "schedules");
}

function loadLegacySavedTasks() {
  return readLegacyScheduleList(LEGACY_TASKS_KEY);
}

function saveTasksLocally(tasksList) {
  const normalizedTasks = normalizeTaskList(tasksList);
  return scheduleStorage.saveTasks(normalizedTasks).catch(() => {
    try {
      localStorage.setItem(LEGACY_TASKS_KEY, JSON.stringify(normalizedTasks));
    } catch {
      // Keep the current in-memory list if persistent browser storage is unavailable.
    }
  });
}

function persistSavedTasks() {
  const tasksSnapshot = normalizeTaskList(savedTasks);
  savedTasks = tasksSnapshot;
  saveTasksLocally(tasksSnapshot);
  runBackgroundSync(() => scheduleSync.pushTasks(tasksSnapshot), "tasks");
}

function loadLegacySavedNotes() {
  return readLegacyScheduleList(LEGACY_NOTES_KEY);
}

function saveNotesLocally(notesList) {
  const normalizedNotes = normalizeNoteList(notesList);
  return scheduleStorage.saveNotes(normalizedNotes).catch(() => {
    try {
      localStorage.setItem(LEGACY_NOTES_KEY, JSON.stringify(normalizedNotes));
    } catch {
      // Keep the current in-memory list if persistent browser storage is unavailable.
    }
  });
}

function persistSavedNotes() {
  const notesSnapshot = normalizeNoteList(savedNotes);
  savedNotes = notesSnapshot;
  saveNotesLocally(notesSnapshot);
  runBackgroundSync(() => scheduleSync.pushNotes(notesSnapshot), "notes");
}

function loadLegacySavedBirthdays() {
  return readLegacyScheduleList(LEGACY_BIRTHDAYS_KEY);
}

function saveBirthdaysLocally(birthdaysList) {
  const normalizedBirthdays = normalizeBirthdayList(birthdaysList);
  return scheduleStorage.saveBirthdays(normalizedBirthdays).catch(() => {
    try {
      localStorage.setItem(LEGACY_BIRTHDAYS_KEY, JSON.stringify(normalizedBirthdays));
    } catch {
      // Keep the current in-memory list if persistent browser storage is unavailable.
    }
  });
}

function persistSavedBirthdays() {
  const birthdaysSnapshot = normalizeBirthdayList(savedBirthdays);
  savedBirthdays = birthdaysSnapshot;
  saveBirthdaysLocally(birthdaysSnapshot);
  runBackgroundSync(() => scheduleSync.pushBirthdays(birthdaysSnapshot), "birthdays");
}

function loadLegacySavedDiaryEntries() {
  return readLegacyScheduleList(LEGACY_DIARY_KEY);
}

function saveDiaryEntriesLocally(entriesList) {
  const normalizedEntries = normalizeDiaryEntryList(entriesList);
  return scheduleStorage.saveDiaryEntries(normalizedEntries).catch(() => {
    try {
      localStorage.setItem(LEGACY_DIARY_KEY, JSON.stringify(normalizedEntries));
    } catch {
      // Keep the current in-memory diary list if persistent browser storage is unavailable.
    }
  });
}

function persistSavedDiaryEntries() {
  const entriesSnapshot = normalizeDiaryEntryList(savedDiaryEntries);
  savedDiaryEntries = entriesSnapshot;
  saveDiaryEntriesLocally(entriesSnapshot);
  runBackgroundSync(() => scheduleSync.pushDiaryEntries(entriesSnapshot), "diary");
}

function saveRemindersLocally(reminders) {
  return scheduleStorage.saveReminders(reminders).catch(() => {
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
    } catch {
      // Keep reminders scheduled in memory if persistent browser storage is unavailable.
    }
  });
}

async function persistLocalReminders() {
  const remindersSnapshot = [...localReminders];
  await saveRemindersLocally(remindersSnapshot);
  runBackgroundSync(() => scheduleSync.pushReminders(remindersSnapshot), "reminders");
}

function setReminderStatus(message) {
  const status = document.querySelector("#reminderStatus");
  if (status) {
    status.textContent = message;
  }
}

function getPendingReminderCount() {
  const now = Date.now();
  return localReminders.filter(reminder => !reminder.deliveredAt && new Date(reminder.scheduledAt).getTime() > now).length;
}

function getNextPendingReminder() {
  const now = Date.now();
  return localReminders
    .filter(reminder => !reminder.deliveredAt && new Date(reminder.scheduledAt).getTime() > now)
    .sort((first, second) => new Date(first.scheduledAt).getTime() - new Date(second.scheduledAt).getTime())[0] || null;
}

function getReminderState(reminder, now = Date.now()) {
  const scheduledAt = new Date(reminder.scheduledAt).getTime();

  if (reminder.deliveredAt) {
    return "delivered";
  }

  if (!Number.isFinite(scheduledAt)) {
    return "overdue";
  }

  return scheduledAt > now ? "active" : "overdue";
}

function getReminderStateLabel(state) {
  const labelsByState = {
    active: "Запланировано",
    overdue: "Просрочено",
    delivered: "Доставлено",
  };

  return labelsByState[state] || "Напоминание";
}

function formatReminderDateTime(reminder) {
  if (reminder.date && reminder.time) {
    return `${reminder.date}, ${reminder.time}`;
  }

  const date = new Date(reminder.scheduledAt);
  if (!Number.isFinite(date.getTime())) {
    return "Дата не задана";
  }

  return `${formatDateValue(date)} ${formatTimeValue(date)}`;
}

function matchesReminderFilter(reminder) {
  if (reminderFilter === "all") {
    return true;
  }

  return getReminderState(reminder) === reminderFilter;
}

function getReminderFilterCounts() {
  return localReminders.reduce((counts, reminder) => {
    const state = getReminderState(reminder);
    counts.all += 1;
    counts[state] += 1;
    return counts;
  }, {
    active: 0,
    overdue: 0,
    delivered: 0,
    all: 0,
  });
}

function syncReminderFilters() {
  const counts = getReminderFilterCounts();

  document.querySelectorAll("[data-reminder-filter]").forEach(button => {
    const isActive = button.dataset.reminderFilter === reminderFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    const count = button.querySelector(".schedule-filter-count");
    if (count) {
      count.textContent = String(counts[button.dataset.reminderFilter] ?? 0);
    }
  });
}

function renderReminderList() {
  const list = document.querySelector("#savedRemindersList");
  if (!list) return;

  syncReminderFilters();
  renderReminderPushDiagnostics();

  if (!localReminders.length) {
    list.innerHTML = `
      <div class="saved-schedules-empty">
        <strong>Напоминаний пока нет.</strong>
        <span>Добавьте первое напоминание, и оно появится здесь на всех подключенных устройствах.</span>
      </div>
    `;
    return;
  }

  const filteredReminders = localReminders
    .filter(matchesReminderFilter)
    .sort(compareRemindersForList);

  if (!filteredReminders.length) {
    list.innerHTML = `
      <div class="saved-schedules-empty">
        <strong>В этом разделе пока пусто.</strong>
        <span>Переключите фильтр или добавьте новое напоминание.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = filteredReminders.map(reminder => {
    const state = getReminderState(reminder);
    const deliveredText = reminder.deliveredAt ? `Доставлено: ${formatReminderDeliveredAt(reminder.deliveredAt)}` : "";

    return `
      <article class="saved-reminder-card saved-reminder-card--${state}" data-reminder-card="${escapeHtml(reminder.id)}">
        <div class="saved-reminder-card__main">
          <span class="saved-reminder-card__status">${escapeHtml(getReminderStateLabel(state))}</span>
          <h3>${escapeHtml(reminder.title)}</h3>
          <p>${escapeHtml(formatReminderDateTime(reminder))}</p>
          ${deliveredText ? `<small>${escapeHtml(deliveredText)}</small>` : ""}
        </div>
        <div class="saved-reminder-card__actions">
          <button class="icon-button icon-button--tiny" type="button" aria-label="Редактировать напоминание" data-edit-reminder="${escapeHtml(reminder.id)}">
            <span class="icon icon-edit"></span>
          </button>
          <button class="icon-button icon-button--tiny" type="button" aria-label="Удалить напоминание" data-delete-reminder="${escapeHtml(reminder.id)}">
            <span class="icon icon-trash"></span>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function getReminderPushSummary(state = reminderPushDiagnostics) {
  const permission = focusNotifications.getPermission();
  const device = getDeviceRuntimeProfile();
  const countText = getReminderCountText();

  if (state?.message) {
    return state.message;
  }

  if (!device.isSecure) {
    return `Push-уведомления требуют защищённый HTTPS-адрес. Откройте приложение через основной домен.${countText}`;
  }

  if (device.isIos && !device.isStandalone) {
    return `На iPhone/iPad push-уведомления проверяются после установки PWA на экран «Домой».${countText}`;
  }

  if (!device.pushApiSupported) {
    return `Этот браузер не поддерживает серверные push-уведомления. Локальные данные и синхронизация останутся доступны.${countText}`;
  }

  if (permission === "denied") {
    return `Уведомления заблокированы в браузере. Напоминания сохраняются и синхронизируются.${countText}`;
  }

  if (permission === "unsupported") {
    return `Этот браузер не поддерживает системные уведомления. Серверная синхронизация данных останется доступной.${countText}`;
  }

  if (permission !== "granted") {
    return `Разрешите уведомления, чтобы получать напоминания на этом устройстве.${countText}`;
  }

  if (state?.config?.configured === false) {
    return `Разрешение есть, но серверные push-ключи пока не настроены.${countText}`;
  }

  if (state?.status?.deviceRegistered) {
    return `Это устройство подключено к серверным push-напоминаниям.${countText}`;
  }

  if (state?.status?.status === "offline") {
    return `Разрешение есть, но серверная проверка временно недоступна.${countText}`;
  }

  return `Разрешение есть. Нажмите «Проверить», чтобы обновить статус серверной подписки.${countText}`;
}

function getDeviceRuntimeProfile() {
  const root = document.documentElement;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIpadOs = platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || isIpadOs;
  const isAndroid = /Android/.test(userAgent);
  const isStandalone = root.dataset.displayMode === "standalone"
    || window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;
  const isSecure = window.location.protocol === "https:"
    || window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1";
  const pushApiSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  return {
    isAndroid,
    isIos,
    isSecure,
    isStandalone,
    pushApiSupported,
  };
}

function getDevicePlatformLabel(device = getDeviceRuntimeProfile()) {
  if (device.isIos) return "iPhone/iPad";
  if (device.isAndroid) return "Android";
  return "Desktop";
}

function getPushEnablePreflightMessage(device = getDeviceRuntimeProfile()) {
  if (!device.isSecure) {
    return "Push-уведомления доступны только через защищенный HTTPS-адрес. Откройте https://focus-v2.dmnao83.ru.";
  }

  if (device.isIos && !device.isStandalone) {
    return "На iPhone/iPad сначала добавьте приложение на экран «Домой», откройте его с иконки «Фокус» и снова нажмите «Включить».";
  }

  if (!device.pushApiSupported) {
    return device.isAndroid
      ? "Этот Android-браузер не поддерживает Web Push. Откройте приложение в Chrome или установленной PWA."
      : "Этот браузер не поддерживает Web Push. Серверные уведомления на этом устройстве недоступны.";
  }

  return "";
}

function getReminderDeliveryDiagnosticItem(delivery = reminderPushDiagnostics?.delivery) {
  if (!delivery) {
    return { title: "Доставка", value: "Не проверена", status: "warn", action: "Нажмите «Проверить», чтобы сверить напоминания на сервере." };
  }

  if (delivery.status === "offline") {
    return { title: "Доставка", value: "Недоступна", status: "bad", action: "Серверная диагностика напоминаний временно недоступна." };
  }

  const stats = delivery.stats || {};
  const scanned = Number(stats.scanned) || 0;
  const attention = Array.isArray(delivery.attention) ? delivery.attention[0] : null;
  const attentionText = attention ? getReminderDeliveryAttentionText(attention) : "";

  if (!scanned) {
    return { title: "Доставка", value: "Нет напоминаний", status: "warn", action: "Создайте напоминание, чтобы проверить полный путь доставки." };
  }

  if (stats.invalid > 0) {
    return { title: "Доставка", value: "Есть ошибка", status: "bad", action: attentionText || "Одно из напоминаний сохранено с некорректной датой." };
  }

  if (stats.retryExhausted > 0) {
    return { title: "Доставка", value: "Лимит попыток", status: "bad", action: attentionText || "Сервер исчерпал попытки push-доставки для одного из напоминаний." };
  }

  if (stats.noSubscriptions > 0) {
    return { title: "Доставка", value: "Нет подписки", status: "bad", action: attentionText || "Включите push на этом устройстве и повторите проверку." };
  }

  if (stats.expired > 0) {
    return { title: "Доставка", value: "Есть просроченные", status: "warn", action: attentionText || "Просроченные напоминания уже вне окна надежной push-доставки." };
  }

  if (stats.retrying > 0) {
    return { title: "Доставка", value: `Повтор: ${stats.retrying}`, status: "warn", action: attentionText || "Сервер повторит push-доставку после короткой паузы." };
  }

  if (stats.due > 0) {
    return { title: "Доставка", value: `Ожидает: ${stats.due}`, status: "warn", action: attentionText || "Backend отправит due-напоминания при ближайшей проверке." };
  }

  if (stats.pending > 0) {
    return { title: "Доставка", value: `Запланировано: ${stats.pending}`, status: "ok", action: delivery.next ? `Ближайшее: ${formatReminderDeliveryItemTime(delivery.next)}.` : "Есть будущие напоминания для доставки." };
  }

  if ((stats.alreadyDelivered || 0) + (stats.alreadySent || 0) > 0) {
    return { title: "Доставка", value: "Доставлено", status: "ok", action: "Сервер видит уже доставленные напоминания и не отправит их повторно." };
  }

  return { title: "Доставка", value: "Готова", status: "ok", action: "Критичных проблем доставки не найдено." };
}

function getReminderDeliveryAttentionText(item) {
  const title = item?.title ? `«${item.title}»` : "одно напоминание";
  if (item?.state === "invalid") return `Проверьте дату: ${title}.`;
  if (item?.state === "expired") return `${title} уже вне окна надежной доставки.`;
  if (item?.state === "noSubscriptions") return `Для ${title} нет активной push-подписки.`;
  if (item?.state === "retrying") return `${title} ожидает повторной push-доставки.`;
  if (item?.state === "retryExhausted") return `${title} исчерпало попытки push-доставки.`;
  if (item?.state === "due") return `${title} ожидает ближайшей серверной отправки.`;
  return "";
}

function formatReminderDeliveryItemTime(item) {
  const date = new Date(item?.scheduledAt);
  return Number.isFinite(date.getTime()) ? `${formatDateValue(date)} ${formatTimeValue(date)}` : "время неизвестно";
}

function getPushEventStatusMeta(event) {
  if (event?.status === "sent") return { label: "Отправлено", className: "ok" };
  if (event?.status === "no-subscriptions") return { label: "Нет подписок", className: "warn" };
  if (event?.status === "retry-exhausted") return { label: "Лимит попыток", className: "bad" };
  if (event?.status === "empty") return { label: "Пусто", className: "warn" };
  return { label: "Ошибка", className: "bad" };
}

function getPushEventTitle(event) {
  if (event?.type === "test") return "Тест push";
  return event?.title ? `Напоминание: ${event.title}` : "Напоминание";
}

function formatPushEventTime(event) {
  const date = new Date(event?.createdAt);
  return Number.isFinite(date.getTime()) ? `${formatDateValue(date)} ${formatTimeValue(date)}` : "время неизвестно";
}

function formatPushEventRetryTime(event) {
  const date = new Date(event?.nextRetryAt);
  return Number.isFinite(date.getTime()) ? `${formatDateValue(date)} ${formatTimeValue(date)}` : "";
}

function getPushEventDetails(event) {
  const details = [
    `отправлено ${Number(event?.sent) || 0}`,
    `ошибок ${Number(event?.failed) || 0}`,
    `удалено ${Number(event?.removed) || 0}`,
  ];
  const attempts = Number(event?.attempts) || 0;
  const maxAttempts = Number(event?.maxAttempts) || 0;
  const nextRetryAt = formatPushEventRetryTime(event);

  if (attempts > 0 && maxAttempts > 0) {
    details.push(`попытка ${attempts}/${maxAttempts}`);
  } else if (attempts > 0) {
    details.push(`попытка ${attempts}`);
  }

  if (nextRetryAt) {
    details.push(`повтор ${nextRetryAt}`);
  }

  return details.join(" · ");
}

function renderPushEventLog(eventsState) {
  const events = Array.isArray(eventsState?.events) ? eventsState.events : [];

  if (eventsState?.status === "offline") {
    return `
      <div class="notification-events__empty">
        <strong>Журнал временно недоступен</strong>
        <span>Проверьте подключение и повторите проверку push.</span>
      </div>
    `;
  }

  if (!events.length) {
    return `
      <div class="notification-events__empty">
        <strong>Журнал пока пуст</strong>
        <span>Нажмите «Тест» или дождитесь ближайшего серверного напоминания.</span>
      </div>
    `;
  }

  return `
    <div class="notification-events__head">
      <strong>Последние доставки</strong>
      <span>${events.length}</span>
    </div>
    ${events.map(event => {
      const status = getPushEventStatusMeta(event);
      const details = getPushEventDetails(event);
      return `
        <article class="notification-event notification-event--${status.className}">
          <div>
            <strong>${escapeHtml(getPushEventTitle(event))}</strong>
            <span>${escapeHtml(formatPushEventTime(event))}</span>
          </div>
          <div>
            <em>${escapeHtml(status.label)}</em>
            <small>${escapeHtml(details)}</small>
          </div>
        </article>
      `;
    }).join("")}
  `;
}

function getReminderPushDiagnosticItems(state = reminderPushDiagnostics) {
  const permission = focusNotifications.getPermission();
  const device = getDeviceRuntimeProfile();
  const nextReminder = getNextPendingReminder();
  const environmentItem = (() => {
    if (!device.isSecure) {
      return {
        title: "Среда",
        value: "Нужен HTTPS",
        status: "bad",
        action: "Откройте https://focus-v2.dmnao83.ru.",
      };
    }

    if (device.isIos && !device.isStandalone) {
      return {
        title: "Среда",
        value: "iOS: нужна установка",
        status: "warn",
        action: "Safari → Поделиться → На экран «Домой».",
      };
    }

    if (device.pushApiSupported) {
      return {
        title: "Среда",
        value: `${getDevicePlatformLabel(device)} готов`,
        status: "ok",
        action: device.isStandalone ? "Приложение открыто как PWA." : "Push можно проверить в этом браузере.",
      };
    }

    return {
      title: "Среда",
      value: "Push API недоступен",
      status: "bad",
      action: "Проверьте актуальный браузер или установленное PWA.",
    };
  })();

  const permissionItem = (() => {
    if (permission === "granted") {
      return { title: "Разрешение", value: "Включено", status: "ok", action: "Можно отправить тестовое уведомление." };
    }
    if (permission === "denied") {
      return { title: "Разрешение", value: "Заблокировано", status: "bad", action: "Разрешите уведомления в настройках браузера или системы." };
    }
    if (permission === "unsupported") {
      return { title: "Разрешение", value: "Нет поддержки", status: "bad", action: "Системные уведомления недоступны в этом окружении." };
    }
    return { title: "Разрешение", value: "Не включено", status: "warn", action: "Нажмите «Включить» и подтвердите запрос." };
  })();

  const serverItem = (() => {
    if (!state) {
      return { title: "Сервер", value: "Не проверен", status: "warn", action: "Нажмите «Проверить»." };
    }
    if (state.status?.status === "offline") {
      return { title: "Сервер", value: "Недоступен", status: "bad", action: "Проверьте интернет и повторите проверку." };
    }
    if (state.config?.configured) {
      return { title: "Сервер", value: "Push-ключи готовы", status: "ok", action: "Backend готов отправлять напоминания." };
    }
    return { title: "Сервер", value: "Push-ключей нет", status: "bad", action: "Нужно настроить VAPID-ключи на сервере." };
  })();

  const deviceItem = (() => {
    if (!device.pushApiSupported) {
      return { title: "Устройство", value: "Push недоступен", status: "bad", action: "Серверная доставка на это устройство невозможна." };
    }
    if (device.isIos && !device.isStandalone) {
      return { title: "Устройство", value: "Не PWA", status: "warn", action: "Откройте приложение с иконки на экране «Домой»." };
    }
    if (permission !== "granted") {
      return { title: "Устройство", value: "Нужно разрешение", status: "warn", action: "Сначала включите уведомления." };
    }
    if (state?.status?.deviceRegistered) {
      return { title: "Устройство", value: "Подписано", status: "ok", action: "Тестовое push-уведомление доступно." };
    }
    if (state?.status?.status === "offline") {
      return { title: "Устройство", value: "Проверка недоступна", status: "bad", action: "Повторите после подключения к сети." };
    }
    return { title: "Устройство", value: "Не подписано", status: "warn", action: "Нажмите «Включить», затем «Проверить»." };
  })();

  const nextItem = nextReminder
    ? { title: "Ближайшее", value: formatReminderDateTime(nextReminder), status: "ok", action: "Это напоминание ожидает доставки." }
    : { title: "Ближайшее", value: "Нет активных", status: "warn", action: "Создайте напоминание на ближайшее время для проверки." };

  return [environmentItem, permissionItem, serverItem, deviceItem, getReminderDeliveryDiagnosticItem(state?.delivery), nextItem];
}

function renderReminderPushDiagnostics(state = reminderPushDiagnostics) {
  const summary = document.querySelector("#reminderPushSummary");
  const diagnostics = document.querySelector("#reminderPushDiagnostics");
  const events = document.querySelector("#reminderPushEvents");
  const enableButton = document.querySelector("#reminderPushEnableButton");
  const refreshButton = document.querySelector("#reminderPushRefreshButton");
  const testButton = document.querySelector("#reminderPushTestButton");
  const permission = focusNotifications.getPermission();
  const device = getDeviceRuntimeProfile();
  const needsServerRegistration = permission === "granted" &&
    device.pushApiSupported &&
    state?.config?.configured !== false &&
    !state?.status?.deviceRegistered;

  if (summary) {
    summary.textContent = getReminderPushSummary(state);
  }

  if (diagnostics) {
    diagnostics.innerHTML = getReminderPushDiagnosticItems(state).map(item => `
      <div class="notification-diagnostic notification-diagnostic--${item.status}">
        <strong><i aria-hidden="true"></i>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.value)}</span>
        ${item.action ? `<small>${escapeHtml(item.action)}</small>` : ""}
      </div>
    `).join("");
  }

  if (events) {
    events.innerHTML = renderPushEventLog(state?.events);
  }

  if (enableButton) {
    const canShowIosInstallHelp = device.isIos && !device.isStandalone;
    enableButton.hidden = permission === "granted" && !needsServerRegistration;
    enableButton.textContent = canShowIosInstallHelp
      ? "Как включить"
      : permission === "granted" ? "Подключить" : "Включить";
    enableButton.disabled = (permission === "denied" && !canShowIosInstallHelp) ||
      (permission === "unsupported" && !canShowIosInstallHelp) ||
      (!device.pushApiSupported && !canShowIosInstallHelp) ||
      (permission === "granted" && state?.config?.configured === false);
  }

  if (refreshButton) {
    refreshButton.disabled = false;
  }

  if (testButton) {
    testButton.disabled = permission !== "granted";
  }

  renderDeviceCheck();
}

async function refreshReminderPushDiagnostics({ register = false, message = "" } = {}) {
  const permission = focusNotifications.getPermission();
  const device = getDeviceRuntimeProfile();
  const state = {
    config: await scheduleSync.getPushConfig(),
    status: null,
    delivery: null,
    events: null,
    checkedAt: new Date().toISOString(),
    message,
  };

  if (permission === "granted") {
    if (register) {
      state.registration = await registerServerPushSubscription();
    }
    state.status = await scheduleSync.getPushSubscriptionStatus();

    if (
      !state.status?.deviceRegistered &&
      !state.registration &&
      device.pushApiSupported &&
      state.config?.configured
    ) {
      state.registration = await registerServerPushSubscription();
      state.status = await scheduleSync.getPushSubscriptionStatus();
    }

    if (!state.message && state.registration) {
      state.message = getReminderPushStatusMessage(state.registration);
    } else if (!state.message && state.status?.deviceRegistered) {
      state.message = getReminderPushStatusMessage(state.status);
    }
  }

  state.delivery = await scheduleSync.getReminderDeliveryStatus();
  state.events = await scheduleSync.getPushEvents();

  reminderPushDiagnostics = state;
  renderReminderPushDiagnostics(state);
  return state;
}

function compareRemindersForList(first, second) {
  const firstTime = new Date(first.scheduledAt).getTime();
  const secondTime = new Date(second.scheduledAt).getTime();
  const safeFirstTime = Number.isFinite(firstTime) ? firstTime : Number.MAX_SAFE_INTEGER;
  const safeSecondTime = Number.isFinite(secondTime) ? secondTime : Number.MAX_SAFE_INTEGER;

  if (reminderFilter === "delivered" || reminderFilter === "overdue") {
    return safeSecondTime - safeFirstTime;
  }

  return safeFirstTime - safeSecondTime;
}

function formatReminderDeliveredAt(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "время неизвестно";
  }

  return `${formatDateValue(date)} ${formatTimeValue(date)}`;
}

function formatDateValue(date) {
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getFullYear()),
  ].join(".");
}

function formatTimeValue(date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}

function updateReminderPermissionState(message) {
  const button = document.querySelector("#reminderPermissionButton");
  const testButton = document.querySelector("#reminderTestPushButton");
  const permission = focusNotifications.getPermission();

  if (button) {
    button.hidden = permission === "granted";
    button.disabled = permission === "denied" || permission === "unsupported";
  }

  if (testButton) {
    testButton.hidden = permission !== "granted";
    testButton.disabled = permission !== "granted";
  }

  if (message) {
    setReminderStatus(message);
    return;
  }

  const pendingCount = getPendingReminderCount();
  const countText = pendingCount ? ` Запланировано: ${pendingCount}.` : "";

  if (permission === "granted") {
    setReminderStatus(`Уведомления включены для этого устройства.${countText}`);
  } else if (permission === "denied") {
    setReminderStatus(`Уведомления заблокированы в браузере. Напоминания сохраняются локально.${countText}`);
  } else if (permission === "unsupported") {
    setReminderStatus(`Этот браузер не поддерживает системные уведомления. Напоминания сохраняются локально.${countText}`);
  } else {
    setReminderStatus(`Можно сохранить напоминание локально и включить уведомления для этого устройства.${countText}`);
  }
}

async function requestReminderPermission() {
  const permission = await focusNotifications.requestPermission();

  if (permission === "granted") {
    scheduleLocalReminders();
    const pushResult = await registerServerPushSubscription();
    updateReminderPermissionState(getReminderPushStatusMessage(pushResult));
    await refreshReminderPushDiagnostics({ message: getReminderPushStatusMessage(pushResult) });
  } else if (permission === "denied") {
    updateReminderPermissionState("Браузер заблокировал уведомления. Можно изменить разрешение в настройках сайта.");
    renderReminderPushDiagnostics({ message: "Браузер заблокировал уведомления. Можно изменить разрешение в настройках сайта." });
  } else {
    updateReminderPermissionState("Системные уведомления недоступны в этом браузере.");
    renderReminderPushDiagnostics({ message: "Системные уведомления недоступны в этом браузере." });
  }
}

async function enableReminderPushFromButton() {
  const device = getDeviceRuntimeProfile();
  const preflightMessage = getPushEnablePreflightMessage(device);

  if (preflightMessage) {
    updateReminderPermissionState(preflightMessage);
    renderReminderPushDiagnostics({ ...reminderPushDiagnostics, message: preflightMessage });
    return;
  }

  const enableButton = document.querySelector("#reminderPushEnableButton");
  const permissionButton = document.querySelector("#reminderPermissionButton");
  const enableButtonText = enableButton?.textContent || "Включить";
  const permissionButtonText = permissionButton?.textContent || "Включить уведомления";

  if (enableButton) {
    enableButton.disabled = true;
    enableButton.textContent = "Включаем...";
  }

  if (permissionButton) {
    permissionButton.disabled = true;
    permissionButton.textContent = "Включаем...";
  }

  try {
    await requestReminderPermission();
  } catch {
    const message = "Не удалось включить уведомления на этом устройстве. Проверьте разрешения сайта и повторите попытку.";
    updateReminderPermissionState(message);
    renderReminderPushDiagnostics({ ...reminderPushDiagnostics, message });
  } finally {
    if (focusNotifications.getPermission() !== "granted") {
      if (enableButton) {
        enableButton.disabled = false;
        enableButton.textContent = enableButtonText;
      }
      if (permissionButton) {
        permissionButton.disabled = false;
        permissionButton.textContent = permissionButtonText;
      }
    }
  }
}

function scheduleLocalReminders() {
  scheduledReminderIds.forEach(reminderId => focusNotifications.clearReminder(reminderId));
  scheduledReminderIds = new Set();

  const now = Date.now();
  const pendingReminders = localReminders.filter(reminder => {
    const scheduledAt = new Date(reminder.scheduledAt).getTime();
    return !reminder.deliveredAt && Number.isFinite(scheduledAt) && scheduledAt > now;
  });

  pendingReminders.forEach(reminder => {
    if (focusNotifications.schedule(reminder, markReminderDelivered)) {
      scheduledReminderIds.add(reminder.id);
    }
  });
}

async function markReminderDelivered(reminder) {
  const deliveredAt = new Date().toISOString();
  localReminders = localReminders.map(item => item.id === reminder.id ? { ...item, deliveredAt } : item);
  await persistLocalReminders();
  renderReminderList();
  updateReminderPermissionState();
}

async function hydrateLocalReminders() {
  try {
    localReminders = await scheduleStorage.migrateRemindersFromLocalStorage();
  } catch {
    localReminders = readLegacyScheduleList(REMINDERS_KEY);
  }

  await syncSavedReminders({ render: false });
  scheduleLocalReminders();
  renderReminderList();
  updateReminderPermissionState();
}

async function saveLocalReminder(onSaved) {
  const editingReminder = reminderEditId
    ? localReminders.find(reminder => reminder.id === reminderEditId)
    : null;
  const result = createLocalReminder({
    id: editingReminder?.id,
    title: document.querySelector("#reminderText")?.value,
    date: document.querySelector("#reminderDate")?.value,
    time: document.querySelector("#reminderTime")?.value,
    createdAt: editingReminder?.createdAt ? new Date(editingReminder.createdAt) : new Date(),
  });

  if (!result.ok) {
    const messages = {
      "empty-title": "Введите текст напоминания.",
      "invalid-date": "Введите дату в формате дд.мм.гггг и время в формате чч:мм.",
      "past-date": "Выберите будущие дату и время.",
    };
    updateReminderPermissionState(messages[result.error] || "Не удалось сохранить напоминание.");
    return;
  }

  localReminders = editingReminder
    ? localReminders.map(reminder => reminder.id === editingReminder.id ? result.reminder : reminder)
    : [result.reminder, ...localReminders];
  await persistLocalReminders();
  renderReminderList();

  const permission = focusNotifications.getPermission();

  if (permission === "default") {
    await focusNotifications.requestPermission();
  }

  const pushResult = focusNotifications.getPermission() === "granted"
    ? await registerServerPushSubscription()
    : null;

  scheduleLocalReminders();
  clearReminderForm();
  reminderEditId = null;
  renderReminderEditorState();
  updateReminderPermissionState(editingReminder ? "Напоминание обновлено." : getReminderSaveStatusMessage(pushResult));
  refreshReminderPushDiagnostics().catch(() => {
    renderReminderPushDiagnostics();
  });
  onSaved?.();
}

function clearReminderForm() {
  ["#reminderText", "#reminderDate", "#reminderTime"].forEach(selector => {
    const field = document.querySelector(selector);
    if (field) {
      field.value = "";
    }
  });
}

function prepareNewReminder() {
  reminderEditId = null;
  clearReminderForm();
  renderReminderEditorState();
}

function prepareReminderEdit(reminderId) {
  const reminder = localReminders.find(item => item.id === reminderId);
  if (!reminder) return false;

  reminderEditId = reminder.id;
  const textField = document.querySelector("#reminderText");
  const dateField = document.querySelector("#reminderDate");
  const timeField = document.querySelector("#reminderTime");

  if (textField) textField.value = reminder.title || "";
  if (dateField) dateField.value = reminder.date || "";
  if (timeField) timeField.value = reminder.time || "";
  renderReminderEditorState();
  return true;
}

function renderReminderEditorState() {
  const title = document.querySelector("#reminderTitle");
  const saveButton = document.querySelector("#reminderSaveButton");

  if (title) {
    title.textContent = reminderEditId ? "Редактировать напоминание" : "Напоминание";
  }

  if (saveButton) {
    saveButton.textContent = reminderEditId ? "Сохранить изменения" : "Сохранить";
  }
}

async function syncSavedSchedules({ render = true, track = true } = {}) {
  if (track) {
    setSyncCollectionState("schedules", { status: "syncing" });
  }

  try {
    const result = await scheduleSync.syncSchedules(savedSchedules);

    if (result.status === "pulled") {
      savedSchedules = result.schedules;
      await saveSchedulesLocally(savedSchedules);
      if (render) {
        renderSavedSchedules();
      }
    }

    if (track) {
      updateSyncCollectionFromResult("schedules", result);
    }

    return result;
  } catch (error) {
    if (track) {
      setSyncCollectionState("schedules", { status: "failed" });
    }
    throw error;
  }
}

async function syncSavedReminders({ render = true, track = true } = {}) {
  if (track) {
    setSyncCollectionState("reminders", { status: "syncing" });
  }

  try {
    const result = await scheduleSync.syncReminders(localReminders);

    if (result.status === "pulled") {
      localReminders = result.reminders;
      await saveRemindersLocally(localReminders);
    }

    if (render) {
      scheduleLocalReminders();
      renderReminderList();
      updateReminderPermissionState();
    }

    if (track) {
      updateSyncCollectionFromResult("reminders", result);
    }

    return result;
  } catch (error) {
    if (track) {
      setSyncCollectionState("reminders", { status: "failed" });
    }
    throw error;
  }
}

async function syncSavedTasks({ render = true, track = true } = {}) {
  if (track) {
    setSyncCollectionState("tasks", { status: "syncing" });
  }

  try {
    const result = await scheduleSync.syncTasks(savedTasks);

    if (result.status === "pulled") {
      savedTasks = normalizeTaskList(result.tasks);
      await saveTasksLocally(savedTasks);
    }

    if (render) {
      renderTasks();
    }

    if (track) {
      updateSyncCollectionFromResult("tasks", result);
    }

    return result;
  } catch (error) {
    if (track) {
      setSyncCollectionState("tasks", { status: "failed" });
    }
    throw error;
  }
}

async function syncSavedNotes({ render = true, track = true } = {}) {
  if (track) {
    setSyncCollectionState("notes", { status: "syncing" });
  }

  try {
    const result = await scheduleSync.syncNotes(savedNotes);

    if (result.status === "pulled") {
      savedNotes = normalizeNoteList(result.notes);
      await saveNotesLocally(savedNotes);
    }

    if (render) {
      renderNotes();
    }

    if (track) {
      updateSyncCollectionFromResult("notes", result);
    }

    return result;
  } catch (error) {
    if (track) {
      setSyncCollectionState("notes", { status: "failed" });
    }
    throw error;
  }
}

async function syncSavedBirthdays({ render = true, track = true } = {}) {
  if (track) {
    setSyncCollectionState("birthdays", { status: "syncing" });
  }

  try {
    const result = await scheduleSync.syncBirthdays(savedBirthdays);

    if (result.status === "pulled") {
      savedBirthdays = normalizeBirthdayList(result.birthdays);
      await saveBirthdaysLocally(savedBirthdays);
    }

    if (render) {
      renderBirthdays();
      renderCalendar();
      renderSummary();
    }

    if (track) {
      updateSyncCollectionFromResult("birthdays", result);
    }

    return result;
  } catch (error) {
    if (track) {
      setSyncCollectionState("birthdays", { status: "failed" });
    }
    throw error;
  }
}

async function syncSavedDiaryEntries({ render = true, track = true } = {}) {
  if (track) {
    setSyncCollectionState("diary", { status: "syncing" });
  }

  try {
    const result = await scheduleSync.syncDiaryEntries(savedDiaryEntries);

    if (result.status === "pulled") {
      savedDiaryEntries = normalizeDiaryEntryList(result.entries);
      await saveDiaryEntriesLocally(savedDiaryEntries);
    }

    if (render) {
      renderDiaryEntries();
      renderCalendar();
      renderSummary();
    }

    if (track) {
      updateSyncCollectionFromResult("diary", result);
    }

    return result;
  } catch (error) {
    if (track) {
      setSyncCollectionState("diary", { status: "failed" });
    }
    throw error;
  }
}

async function refreshSyncDataStatus() {
  const button = document.querySelector("#syncDataRefreshButton");

  if (!scheduleSync.peekAccountId()) {
    renderSyncDataStatus();
    setSyncStatus("Сначала создайте код синхронизации.");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Сверяем...";
    }

    const results = await Promise.allSettled([
      syncSavedSchedules(),
      syncSavedTasks(),
      syncSavedNotes(),
      syncSavedBirthdays(),
      syncSavedDiaryEntries(),
      syncSavedReminders(),
    ]);
    await refreshSyncAccountProfile().catch(() => null);

    const failedCount = results.filter(result => result.status === "rejected").length;
    setSyncStatus(failedCount
      ? `Часть данных не удалось сверить: ${failedCount}. Повторите после подключения.`
      : "Состояние данных обновлено.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Сверить";
    }
    renderSyncDataStatus();
  }
}

async function registerServerPushSubscription() {
  if (focusNotifications.getPermission() !== "granted") {
    return { status: "permission-required" };
  }

  const config = await scheduleSync.getPushConfig();
  if (!config.configured || !config.publicKey) {
    return { status: "not-configured" };
  }

  const pushSubscription = await focusNotifications.subscribePush(config.publicKey);
  if (pushSubscription.status !== "subscribed") {
    return pushSubscription;
  }

  return scheduleSync.savePushSubscription(pushSubscription.subscription);
}

async function refreshReminderPushStatus() {
  if (focusNotifications.getPermission() !== "granted") {
    renderReminderPushDiagnostics();
    return null;
  }

  const status = await scheduleSync.getPushSubscriptionStatus();
  updateReminderPermissionState(getReminderPushStatusMessage(status));
  await refreshReminderPushDiagnostics({ message: getReminderPushStatusMessage(status) });
  return status;
}

async function sendTestPushNotification() {
  if (focusNotifications.getPermission() !== "granted") {
    deviceCheckPushTestState = "blocked";
    updateReminderPermissionState("Сначала включите уведомления для этого устройства.");
    renderDeviceCheck();
    return;
  }

  const registration = await registerServerPushSubscription();
  if (registration.status !== "saved") {
    deviceCheckPushTestState = registration.status === "offline" || registration.status === "failed" ? "failed" : "blocked";
    updateReminderPermissionState(getReminderPushStatusMessage(registration));
    await refreshReminderPushDiagnostics({ message: getReminderPushStatusMessage(registration) });
    renderDeviceCheck();
    return;
  }

  const result = await scheduleSync.sendTestPushNotification();

  if (result.status === "sent") {
    deviceCheckPushTestState = "sent";
    updateReminderPermissionState("Тестовое push-уведомление отправлено на это устройство.");
    await refreshReminderPushDiagnostics({ message: "Тестовое push-уведомление отправлено на это устройство." });
  } else if (result.status === "empty") {
    deviceCheckPushTestState = "blocked";
    updateReminderPermissionState("Для этого устройства пока нет серверной push-подписки.");
    await refreshReminderPushDiagnostics({ message: "Для этого устройства пока нет серверной push-подписки." });
  } else if (result.status === "not-configured") {
    deviceCheckPushTestState = "blocked";
    updateReminderPermissionState("Серверные push-уведомления пока не настроены.");
    await refreshReminderPushDiagnostics({ message: "Серверные push-уведомления пока не настроены." });
  } else {
    deviceCheckPushTestState = "failed";
    updateReminderPermissionState("Не удалось отправить тестовое push-уведомление. Проверьте подключение.");
    await refreshReminderPushDiagnostics({ message: "Не удалось отправить тестовое push-уведомление. Проверьте подключение." });
  }

  renderDeviceCheck();
}

function getReminderPushStatusMessage(result) {
  const countText = getReminderCountText();

  if (result?.status === "saved" || result?.deviceRegistered) {
    return `Уведомления включены. Это устройство подключено к серверным push-напоминаниям.${countText}`;
  }

  if (result?.status === "not-configured") {
    return `Уведомления включены локально. Серверные push-ключи пока не настроены.${countText}`;
  }

  if (result?.status === "unsupported") {
    return `Уведомления включены локально, но этот браузер не поддерживает серверные push-напоминания.${countText}`;
  }

  if (result?.status === "permission-required") {
    return `Сначала разрешите уведомления на этом устройстве, затем повторите подключение push.${countText}`;
  }

  if (result?.status === "permission-denied") {
    return `Система заблокировала push-подписку. Разрешите уведомления в настройках сайта или приложения и повторите попытку.${countText}`;
  }

  if (result?.status === "permission-dismissed") {
    return `Запрос уведомлений был закрыт без разрешения. Нажмите «Включить» и подтвердите системный запрос.${countText}`;
  }

  if (result?.status === "service-worker-not-ready") {
    return `PWA ещё обновляет офлайн-основу. Закройте приложение, откройте снова и повторите включение уведомлений.${countText}`;
  }

  if (result?.status === "insecure-context") {
    return `Push-уведомления доступны только через HTTPS. Откройте https://focus-v2.dmnao83.ru и повторите попытку.${countText}`;
  }

  if (result?.status === "failed") {
    return `Уведомления включены локально. Не удалось создать серверную push-подписку.${countText}`;
  }

  if (result?.status === "offline") {
    return `Уведомления включены локально. Серверная проверка временно недоступна.${countText}`;
  }

  return `Уведомления включены для этого устройства.${countText}`;
}

function getReminderSaveStatusMessage(pushResult) {
  if (pushResult?.status === "saved") {
    return "Напоминание сохранено. Серверные push-напоминания подключены.";
  }

  if (pushResult?.status === "offline") {
    return "Напоминание сохранено локально. Серверная push-синхронизация повторится при подключении.";
  }

  return "Напоминание сохранено на этом устройстве.";
}

function getReminderCountText() {
  const pendingCount = getPendingReminderCount();
  return pendingCount ? ` Запланировано: ${pendingCount}.` : "";
}

function setSyncStatus(message) {
  const status = document.querySelector("#syncStatus");
  if (status) {
    status.textContent = message;
  }
}

function setSyncCollectionState(collectionKey, patch) {
  if (!syncCollectionStates[collectionKey]) return;
  syncCollectionStates[collectionKey] = {
    ...syncCollectionStates[collectionKey],
    ...patch,
    updatedAt: patch.updatedAt === undefined ? new Date().toISOString() : patch.updatedAt,
  };
  renderSyncDataStatus();
}

function resetSyncCollectionStates() {
  syncCollectionItems.forEach(item => {
    syncCollectionStates[item.key] = { status: "idle", updatedAt: "", revision: 0 };
  });
  renderSyncDataStatus();
}

function updateSyncCollectionFromResult(collectionKey, result) {
  const status = result?.status || "idle";
  const normalizedStatus = ["pushed", "pulled", "idle", "offline"].includes(status) ? status : "idle";
  setSyncCollectionState(collectionKey, {
    status: normalizedStatus,
    revision: Number(result?.revision || syncCollectionStates[collectionKey]?.revision || 0),
  });
}

function getSyncCollectionBadge(collectionState, accountId) {
  if (!accountId) return { label: "Не включено", tone: "warn" };

  switch (collectionState?.status) {
    case "pushed":
      return { label: "Отправлено", tone: "ok" };
    case "pulled":
      return { label: "Получено", tone: "ok" };
    case "syncing":
      return { label: "Сверяем", tone: "warn" };
    case "pending":
      return { label: "Ожидает", tone: "warn" };
    case "offline":
      return { label: "Нет сети", tone: "warn" };
    case "failed":
      return { label: "Ошибка", tone: "bad" };
    default:
      return { label: "Готово", tone: "ok" };
  }
}

function getSyncCollectionDetails(item, collectionState, accountId) {
  const countText = `Записей: ${item.getCount()}.`;

  if (!accountId) {
    return `${countText} Создайте код синхронизации.`;
  }

  switch (collectionState?.status) {
    case "pushed":
      return `${countText} Последняя отправка: ${formatSyncTimestamp(collectionState.updatedAt)}.`;
    case "pulled":
      return `${countText} Загружено с сервера: ${formatSyncTimestamp(collectionState.updatedAt)}.`;
    case "syncing":
      return `${countText} Идёт сверка с сервером.`;
    case "pending":
      return `${countText} Ожидает фоновой отправки.`;
    case "offline":
      return `${countText} Будет отправлено после подключения.`;
    case "failed":
      return `${countText} Повторите сверку после подключения.`;
    default:
      return `${countText} Локальная копия готова.`;
  }
}

function renderSyncDataStatus() {
  const summary = document.querySelector("#syncDataSummary");
  const list = document.querySelector("#syncDataList");
  const accountId = scheduleSync.peekAccountId();

  if (summary) {
    const pendingCount = syncCollectionItems.filter(item => {
      const status = syncCollectionStates[item.key]?.status;
      return status === "pending" || status === "offline" || status === "failed";
    }).length;

    if (!accountId) {
      summary.textContent = "Создайте код синхронизации, чтобы отправлять данные на другие устройства.";
    } else if (pendingCount) {
      summary.textContent = `Есть разделы, ожидающие повторной синхронизации: ${pendingCount}.`;
    } else {
      summary.textContent = "Локальные данные готовы к работе на нескольких устройствах.";
    }
  }

  if (!list) return;

  list.innerHTML = syncCollectionItems.map(item => {
    const collectionState = syncCollectionStates[item.key] || {};
    const badge = getSyncCollectionBadge(collectionState, accountId);
    return `
      <article class="sync-data-item sync-data-item--${escapeHtml(collectionState.status || "idle")}">
        <div class="sync-data-item__head">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="sync-data-status sync-data-status--${escapeHtml(badge.tone)}">${escapeHtml(badge.label)}</span>
        </div>
        <small>${escapeHtml(getSyncCollectionDetails(item, collectionState, accountId))}</small>
      </article>
    `;
  }).join("");
}

function mergeAccountEntitlements(entitlements = {}) {
  const defaults = createDefaultAccountEntitlements();
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const entitlement = entitlements?.[key];
    return [
      key,
      entitlement && typeof entitlement === "object"
        ? { ...fallback, ...entitlement, enabled: entitlement.enabled === true }
        : fallback,
    ];
  }));
}

function resetAccountEntitlementsState(status = "idle") {
  accountEntitlementsState = {
    status,
    accountId: scheduleSync.peekAccountId(),
    checkedAt: "",
    entitlements: createDefaultAccountEntitlements(),
    usage: createDefaultAccountFeatureUsage(),
  };
  accountEntitlementEventsState = createEmptyAccountEntitlementEventsState(status);
  accountTranscriptionStatusState = createEmptyAccountTranscriptionStatusState(status);
  accountTranscriptionEventsState = createEmptyAccountTranscriptionEventsState(status);
  paidFeatureCheckoutState = {
    status: "idle",
    featureKey: "",
  };
  renderPaidFeatureSurfaces();
}

function getPaidFeatureEntitlement(featureKey) {
  return mergeAccountEntitlements(accountEntitlementsState.entitlements)[featureKey] ||
    createDefaultAccountEntitlements()[featureKey];
}

function getPaidFeatureStatus(feature) {
  const accountId = scheduleSync.peekAccountId();
  const entitlement = getPaidFeatureEntitlement(feature.key);

  if (!accountId) {
    return {
      tone: "warn",
      label: "Нужен аккаунт",
      detail: "Подключите аккаунт, чтобы активировать подписку на нескольких устройствах.",
      actionLabel: "Настроить",
      disabled: false,
    };
  }

  if (accountEntitlementsState.status === "loading") {
    return {
      tone: "warn",
      label: "Проверяем",
      detail: "Сверяем доступ с сервером подписок.",
      actionLabel: "Проверяем",
      disabled: true,
    };
  }

  if (accountEntitlementsState.status === "offline") {
    return {
      tone: "bad",
      label: "Нет связи",
      detail: "Последнюю версию доступа не удалось получить. Повторите проверку после подключения.",
      actionLabel: "Проверить",
      disabled: false,
    };
  }

  if (entitlement?.enabled) {
    const expiresText = entitlement.expiresAt
      ? ` Действует до ${formatSyncTimestamp(entitlement.expiresAt)}.`
      : "";

    return {
      tone: "ok",
      label: "Активно",
      detail: `Функция доступна этому аккаунту и будет включаться в местах ввода текста.${expiresText}`,
      actionLabel: "Включено",
      disabled: true,
    };
  }

  if (entitlement?.source === "expired") {
    return {
      tone: "warn",
      label: "Истёк",
      detail: entitlement.expiresAt
        ? `Срок действия закончился ${formatSyncTimestamp(entitlement.expiresAt)}. Можно оформить доступ заново.`
        : "Срок действия закончился. Можно оформить доступ заново.",
      actionLabel: "Оформить",
      disabled: false,
    };
  }

  if (paidFeatureCheckoutState.featureKey === feature.key) {
    if (paidFeatureCheckoutState.status === "loading") {
      return {
        tone: "warn",
        label: "Оформляем",
        detail: "Готовим безопасный переход к оплате подписки.",
        actionLabel: "Оформляем",
        disabled: true,
      };
    }

    if (paidFeatureCheckoutState.status === "provider-not-configured") {
      return {
        tone: "warn",
        label: "Провайдер не настроен",
        detail: "Backend-контракт готов, но платёжный провайдер ещё не подключён.",
        actionLabel: "Оформить",
        disabled: false,
      };
    }

    if (paidFeatureCheckoutState.status === "offline") {
      return {
        tone: "bad",
        label: "Нет связи",
        detail: "Не удалось создать переход к оплате. Повторите после подключения к сети.",
        actionLabel: "Повторить",
        disabled: false,
      };
    }

    if (paidFeatureCheckoutState.status === "failed") {
      return {
        tone: "bad",
        label: "Ошибка",
        detail: "Переход к оплате не был создан. Повторите попытку позже.",
        actionLabel: "Повторить",
        disabled: false,
      };
    }
  }

  return {
    tone: "warn",
    label: "По подписке",
    detail: "Функция готовится к запуску. Нажмите «Оформить», чтобы проверить готовность перехода к оплате.",
    actionLabel: "Оформить",
    disabled: false,
  };
}

function getPaidFeatureSourceLabel(source) {
  if (source === "yookassa") return "ЮKassa";
  if (source === "subscription") return "подписка";
  if (source === "manual") return "ручная активация";
  if (source === "trial") return "пробный доступ";
  if (source === "expired") return "срок истёк";
  return "не активировано";
}

function getPaidFeatureMetaText(entitlement) {
  if (entitlement?.enabled && entitlement.expiresAt) {
    return `Действует до: ${formatSyncTimestamp(entitlement.expiresAt)}.`;
  }

  if (entitlement?.source === "expired" && entitlement.expiresAt) {
    return `Истёк: ${formatSyncTimestamp(entitlement.expiresAt)}.`;
  }

  if (entitlement?.updatedAt) {
    return `Обновлено: ${formatSyncTimestamp(entitlement.updatedAt)}.`;
  }

  return `Источник: ${getPaidFeatureSourceLabel(entitlement?.source)}.`;
}

function getPaidFeatureUsage(featureKey) {
  const source = accountEntitlementsState.usage && typeof accountEntitlementsState.usage === "object"
    ? accountEntitlementsState.usage
    : {};
  return source[featureKey] || null;
}

function getPaidFeatureUsageTone(usage) {
  if (!usage?.limit) return "warn";
  if (usage.remaining <= 0) return "bad";
  if (usage.remaining / usage.limit <= 0.2) return "warn";
  return "ok";
}

function getPaidFeatureUsageText(featureKey) {
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    return "Лимит транскрибации появится после подключения аккаунта.";
  }

  if (accountEntitlementsState.status === "loading") {
    return "Загружаем лимит транскрибации.";
  }

  if (accountEntitlementsState.status === "offline") {
    return "Лимит транскрибации сейчас недоступен.";
  }

  const usage = getPaidFeatureUsage(featureKey);
  if (!usage?.limit) {
    return "Лимит транскрибации ещё не проверен.";
  }

  const resetText = usage.resetAt ? ` Обновится: ${formatSyncTimestamp(usage.resetAt)}.` : "";
  return `Использовано ${usage.used} из ${usage.limit}. Осталось ${usage.remaining}.${resetText}`;
}

function renderPaidFeatureUsageDiagnostics(featureKey) {
  const usage = getPaidFeatureUsage(featureKey);
  const tone = getPaidFeatureUsageTone(usage);
  const usedPercent = usage?.limit
    ? Math.min(100, Math.max(0, Math.round((usage.used / usage.limit) * 100)))
    : 0;

  return `
    <div class="paid-feature-usage paid-feature-usage--${escapeHtml(tone)}">
      <span>Лимит</span>
      <strong>${escapeHtml(getPaidFeatureUsageText(featureKey))}</strong>
      <div class="paid-feature-usage__bar" aria-hidden="true">
        <i style="width: ${usedPercent}%"></i>
      </div>
    </div>
  `;
}

function normalizeEntitlementEvents(events = []) {
  if (!Array.isArray(events)) return [];

  return events
    .filter(event => event && typeof event === "object")
    .map(event => ({
      id: String(event.id || ""),
      featureKey: String(event.featureKey || ""),
      origin: String(event.origin || ""),
      status: String(event.status || ""),
      source: String(event.source || "none"),
      paymentId: event.paymentId ? String(event.paymentId) : "",
      paymentStatus: event.paymentStatus ? String(event.paymentStatus) : "",
      paid: event.paid === true,
      reason: event.reason ? String(event.reason) : "",
      expiresAt: event.expiresAt ? String(event.expiresAt) : "",
      createdAt: event.createdAt ? String(event.createdAt) : "",
    }));
}

function normalizeTranscriptionEvents(events = []) {
  if (!Array.isArray(events)) return [];

  return events
    .filter(event => event && typeof event === "object")
    .map(event => ({
      id: String(event.id || ""),
      status: String(event.status || ""),
      provider: event.provider ? String(event.provider) : "",
      reason: event.reason ? String(event.reason) : "",
      mimeType: event.mimeType ? String(event.mimeType) : "",
      durationMs: Number.isFinite(Number(event.durationMs)) ? Math.max(0, Number(event.durationMs)) : 0,
      language: event.language ? String(event.language) : "",
      textLength: Number.isFinite(Number(event.textLength)) ? Math.max(0, Number(event.textLength)) : 0,
      spent: event.spent === true,
      usage: event.usage && typeof event.usage === "object" ? event.usage : null,
      createdAt: event.createdAt ? String(event.createdAt) : "",
    }));
}

function normalizePositiveInteger(value) {
  const normalizedValue = Math.floor(Number(value));
  return Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue : 0;
}

function normalizeTranscriptionStatus(result, accountId) {
  if (!result || typeof result !== "object") {
    return createEmptyAccountTranscriptionStatusState("offline");
  }

  return {
    status: result.status || "ok",
    accountId: result.accountId || accountId,
    checkedAt: result.checkedAt ? String(result.checkedAt) : "",
    providerConfigured: result.providerConfigured === true,
    provider: result.provider ? String(result.provider) : null,
    providerModel: result.providerModel ? String(result.providerModel) : null,
    monthlyLimit: normalizePositiveInteger(result.monthlyLimit),
    maxDurationMs: normalizePositiveInteger(result.maxDurationMs),
  };
}

function getEntitlementEventFeatureTitle(featureKey) {
  return paidFeatureItems.find(feature => feature.key === featureKey)?.title || "Платная функция";
}

function getEntitlementEventStatus(event) {
  if (event.status === "activated") return { label: "Включено", tone: "ok" };
  if (event.status === "disabled") return { label: "Отключено", tone: "bad" };
  if (event.status === "failed") return { label: "Ошибка", tone: "bad" };
  if (event.status === "canceled") return { label: "Отменено", tone: "bad" };
  if (event.status === "ignored") return { label: "Пропущено", tone: "warn" };
  return { label: "Событие", tone: "warn" };
}

function getEntitlementEventOriginLabel(origin) {
  if (origin === "admin") return "оператор";
  if (origin === "yookassa-webhook") return "YooKassa webhook";
  if (origin === "yookassa-status") return "проверка оплаты";
  return "источник неизвестен";
}

function getEntitlementEventReasonLabel(reason) {
  if (reason === "payment_already_applied") return "платёж уже применён";
  if (reason === "event_not_activating") return "событие не активирует доступ";
  if (reason === "feature_missing") return "функция не найдена";
  if (reason === "account_missing") return "аккаунт не найден";
  if (reason === "account_mismatch") return "аккаунт платежа не совпал";
  if (reason === "provider_unavailable") return "провайдер недоступен";
  if (reason === "provider_api_error") return "ошибка провайдера";
  if (reason === "network_error") return "ошибка сети";
  return reason;
}

function getTranscriptionEventStatus(event) {
  if (event.status === "transcribed") return { label: "Готово", tone: "ok" };
  if (event.status === "locked") return { label: "Нет доступа", tone: "warn" };
  if (event.status === "usage_limit_exceeded") return { label: "Лимит", tone: "warn" };
  if (event.status === "provider_not_configured") return { label: "Провайдер", tone: "warn" };
  if (event.status === "failed") return { label: "Ошибка", tone: "bad" };
  if (event.status === "invalid") return { label: "Запрос", tone: "bad" };
  return { label: "Событие", tone: "warn" };
}

function getTranscriptionEventReasonLabel(reason) {
  if (reason === "feature_locked") return "подписка не активна";
  if (reason === "invalid_transcription_request") return "запись не подходит для отправки";
  if (reason === "usage_limit_exceeded") return "месячный лимит исчерпан";
  if (reason === "provider_not_configured") return "STT-провайдер ещё не настроен";
  if (reason === "provider_error") return "ошибка STT-провайдера";
  if (reason === "provider_auth_failed") return "ошибка ключа STT-провайдера";
  if (reason === "provider_rate_limited") return "лимит STT-провайдера";
  if (reason === "provider_rejected_audio") return "провайдер отклонил аудио";
  if (reason === "provider_unavailable") return "STT-провайдер недоступен";
  if (reason === "empty_transcription") return "провайдер вернул пустой текст";
  if (reason === "no_audio") return "аудио не передано";
  if (reason === "network_error") return "ошибка сети";
  return reason;
}

function formatTranscriptionDuration(durationMs) {
  const normalizedDurationMs = Math.max(0, Number(durationMs) || 0);
  if (!normalizedDurationMs) return "";
  if (normalizedDurationMs < 1000) return "менее 1 сек";
  return `${Math.max(1, Math.round(normalizedDurationMs / 1000))} сек`;
}

function getEntitlementEventDetails(event) {
  const details = [getEntitlementEventOriginLabel(event.origin)];

  if (event.source && event.source !== "none") {
    details.push(getPaidFeatureSourceLabel(event.source));
  }

  if (event.paymentStatus) {
    details.push(`статус оплаты: ${event.paymentStatus}`);
  }

  if (event.paymentId) {
    details.push(`платёж: ${event.paymentId.slice(0, 18)}`);
  }

  if (event.reason) {
    details.push(getEntitlementEventReasonLabel(event.reason));
  }

  if (event.expiresAt) {
    details.push(`до ${formatSyncTimestamp(event.expiresAt)}`);
  }

  return details.filter(Boolean).join(" · ");
}

function getTranscriptionEventDetails(event) {
  const details = [];

  if (event.provider) {
    details.push(`провайдер: ${event.provider}`);
  }

  if (event.reason) {
    details.push(getTranscriptionEventReasonLabel(event.reason));
  }

  if (event.mimeType) {
    details.push(event.mimeType);
  }

  const durationText = formatTranscriptionDuration(event.durationMs);
  if (durationText) {
    details.push(`длительность: ${durationText}`);
  }

  if (event.language) {
    details.push(event.language);
  }

  if (event.status === "transcribed") {
    details.push(`символов: ${event.textLength}`);
  }

  if (event.spent) {
    details.push("лимит списан");
  }

  if (event.usage?.limit) {
    details.push(`остаток: ${event.usage.remaining}/${event.usage.limit}`);
  }

  return details.filter(Boolean).join(" · ") || "детали не указаны";
}

function getEntitlementEventsSummary() {
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    return "Подключите аккаунт, чтобы видеть историю доступа к подписочным функциям.";
  }

  if (accountEntitlementEventsState.status === "loading") {
    return "Загружаем последние события доступа.";
  }

  if (accountEntitlementEventsState.status === "offline") {
    return "Историю доступа сейчас не удалось получить. Повторите после подключения.";
  }

  if (!accountEntitlementEventsState.events.length) {
    return "Событий доступа пока нет. Они появятся после активации, отключения или проверки оплаты.";
  }

  return `Последние события доступа: ${accountEntitlementEventsState.events.length}.`;
}

function renderEntitlementEventsPanel() {
  const panel = document.querySelector("#paidFeatureEventsPanel");
  const summary = document.querySelector("#paidFeatureEventsSummary");
  const list = document.querySelector("#paidFeatureEventsList");

  if (!panel || !summary || !list) return;

  summary.textContent = getEntitlementEventsSummary();

  if (!scheduleSync.peekAccountId()) {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Аккаунт не подключён</strong>
          <small>История доступа хранится на сервере синхронизации для конкретного аккаунта.</small>
        </div>
      </article>
    `;
    return;
  }

  if (accountEntitlementEventsState.status === "loading") {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Загрузка</strong>
          <small>Проверяем последние изменения доступа.</small>
        </div>
      </article>
    `;
    return;
  }

  if (accountEntitlementEventsState.status === "offline") {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Нет связи</strong>
          <small>События останутся на сервере и загрузятся после восстановления подключения.</small>
        </div>
      </article>
    `;
    return;
  }

  if (!accountEntitlementEventsState.events.length) {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Журнал пока пуст</strong>
          <small>После оплаты, webhook, проверки статуса или ручной активации здесь появится запись.</small>
        </div>
      </article>
    `;
    return;
  }

  list.innerHTML = accountEntitlementEventsState.events.map(event => {
    const status = getEntitlementEventStatus(event);
    const eventTime = event.createdAt ? formatSyncTimestamp(event.createdAt) : "время не указано";
    return `
      <article class="paid-feature-event">
        <div>
          <strong>${escapeHtml(getEntitlementEventFeatureTitle(event.featureKey))}</strong>
          <small>${escapeHtml(eventTime)} · ${escapeHtml(getEntitlementEventDetails(event))}</small>
        </div>
        <span class="paid-feature-event__status paid-feature-event__status--${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
      </article>
    `;
  }).join("");
}

function getTranscriptionEventsSummary() {
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    return "Подключите аккаунт, чтобы видеть журнал серверной транскрибации.";
  }

  const readinessSummary = getTranscriptionReadinessSummary();
  let eventsSummary = "";

  if (accountTranscriptionEventsState.status === "loading") {
    eventsSummary = "Загружаем последние попытки диктовки.";
  } else if (accountTranscriptionEventsState.status === "offline") {
    eventsSummary = "Журнал диктовки сейчас недоступен. Повторите после подключения.";
  } else if (!accountTranscriptionEventsState.events.length) {
    eventsSummary = "Попыток серверной транскрибации пока нет. Они появятся после диктовки через запись аудио.";
  } else {
    eventsSummary = `Последние попытки диктовки: ${accountTranscriptionEventsState.events.length}.`;
  }

  return readinessSummary ? `${readinessSummary} ${eventsSummary}` : eventsSummary;
}

function getTranscriptionReadinessSummary() {
  if (accountTranscriptionStatusState.status === "loading") {
    return "Проверяем готовность серверной транскрибации.";
  }

  if (accountTranscriptionStatusState.status === "offline") {
    return "Готовность серверной транскрибации сейчас недоступна.";
  }

  if (accountTranscriptionStatusState.status !== "ok") {
    return "";
  }

  if (!accountTranscriptionStatusState.providerConfigured) {
    return "STT-провайдер ещё не подключён. Записи будут попадать в журнал как «Провайдер».";
  }

  const limitText = accountTranscriptionStatusState.monthlyLimit
    ? `лимит ${accountTranscriptionStatusState.monthlyLimit} в месяц`
    : "лимит не указан";
  const durationText = accountTranscriptionStatusState.maxDurationMs
    ? `максимальная запись ${formatTranscriptionDuration(accountTranscriptionStatusState.maxDurationMs)}`
    : "максимальная длительность не указана";
  const providerText = accountTranscriptionStatusState.provider || "сервер";
  const modelText = accountTranscriptionStatusState.providerModel
    ? `, модель ${accountTranscriptionStatusState.providerModel}`
    : "";

  return `STT-провайдер готов: ${providerText}${modelText}. ${limitText}, ${durationText}.`;
}

function renderTranscriptionEventsPanel() {
  const panel = document.querySelector("#transcriptionEventsPanel");
  const summary = document.querySelector("#transcriptionEventsSummary");
  const list = document.querySelector("#transcriptionEventsList");

  if (!panel || !summary || !list) return;

  summary.textContent = getTranscriptionEventsSummary();

  if (!scheduleSync.peekAccountId()) {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Аккаунт не подключён</strong>
          <small>Серверный журнал диктовки хранится отдельно для каждого аккаунта синхронизации.</small>
        </div>
      </article>
    `;
    return;
  }

  if (accountTranscriptionEventsState.status === "loading") {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Загрузка</strong>
          <small>Проверяем последние попытки серверной транскрибации.</small>
        </div>
      </article>
    `;
    return;
  }

  if (accountTranscriptionEventsState.status === "offline") {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Нет связи</strong>
          <small>Журнал останется на сервере и загрузится после восстановления подключения.</small>
        </div>
      </article>
    `;
    return;
  }

  if (!accountTranscriptionEventsState.events.length) {
    list.innerHTML = `
      <article class="paid-feature-event paid-feature-event--empty">
        <div>
          <strong>Журнал пока пуст</strong>
          <small>После диктовки через запись аудио здесь появится статус: готово, лимит, провайдер или ошибка.</small>
        </div>
      </article>
    `;
    return;
  }

  list.innerHTML = accountTranscriptionEventsState.events.map(event => {
    const status = getTranscriptionEventStatus(event);
    const eventTime = event.createdAt ? formatSyncTimestamp(event.createdAt) : "время не указано";
    return `
      <article class="paid-feature-event">
        <div>
          <strong>Серверная диктовка</strong>
          <small>${escapeHtml(eventTime)} · ${escapeHtml(getTranscriptionEventDetails(event))}</small>
        </div>
        <span class="paid-feature-event__status paid-feature-event__status--${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
      </article>
    `;
  }).join("");
}

function getPaidFeaturesSummary() {
  const accountId = scheduleSync.peekAccountId();
  const activeCount = paidFeatureItems.filter(feature => getPaidFeatureEntitlement(feature.key)?.enabled).length;

  if (!accountId) {
    return "Подключите аккаунт, чтобы будущая подписка работала на компьютере и мобильных устройствах.";
  }

  if (accountEntitlementsState.status === "loading") {
    return "Проверяем доступные функции этого аккаунта.";
  }

  if (accountEntitlementsState.status === "offline") {
    return "Сервер подписки временно недоступен. Локальные данные остаются на устройстве.";
  }

  if (activeCount) {
    return `Активных функций: ${activeCount}. Доступ будет синхронизироваться между устройствами аккаунта.`;
  }

  return "Платные функции пока закрыты. Каркас готов для подключения оплаты и активации.";
}

function renderPaidFeaturesPanel() {
  const summary = document.querySelector("#paidFeaturesSummary");
  const list = document.querySelector("#paidFeaturesList");
  const refreshButton = document.querySelector("#paidFeaturesRefreshButton");

  if (summary) {
    summary.textContent = getPaidFeaturesSummary();
  }

  if (refreshButton) {
    refreshButton.disabled = accountEntitlementsState.status === "loading";
    refreshButton.textContent = accountEntitlementsState.status === "loading" ? "Проверяем..." : "Обновить";
  }

  if (!list) return;

  list.innerHTML = paidFeatureItems.map(feature => {
    const status = getPaidFeatureStatus(feature);
    const entitlement = getPaidFeatureEntitlement(feature.key);
    const updatedText = getPaidFeatureMetaText(entitlement);

    return `
      <article class="paid-feature-card paid-feature-card--${escapeHtml(status.tone)}" data-paid-feature-card="${escapeHtml(feature.key)}">
        <div class="paid-feature-card__main">
          <strong><i aria-hidden="true"></i>${escapeHtml(feature.title)}</strong>
          <span>${escapeHtml(feature.description)}</span>
          <small>${escapeHtml(feature.priceLabel)}. ${escapeHtml(status.detail)} ${escapeHtml(updatedText)}</small>
          ${renderPaidFeatureUsageDiagnostics(feature.key)}
        </div>
        <div class="paid-feature-card__side">
          <span class="paid-feature-status paid-feature-status--${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
          <a class="secondary-link secondary-link--compact" href="${escapeHtml(feature.subscriptionUrl)}">Условия и цена</a>
          <button class="secondary-button secondary-button--compact" type="button" data-paid-feature-action="${escapeHtml(feature.key)}"${status.disabled ? " disabled" : ""}>${escapeHtml(status.actionLabel)}</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderUsefulSubscriptionPanel() {
  const panel = document.querySelector("#usefulSubscriptionPanel");
  if (!panel) return;

  const feature = paidFeatureItems.find(item => item.key === "voiceTranscription");
  if (!feature) {
    panel.hidden = true;
    return;
  }

  const status = getPaidFeatureStatus(feature);
  panel.hidden = false;
  panel.className = `useful-subscription-panel useful-subscription-panel--${status.tone}`;
  panel.innerHTML = `
    <div>
      <span class="modal-kicker">Подписка</span>
      <h3>${escapeHtml(feature.title)}</h3>
      <p>${escapeHtml(feature.description)}</p>
      <small>${escapeHtml(feature.priceLabel)}. ${escapeHtml(status.detail)}</small>
      ${renderPaidFeatureUsageDiagnostics(feature.key)}
    </div>
    <div class="useful-subscription-panel__actions">
      <a class="secondary-link" href="${escapeHtml(feature.subscriptionUrl)}">Условия и цена</a>
      <button class="secondary-button" type="button" data-paid-feature-action="${escapeHtml(feature.key)}"${status.disabled ? " disabled" : ""}>${escapeHtml(status.actionLabel)}</button>
    </div>
  `;
}

function renderPaidFeatureSurfaces() {
  renderPaidFeaturesPanel();
  renderEntitlementEventsPanel();
  renderTranscriptionEventsPanel();
  renderUsefulSubscriptionPanel();
  renderVoiceInputControls();
}

async function refreshAccountEntitlements({ silent = false } = {}) {
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    resetAccountEntitlementsState("local");
    if (!silent) {
      setSyncStatus("Сначала подключите аккаунт. После этого подписка будет проверяться на сервере.");
    }
    return accountEntitlementsState;
  }

  accountEntitlementsState = {
    ...accountEntitlementsState,
    status: "loading",
    accountId,
  };
  renderPaidFeatureSurfaces();

  try {
    const result = await scheduleSync.getAccountEntitlements();
    accountEntitlementsState = {
      status: result.status || "ok",
      accountId: result.accountId || accountId,
      checkedAt: result.checkedAt || new Date().toISOString(),
      entitlements: mergeAccountEntitlements(result.entitlements),
      usage: result.usage || createDefaultAccountFeatureUsage(),
    };

    if (!silent) {
      setSyncStatus(accountEntitlementsState.status === "offline"
        ? "Не удалось проверить подписку. Повторите после подключения к сети."
        : "Доступ к платным функциям обновлён.");
    }
  } catch {
    accountEntitlementsState = {
      status: "offline",
      accountId,
      checkedAt: "",
      entitlements: createDefaultAccountEntitlements(),
      usage: createDefaultAccountFeatureUsage(),
    };
    if (!silent) {
      setSyncStatus("Не удалось проверить подписку. Повторите после подключения к сети.");
    }
  }

  renderPaidFeatureSurfaces();
  return accountEntitlementsState;
}

async function refreshEntitlementEvents({ silent = false } = {}) {
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    accountEntitlementEventsState = createEmptyAccountEntitlementEventsState("local");
    renderEntitlementEventsPanel();
    return accountEntitlementEventsState;
  }

  accountEntitlementEventsState = {
    ...accountEntitlementEventsState,
    status: "loading",
    accountId,
  };
  renderEntitlementEventsPanel();

  try {
    const result = await scheduleSync.getEntitlementEvents();
    accountEntitlementEventsState = {
      status: result.status || "ok",
      accountId: result.accountId || accountId,
      checkedAt: new Date().toISOString(),
      events: normalizeEntitlementEvents(result.events),
    };
    if (!silent && accountEntitlementEventsState.status !== "offline") {
      setSyncStatus("История доступа к подписочным функциям обновлена.");
    }
  } catch {
    accountEntitlementEventsState = {
      status: "offline",
      accountId,
      checkedAt: "",
      events: [],
    };
    if (!silent) {
      setSyncStatus("Не удалось загрузить историю доступа. Повторите после подключения.");
    }
  }

  renderEntitlementEventsPanel();
  return accountEntitlementEventsState;
}

async function refreshTranscriptionEvents({ silent = false } = {}) {
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    accountTranscriptionStatusState = createEmptyAccountTranscriptionStatusState("local");
    accountTranscriptionEventsState = createEmptyAccountTranscriptionEventsState("local");
    renderTranscriptionEventsPanel();
    return accountTranscriptionEventsState;
  }

  accountTranscriptionStatusState = {
    ...accountTranscriptionStatusState,
    status: "loading",
    accountId,
  };
  accountTranscriptionEventsState = {
    ...accountTranscriptionEventsState,
    status: "loading",
    accountId,
  };
  renderTranscriptionEventsPanel();

  try {
    const [statusResult, eventsResult] = await Promise.all([
      scheduleSync.getTranscriptionStatus(),
      scheduleSync.getTranscriptionEvents(),
    ]);
    accountTranscriptionStatusState = normalizeTranscriptionStatus(statusResult, accountId);
    accountTranscriptionEventsState = {
      status: eventsResult.status || "ok",
      accountId: eventsResult.accountId || accountId,
      checkedAt: new Date().toISOString(),
      events: normalizeTranscriptionEvents(eventsResult.events),
    };
    if (
      !silent &&
      accountTranscriptionStatusState.status !== "offline" &&
      accountTranscriptionEventsState.status !== "offline"
    ) {
      setSyncStatus("Журнал диктовки обновлён.");
    }
  } catch {
    accountTranscriptionStatusState = {
      ...createEmptyAccountTranscriptionStatusState("offline"),
      accountId,
    };
    accountTranscriptionEventsState = {
      status: "offline",
      accountId,
      checkedAt: "",
      events: [],
    };
    if (!silent) {
      setSyncStatus("Не удалось загрузить журнал диктовки. Повторите после подключения.");
    }
  }

  renderTranscriptionEventsPanel();
  return accountTranscriptionEventsState;
}

function setPaidFeatureCheckoutState(patch) {
  paidFeatureCheckoutState = {
    ...paidFeatureCheckoutState,
    ...patch,
  };
  renderPaidFeatureSurfaces();
}

async function startPaidFeatureCheckout(feature, openModal) {
  openModal?.("sync");
  setPaidFeatureCheckoutState({ status: "loading", featureKey: feature.key });
  setSyncStatus("Готовим переход к оплате подписки...");

  const result = await scheduleSync.createSubscriptionCheckout({ featureKey: feature.key });

  if (result.status === "ready" && result.checkoutUrl) {
    setPaidFeatureCheckoutState({ status: "ready", featureKey: feature.key });
    setSyncStatus("Открываем страницу оплаты подписки.");
    window.location.assign(result.checkoutUrl);
    return;
  }

  if (result.status === "provider-not-configured") {
    setPaidFeatureCheckoutState({ status: "provider-not-configured", featureKey: feature.key });
    setSyncStatus("Платёжный провайдер ещё не настроен. Контракт checkout уже готов, следующий шаг — подключить провайдера и webhook активации.");
    return;
  }

  if (result.status === "offline") {
    setPaidFeatureCheckoutState({ status: "offline", featureKey: feature.key });
    setSyncStatus("Не удалось создать переход к оплате. Проверьте подключение и повторите попытку.");
    return;
  }

  setPaidFeatureCheckoutState({ status: "failed", featureKey: feature.key });
  setSyncStatus("Не удалось подготовить оплату подписки. Повторите попытку позже.");
}

async function checkPendingSubscriptionCheckout({ silent = true } = {}) {
  const pendingCheckout = scheduleSync.getPendingSubscriptionCheckout?.();
  if (!pendingCheckout) {
    return null;
  }

  const result = await scheduleSync.getSubscriptionCheckoutStatus({ paymentId: pendingCheckout.paymentId });
  const featureKey = result.featureKey || pendingCheckout.featureKey;
  const feature = paidFeatureItems.find(item => item.key === featureKey);
  const featureTitle = feature?.title || "Платная функция";

  if (result.status === "activated") {
    if (result.entitlements) {
      accountEntitlementsState = {
        status: "ok",
        accountId: result.accountId || pendingCheckout.accountId,
        checkedAt: new Date().toISOString(),
        entitlements: mergeAccountEntitlements(result.entitlements),
        usage: result.usage || createDefaultAccountFeatureUsage(),
      };
      renderPaidFeatureSurfaces();
    }

    await refreshAccountEntitlements({ silent: true });
    await refreshEntitlementEvents({ silent: true });

    if (!silent) {
      setSyncStatus(`Оплата подтверждена. ${featureTitle} включён для этого аккаунта.`);
    }
    return result;
  }

  if (!silent) {
    if (result.status === "pending") {
      setSyncStatus("Оплата ещё не подтверждена. Проверка повторится после возврата или подключения к сети.");
    } else if (result.status === "canceled") {
      setSyncStatus("Оплата отменена. Доступ к платной функции не изменён.");
    } else if (result.status === "provider-not-configured") {
      setSyncStatus("Платёжный провайдер ещё не настроен, поэтому статус оплаты проверить нельзя.");
    } else if (result.status === "offline") {
      setSyncStatus("Не удалось проверить оплату. Проверка повторится после подключения к сети.");
    } else {
      setSyncStatus("Не удалось подтвердить оплату. Доступ к платной функции не изменён.");
    }
  }

  renderPaidFeatureSurfaces();
  if (result.status && result.status !== "pending") {
    refreshEntitlementEvents({ silent: true }).catch(() => {
      renderEntitlementEventsPanel();
    });
  }
  return result;
}

async function handlePaidFeatureAction(featureKey, openModal) {
  const feature = paidFeatureItems.find(item => item.key === featureKey);
  if (!feature) return;

  const accountId = scheduleSync.peekAccountId();
  const entitlement = getPaidFeatureEntitlement(featureKey);

  if (!accountId) {
    openModal?.("sync");
    setSyncStatus("Сначала подключите аккаунт. После этого можно будет оформить подписку на голосовой ввод.");
    return;
  }

  if (accountEntitlementsState.status === "offline") {
    refreshAccountEntitlements();
    return;
  }

  if (entitlement?.enabled) {
    setSyncStatus(`${feature.title} уже активен для этого аккаунта.`);
    return;
  }

  await startPaidFeatureCheckout(feature, openModal);
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getMediaRecorderConstructor() {
  return window.MediaRecorder || null;
}

function isServerVoiceRecordingSupported() {
  return Boolean(
    typeof navigator !== "undefined"
    && navigator.mediaDevices?.getUserMedia
    && getMediaRecorderConstructor()
  );
}

function getVoiceRecordingMimeType() {
  const MediaRecorderConstructor = getMediaRecorderConstructor();
  if (!MediaRecorderConstructor?.isTypeSupported) {
    return "";
  }

  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ].find(type => MediaRecorderConstructor.isTypeSupported(type)) || "";
}

function isTextInputControl(element) {
  return Boolean(element && (
    element.tagName === "TEXTAREA"
    || (element.tagName === "INPUT" && ["", "text", "search"].includes(String(element.type || "").toLowerCase()))
  ) && !element.disabled && !element.readOnly);
}

function getVoiceInputAccessState() {
  const entitlement = getPaidFeatureEntitlement("voiceTranscription");

  if (!entitlement?.enabled) {
    return {
      status: "locked",
      label: "Диктовать",
      detail: scheduleSync.peekAccountId()
        ? "Голосовой ввод доступен по подписке Focus Plus."
        : "Подключите аккаунт, чтобы оформить голосовой ввод.",
    };
  }

  if (!getSpeechRecognitionConstructor() && isServerVoiceRecordingSupported()) {
    return {
      status: "recording-ready",
      label: "Записать",
      detail: "Нажмите, чтобы записать короткий фрагмент для серверной транскрибации.",
    };
  }

  if (!getSpeechRecognitionConstructor()) {
    return {
      status: "unsupported",
      label: "Недоступно",
      detail: "Этот браузер не поддерживает голосовой ввод.",
    };
  }

  return {
    status: "ready",
    label: "Диктовать",
    detail: "Нажмите и продиктуйте текст.",
  };
}

function ensureVoiceStatusElement(button) {
  const nextElement = button.nextElementSibling;
  if (nextElement?.classList?.contains("voice-status")) {
    return nextElement;
  }

  const status = document.createElement("p");
  status.className = "voice-status";
  status.setAttribute("aria-live", "polite");
  status.hidden = true;
  button.insertAdjacentElement("afterend", status);
  return status;
}

function setVoiceButtonLabel(button, label) {
  const labelElement = button.querySelector("span:not(.icon)");
  if (labelElement) {
    labelElement.textContent = label;
  }
}

function setVoiceStatus(button, message, tone = "warn") {
  const status = ensureVoiceStatusElement(button);
  status.textContent = message;
  status.hidden = !message;
  status.className = `voice-status voice-status--${tone}`;
}

function renderVoiceInputControls() {
  const access = getVoiceInputAccessState();

  document.querySelectorAll(".voice-button").forEach(button => {
    const isRecognizing = button === activeVoiceButton;
    const isRecording = button === activeVoiceRecorderButton;
    const isTranscribing = button === activeVoiceTranscriptionButton;
    const isActive = isRecognizing || isRecording || isTranscribing;
    const hasOtherActiveControl = (activeVoiceButton && !isRecognizing)
      || (activeVoiceRecorderButton && !isRecording)
      || (activeVoiceTranscriptionButton && !isTranscribing);
    button.classList.toggle("voice-button--active", isActive);
    button.classList.toggle("voice-button--recording", isRecording);
    button.disabled = access.status === "unsupported" || hasOtherActiveControl;
    setVoiceButtonLabel(button, isRecognizing ? "Слушаю..." : isRecording ? "Стоп" : isTranscribing ? "Отправляем..." : access.label);
    setVoiceStatus(
      button,
      isRecognizing
        ? "Говорите. Текст появится в выбранном поле."
        : isRecording
          ? "Идёт запись. Нажмите ещё раз, чтобы отправить."
          : isTranscribing
            ? "Отправляем запись на транскрибацию..."
          : access.detail,
      isRecognizing || isRecording ? "ok" : access.status === "unsupported" ? "bad" : "warn"
    );
  });
}

function resolveVoiceTarget(button) {
  const modal = button.closest(".focus-modal");
  const activeElement = document.activeElement;

  if (modal?.contains(activeElement) && isTextInputControl(activeElement)) {
    return activeElement;
  }

  const selector = button.dataset.voiceTarget || "";
  if (!selector) return null;

  try {
    const target = document.querySelector(selector);
    return isTextInputControl(target) ? target : null;
  } catch {
    return null;
  }
}

function insertVoiceTranscript(target, transcript) {
  const normalizedTranscript = String(transcript || "").trim();
  if (!normalizedTranscript || !isTextInputControl(target)) return false;

  const currentValue = target.value || "";
  const selectionStart = Number.isInteger(target.selectionStart) ? target.selectionStart : currentValue.length;
  const selectionEnd = Number.isInteger(target.selectionEnd) ? target.selectionEnd : selectionStart;
  const before = currentValue.slice(0, selectionStart);
  const after = currentValue.slice(selectionEnd);
  const separator = before && !/\s$/.test(before) ? " " : "";
  const tailSeparator = after && !/^\s/.test(after) ? " " : "";
  const nextValue = `${before}${separator}${normalizedTranscript}${tailSeparator}${after}`;

  target.value = nextValue;
  const cursorPosition = before.length + separator.length + normalizedTranscript.length;
  target.focus();
  target.setSelectionRange?.(cursorPosition, cursorPosition);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function stopActiveVoiceRecognition() {
  if (!activeVoiceRecognition) return;

  try {
    activeVoiceRecognition.stop();
  } catch {
    activeVoiceRecognition.abort?.();
  }
}

function finishVoiceRecognition(button, message = "", tone = "warn") {
  activeVoiceRecognition = null;
  activeVoiceButton = null;
  renderVoiceInputControls();
  if (message && button) {
    setVoiceStatus(button, message, tone);
  }
}

function stopVoiceRecordingStream(stream) {
  stream?.getTracks?.().forEach(track => {
    try {
      track.stop();
    } catch {
      // Ignore track cleanup failures; the recording flow has already ended.
    }
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (!window.FileReader) {
      reject(new Error("FileReader is unavailable."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Voice recording read failed."));
    reader.readAsDataURL(blob);
  });
}

function clearActiveVoiceRecorder() {
  if (activeVoiceRecorderTimer) {
    window.clearTimeout(activeVoiceRecorderTimer);
    activeVoiceRecorderTimer = null;
  }

  activeVoiceRecorder = null;
  activeVoiceRecorderButton = null;
  activeVoiceRecorderChunks = [];
  activeVoiceRecorderStartedAt = 0;
}

function stopActiveVoiceRecorder() {
  if (!activeVoiceRecorder) return;

  if (activeVoiceRecorderTimer) {
    window.clearTimeout(activeVoiceRecorderTimer);
    activeVoiceRecorderTimer = null;
  }

  try {
    if (activeVoiceRecorder.state !== "inactive") {
      activeVoiceRecorder.stop();
    }
  } catch {
    clearActiveVoiceRecorder();
    renderVoiceInputControls();
  }
}

function getVoiceTranscriptionFailureMessage(status) {
  switch (status) {
    case "provider-not-configured":
      return {
        message: "Серверная транскрибация подготовлена, но провайдер пока не подключён.",
        tone: "warn",
      };
    case "locked":
      refreshAccountEntitlements();
      return {
        message: "Голосовой ввод доступен по подписке Focus Plus.",
        tone: "warn",
      };
    case "account-required":
      return {
        message: "Подключите аккаунт синхронизации перед серверной транскрибацией.",
        tone: "warn",
      };
    case "invalid-request":
      return {
        message: "Запись не подходит для транскрибации. Попробуйте записать ещё раз.",
        tone: "bad",
      };
    case "usage-limit-exceeded":
      return {
        message: "Месячный лимит транскрибации исчерпан. Новый период начнётся автоматически.",
        tone: "warn",
      };
    case "offline":
      return {
        message: "Нет связи с сервером. Запись не отправлена.",
        tone: "bad",
      };
    default:
      return {
        message: "Не удалось выполнить транскрибацию. Попробуйте позже.",
        tone: "bad",
      };
  }
}

function finishVoiceTranscription(button, message, tone = "warn") {
  if (activeVoiceTranscriptionButton === button) {
    activeVoiceTranscriptionButton = null;
  }

  renderVoiceInputControls();
  setVoiceStatus(button, message, tone);
}

async function submitVoiceRecording(button, target, chunks, mimeType, durationMs = 0) {
  if (!chunks.length) {
    setVoiceStatus(button, "Запись пустая. Попробуйте ещё раз.", "bad");
    return;
  }

  activeVoiceTranscriptionButton = button;
  renderVoiceInputControls();

  try {
    const blob = new Blob(chunks, { type: mimeType || chunks[0]?.type || "audio/webm" });
    const audioBase64 = await blobToBase64(blob);
    const result = await scheduleSync.transcribeAudio({
      audioBase64,
      mimeType: blob.type || mimeType || "audio/webm",
      durationMs,
      language: "ru-RU",
      prompt: "Focus planner field dictation",
    });
    refreshTranscriptionEvents({ silent: true }).catch(() => {
      renderTranscriptionEventsPanel();
    });

    if (result.status === "transcribed") {
      if (insertVoiceTranscript(target, result.text)) {
        finishVoiceTranscription(button, "Текст добавлен.", "ok");
      } else {
        finishVoiceTranscription(button, "Транскрибация завершилась без текста.", "bad");
      }
      return;
    }

    const failure = getVoiceTranscriptionFailureMessage(result.status);
    finishVoiceTranscription(button, failure.message, failure.tone);
  } catch {
    finishVoiceTranscription(button, "Не удалось подготовить запись к отправке.", "bad");
  }
}

async function startVoiceRecording(button) {
  const MediaRecorderConstructor = getMediaRecorderConstructor();
  const target = resolveVoiceTarget(button);

  if (!isServerVoiceRecordingSupported() || !MediaRecorderConstructor) {
    setVoiceStatus(button, "Этот браузер не поддерживает запись аудио для транскрибации.", "bad");
    renderVoiceInputControls();
    return;
  }

  if (!target) {
    setVoiceStatus(button, "Выберите поле, куда вставить расшифрованный текст.", "bad");
    return;
  }

  stopActiveVoiceRecognition();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setVoiceStatus(button, "Браузер не дал доступ к микрофону.", "bad");
    return;
  }

  const mimeType = getVoiceRecordingMimeType();
  let recorder;
  let recorderFailed = false;

  try {
    recorder = new MediaRecorderConstructor(stream, mimeType ? { mimeType } : undefined);
  } catch {
    stopVoiceRecordingStream(stream);
    setVoiceStatus(button, "Не удалось подготовить запись аудио.", "bad");
    return;
  }

  activeVoiceRecorder = recorder;
  activeVoiceRecorderButton = button;
  activeVoiceRecorderChunks = [];
  activeVoiceRecorderStartedAt = Date.now();

  recorder.ondataavailable = event => {
    if (activeVoiceRecorder === recorder && event.data?.size > 0) {
      activeVoiceRecorderChunks.push(event.data);
    }
  };

  recorder.onerror = () => {
    recorderFailed = true;
    stopActiveVoiceRecorder();
  };

  recorder.onstop = () => {
    const chunks = activeVoiceRecorder === recorder ? [...activeVoiceRecorderChunks] : [];
    const recordedMimeType = recorder.mimeType || mimeType;
    const durationMs = activeVoiceRecorder === recorder && activeVoiceRecorderStartedAt
      ? Math.min(VOICE_RECORDING_MAX_MS, Math.max(0, Date.now() - activeVoiceRecorderStartedAt))
      : 0;
    clearActiveVoiceRecorder();
    stopVoiceRecordingStream(stream);
    renderVoiceInputControls();

    if (recorderFailed) {
      setVoiceStatus(button, "Не удалось записать аудио. Попробуйте ещё раз.", "bad");
      return;
    }

    void submitVoiceRecording(button, target, chunks, recordedMimeType, durationMs);
  };

  try {
    recorder.start();
  } catch {
    clearActiveVoiceRecorder();
    stopVoiceRecordingStream(stream);
    setVoiceStatus(button, "Не удалось начать запись. Попробуйте ещё раз.", "bad");
    renderVoiceInputControls();
    return;
  }

  activeVoiceRecorderTimer = window.setTimeout(() => {
    stopActiveVoiceRecorder();
  }, VOICE_RECORDING_MAX_MS);
  renderVoiceInputControls();
}

function startVoiceInput(button) {
  const Recognition = getSpeechRecognitionConstructor();
  const target = resolveVoiceTarget(button);

  if (!Recognition) {
    setVoiceStatus(button, "Этот браузер не поддерживает локальное распознавание речи.", "bad");
    renderVoiceInputControls();
    return;
  }

  if (!target) {
    setVoiceStatus(button, "Выберите поле, куда вставить продиктованный текст.", "bad");
    return;
  }

  stopActiveVoiceRecognition();

  const recognition = new Recognition();
  let finalMessage = "";
  let finalTone = "warn";
  activeVoiceRecognition = recognition;
  activeVoiceButton = button;

  recognition.lang = "ru-RU";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    renderVoiceInputControls();
  };

  recognition.onresult = event => {
    const transcript = Array.from(event.results || [])
      .map(result => result?.[0]?.transcript || "")
      .join(" ")
      .trim();

    if (insertVoiceTranscript(target, transcript)) {
      finalMessage = "Текст добавлен.";
      finalTone = "ok";
    }
  };

  recognition.onerror = event => {
    const error = event?.error || "";
    finalMessage = error === "not-allowed" || error === "service-not-allowed"
      ? "Браузер не дал доступ к микрофону."
      : "Не удалось распознать речь. Повторите попытку.";
    finalTone = "bad";
  };

  recognition.onend = () => {
    finishVoiceRecognition(button, finalMessage, finalTone);
  };

  try {
    recognition.start();
  } catch {
    finishVoiceRecognition(button, "Не удалось включить микрофон. Повторите попытку.", "bad");
  }
}

async function handleVoiceInputAction(button, openModal) {
  const access = getVoiceInputAccessState();

  if (access.status === "locked") {
    await handlePaidFeatureAction("voiceTranscription", openModal);
    renderVoiceInputControls();
    return;
  }

  if (access.status === "unsupported") {
    setVoiceStatus(button, access.detail, "bad");
    renderVoiceInputControls();
    return;
  }

  if (button === activeVoiceRecorderButton) {
    stopActiveVoiceRecorder();
    return;
  }

  if (button === activeVoiceTranscriptionButton) {
    return;
  }

  if (button === activeVoiceButton) {
    stopActiveVoiceRecognition();
    return;
  }

  if (getSpeechRecognitionConstructor()) {
    startVoiceInput(button);
    return;
  }

  await startVoiceRecording(button);
}

function renderSyncState() {
  const accountCode = document.querySelector("#syncAccountCode");
  const copyButton = document.querySelector("#syncCodeCopyButton");
  const accountId = scheduleSync.peekAccountId();

  if (accountCode) {
    accountCode.value = accountId;
  }

  if (copyButton) {
    copyButton.disabled = !accountId;
  }

  setSyncStatus(accountId
    ? "Синхронизация включена для этого аккаунта."
    : "Нажмите «Показать код», чтобы создать код синхронизации.");
  renderSyncAccountProfile();
  renderSyncDataStatus();
  renderPaidFeatureSurfaces();
}

async function copySyncAccountCode() {
  const accountCode = document.querySelector("#syncAccountCode");
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    setSyncStatus("Сначала создайте код синхронизации.");
    return;
  }

  try {
    await navigator.clipboard.writeText(accountId);
    setSyncStatus("Код синхронизации скопирован.");
  } catch {
    accountCode?.focus();
    accountCode?.select();
    accountCode?.setSelectionRange?.(0, accountId.length);
    setSyncStatus("Код выделен. Скопируйте его вручную.");
  }
}

function getAuthUserTitle(user) {
  return user?.name || user?.email || user?.preferredUsername || "аккаунт Orbit";
}

function renderAuthState(session = authSession) {
  const status = document.querySelector("#authStatus");
  const loginButton = document.querySelector("#authLoginButton");
  const logoutButton = document.querySelector("#authLogoutButton");

  if (!status || !loginButton || !logoutButton) return;

  if (session?.status === "offline") {
    status.textContent = "Сервер входа временно недоступен. Синхронизация по коду продолжит работать.";
    loginButton.hidden = false;
    loginButton.disabled = true;
    logoutButton.hidden = true;
    return;
  }

  if (!session?.configured) {
    status.textContent = `OAuth-клиент Orbit пока не настроен. Redirect URI: ${session?.redirectUri || "ожидает настройки"}.`;
    loginButton.hidden = false;
    loginButton.disabled = true;
    logoutButton.hidden = true;
    return;
  }

  if (session.authenticated) {
    status.textContent = `Вход выполнен: ${getAuthUserTitle(session.user)}. Синхронизация привязана к этому аккаунту.`;
    loginButton.hidden = true;
    loginButton.disabled = false;
    logoutButton.hidden = false;
    logoutButton.disabled = false;
    return;
  }

  status.textContent = "Можно войти через Orbit Auth. Google и email-код остаются внутри Orbit.";
  loginButton.hidden = false;
  loginButton.disabled = false;
  logoutButton.hidden = true;
}

async function cleanupCurrentSyncDeviceBeforeAccountChange(nextAccountId) {
  const previousAccountId = scheduleSync.peekAccountId();

  if (!previousAccountId || previousAccountId === nextAccountId) {
    return false;
  }

  await scheduleSync.disconnectCurrentDevice();
  await focusNotifications.unsubscribePush?.();
  return true;
}

async function refreshAuthSession() {
  authSession = await focusAuth.getSession();

  if (authSession.authenticated && authSession.accountId && scheduleSync.peekAccountId() !== authSession.accountId) {
    const accountChanged = await cleanupCurrentSyncDeviceBeforeAccountChange(authSession.accountId);
    scheduleSync.setAccountId(authSession.accountId);
    syncAccountProfile = null;
    if (accountChanged) {
      resetSyncCollectionStates();
      resetAccountEntitlementsState();
    }
  }

  renderAuthState(authSession);
  renderSyncState();
  if (scheduleSync.peekAccountId()) {
    refreshAccountEntitlements({ silent: true }).catch(() => {
      renderPaidFeatureSurfaces();
    });
    refreshEntitlementEvents({ silent: true }).catch(() => {
      renderEntitlementEventsPanel();
    });
    refreshTranscriptionEvents({ silent: true }).catch(() => {
      renderTranscriptionEventsPanel();
    });
  } else {
    resetAccountEntitlementsState("local");
  }
  return authSession;
}

async function logoutAuthSession() {
  const result = await focusAuth.logout();
  authSession = { ...authSession, ...result, authenticated: false, user: null, accountId: null };
  if (scheduleSync.peekAccountId().startsWith("orbit:")) {
    await scheduleSync.disconnectCurrentDevice();
    await focusNotifications.unsubscribePush?.();
    scheduleSync.clearAccountId();
    syncAccountProfile = null;
    resetSyncCollectionStates();
    resetAccountEntitlementsState("local");
  }
  renderAuthState(authSession);
  renderSyncState();
  setSyncStatus(result.status === "offline"
    ? "Не удалось выйти из аккаунта. Проверьте подключение."
    : "Вы вышли из Orbit Auth. Локальные данные остались на устройстве.");
}

function formatSyncTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "нет данных";
  }
  return `${formatDateValue(date)} ${formatTimeValue(date)}`;
}

function renderSyncAccountProfile(profile = syncAccountProfile) {
  const accountName = document.querySelector("#syncAccountName");
  const deviceName = document.querySelector("#syncDeviceName");
  const summary = document.querySelector("#syncAccountSummary");
  const deviceList = document.querySelector("#syncDeviceList");
  const saveButton = document.querySelector("#syncProfileSaveButton");
  const disconnectButton = document.querySelector("#syncDisconnectButton");
  const accountId = scheduleSync.peekAccountId();
  const devices = Array.isArray(profile?.devices) ? profile.devices : [];
  const currentDevice = devices.find(device => device.isCurrent) || null;
  const canDisconnect = Boolean(accountId) && !(authSession?.authenticated && accountId === authSession.accountId);

  if (accountName) {
    accountName.value = profile?.displayName || "";
    accountName.disabled = !accountId;
  }

  if (deviceName) {
    deviceName.value = currentDevice?.deviceName || scheduleSync.peekDeviceName();
    deviceName.disabled = !accountId;
  }

  if (saveButton) {
    saveButton.disabled = !accountId;
  }

  if (disconnectButton) {
    disconnectButton.hidden = !canDisconnect;
    disconnectButton.disabled = !canDisconnect;
  }

  if (summary) {
    if (!accountId) {
      summary.textContent = "Создайте код синхронизации, чтобы увидеть подключённые устройства.";
    } else if (profile?.status === "offline") {
      summary.textContent = "Сервер временно недоступен. Локальное имя устройства сохранится и отправится позже.";
    } else {
      const accountTitle = profile?.displayName ? `«${profile.displayName}»` : "без названия";
      const deviceCount = devices.length;
      summary.textContent = `Аккаунт ${accountTitle}. Подключено устройств: ${deviceCount}.`;
    }
  }

  if (!deviceList) return;

  if (!accountId) {
    deviceList.innerHTML = `<p class="sync-device-empty">Устройства появятся после создания кода синхронизации.</p>`;
    return;
  }

  if (!devices.length) {
    deviceList.innerHTML = `<p class="sync-device-empty">Список устройств обновится после связи с сервером.</p>`;
    return;
  }

  deviceList.innerHTML = devices.map(device => `
    <article class="sync-device-card${device.isCurrent ? " sync-device-card--current" : ""}">
      <div>
        <strong>${escapeHtml(device.deviceName || "Устройство без имени")}</strong>
        <small>Последняя активность: ${escapeHtml(formatSyncTimestamp(device.lastSeenAt))}</small>
      </div>
      <span class="sync-device-card__badge">${device.isCurrent ? "Это устройство" : "Подключено"}</span>
    </article>
  `).join("");
}

async function refreshSyncAccountProfile() {
  if (!scheduleSync.peekAccountId()) {
    syncAccountProfile = null;
    renderSyncAccountProfile();
    return null;
  }

  syncAccountProfile = await scheduleSync.getAccountProfile();
  renderSyncAccountProfile(syncAccountProfile);
  return syncAccountProfile;
}

async function saveSyncAccountProfile() {
  if (!scheduleSync.peekAccountId()) {
    setSyncStatus("Сначала создайте код синхронизации.");
    return;
  }

  const accountName = document.querySelector("#syncAccountName");
  const deviceName = document.querySelector("#syncDeviceName");
  const saveButton = document.querySelector("#syncProfileSaveButton");

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Сохраняем...";
    }

    syncAccountProfile = await scheduleSync.updateAccountProfile({
      displayName: accountName?.value || "",
      deviceName: deviceName?.value || "",
    });
    renderSyncAccountProfile(syncAccountProfile);
    setSyncStatus(syncAccountProfile.status === "offline"
      ? "Профиль сохранён локально. Сервер обновится после подключения."
      : "Профиль аккаунта обновлён.");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Сохранить";
    }
  }
}

async function disconnectSyncAccount() {
  const accountId = scheduleSync.peekAccountId();

  if (!accountId) {
    renderSyncState();
    setSyncStatus("Это устройство уже не подключено к синхронизации.");
    return;
  }

  if (authSession?.authenticated && accountId === authSession.accountId) {
    setSyncStatus("Для аккаунта Orbit используйте кнопку «Выйти». Локальные данные останутся на устройстве.");
    return;
  }

  const confirmed = window.confirm("Отключить это устройство от синхронизации? Локальные данные останутся на устройстве.");
  if (!confirmed) return;

  const result = await scheduleSync.disconnectCurrentDevice();
  await focusNotifications.unsubscribePush?.();
  scheduleSync.clearAccountId();
  syncAccountProfile = null;
  resetSyncCollectionStates();
  resetAccountEntitlementsState("local");
  renderSyncState();

  if (result.status === "removed") {
    setSyncStatus("Это устройство отключено от синхронизации и удалено из списка устройств. Локальные данные остались на устройстве.");
    return;
  }

  if (result.status === "not-found") {
    setSyncStatus("Аккаунт уже не найден на сервере. Это устройство отключено локально.");
    return;
  }

  setSyncStatus("Это устройство отключено локально. Сервер очистится при следующем подключении.");
}

function getInstallDiagnosticItems() {
  const root = document.documentElement;
  const device = getDeviceRuntimeProfile();
  const displayMode = root.dataset.displayMode || (
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
      ? "standalone"
      : "browser"
  );
  const pwaReady = root.dataset.pwaReady || ("serviceWorker" in navigator ? "loading" : "unsupported");
  const updateState = root.dataset.pwaUpdate || "";
  const hasServiceWorker = pwaReady === "active" || Boolean(navigator.serviceWorker?.controller);
  const hasIndexedDb = "indexedDB" in window;
  const notificationPermission = "Notification" in window ? Notification.permission : "unsupported";
  const accountId = scheduleSync.peekAccountId();

  const displayItem = displayMode === "standalone"
    ? { title: "Окно приложения", value: "Standalone", status: "ok", action: "Приложение запущено без браузерной панели." }
    : {
        title: "Окно приложения",
        value: root.dataset.pwaInstallable === "true" ? "Можно установить" : "Браузер",
        status: root.dataset.pwaInstallable === "true" ? "warn" : "warn",
        action: device.isIos
          ? "На iPhone/iPad установите через Safari → Поделиться → На экран «Домой»."
          : "Установите приложение из меню браузера или кнопкой ниже.",
      };

  const cacheItem = (() => {
    if (pwaReady === "active") {
      return { title: "Офлайн-кэш", value: "Готов", status: "ok", action: "Основной экран откроется даже без сети." };
    }
    if (pwaReady === "failed" || pwaReady === "unsupported") {
      return { title: "Офлайн-кэш", value: "Недоступен", status: "bad", action: "Проверьте поддержку service worker в браузере." };
    }
    return { title: "Офлайн-кэш", value: hasServiceWorker ? "Активируется" : "Готовится", status: "warn", action: "Обновите страницу через несколько секунд." };
  })();

  const connectionItem = navigator.onLine
    ? { title: "Сеть", value: "Онлайн", status: "ok", action: "Синхронизация и push-проверка доступны." }
    : { title: "Сеть", value: hasServiceWorker ? "Офлайн-режим" : "Офлайн", status: hasServiceWorker ? "ok" : "warn", action: hasServiceWorker ? "Можно работать локально до подключения." : "Для первой загрузки нужна сеть." };

  const notificationItem = (() => {
    if (notificationPermission === "granted") {
      return { title: "Уведомления", value: "Разрешены", status: "ok", action: "Можно проверять локальные и серверные напоминания." };
    }
    if (notificationPermission === "denied") {
      return { title: "Уведомления", value: "Заблокированы", status: "bad", action: "Разблокируйте уведомления в настройках браузера или системы." };
    }
    if (notificationPermission === "unsupported") {
      return { title: "Уведомления", value: "Нет поддержки", status: "warn", action: "На iPhone/iPad проверьте установленное PWA." };
    }
    return { title: "Уведомления", value: "Не включены", status: "warn", action: "Включите их в разделе «Напоминания»." };
  })();

  const updateItem = updateState === "available"
    ? { title: "Обновление PWA", value: "Доступно", status: "warn", action: "Нажмите «Обновить», чтобы применить новую версию." }
    : { title: "Обновление PWA", value: updateState === "checked" ? "Проверено" : "Авто", status: "ok", action: "Service worker сам подхватит свежую версию." };

  const secureItem = device.isSecure
    ? { title: "Адрес", value: "HTTPS", status: "ok", action: "Домен подходит для PWA и push." }
    : { title: "Адрес", value: "Не защищён", status: "bad", action: "Откройте приложение через https://focus-v2.dmnao83.ru." };

  const pushSupportItem = (() => {
    if (!device.isSecure) {
      return { title: "Push API", value: "Нужен HTTPS", status: "bad", action: "Без HTTPS браузер не создаст push-подписку." };
    }
    if (device.isIos && !device.isStandalone) {
      return { title: "Push API", value: "Нужна установка", status: "warn", action: "На iOS push проверяется из PWA на экране «Домой»." };
    }
    if (device.pushApiSupported) {
      return { title: "Push API", value: "Доступен", status: "ok", action: "Можно подключать серверные напоминания." };
    }
    return { title: "Push API", value: "Недоступен", status: "bad", action: "Нужен браузер с PushManager или установленное PWA." };
  })();

  return [
    { title: "Платформа", value: getDevicePlatformLabel(device), status: "ok", action: device.isStandalone ? "Запуск идёт в приложении." : "Сейчас открыт браузерный режим." },
    secureItem,
    displayItem,
    cacheItem,
    connectionItem,
    { title: "Хранилище", value: hasIndexedDb ? "IndexedDB" : "Ограничено", status: hasIndexedDb ? "ok" : "bad", action: hasIndexedDb ? "Данные сохраняются локально." : "Нужен браузер с IndexedDB." },
    notificationItem,
    pushSupportItem,
    { title: "Синхронизация", value: accountId ? "Аккаунт подключён" : "Локально", status: accountId ? "ok" : "warn", action: accountId ? "Данные можно переносить между устройствами." : "Подключите аккаунт для нескольких устройств." },
    updateItem,
  ];
}

function getInstallDiagnosticSummary(items) {
  const root = document.documentElement;

  if (root.dataset.pwaUpdate === "available") {
    return "Доступно обновление приложения. Нажмите «Обновить», чтобы применить новую версию.";
  }

  const displayReady = items.some(item => item.title === "Окно приложения" && item.status === "ok");
  const cacheReady = items.some(item => item.title === "Офлайн-кэш" && item.status === "ok");
  const hasBadItems = items.some(item => item.status === "bad");

  if (displayReady && cacheReady && !hasBadItems) {
    return "PWA-режим готов: приложение установлено, кэш доступен, данные сохраняются локально.";
  }

  if (root.dataset.pwaInstallable === "true") {
    return "Браузер готов установить приложение на это устройство.";
  }

  if (hasBadItems) {
    return "Есть ограничения на этом устройстве. Проверьте строки со статусом ошибки.";
  }

  return "Приложение работает в браузере. Для проверки установки откройте его как PWA.";
}

function renderInstallDiagnostics(message = "") {
  const summary = document.querySelector("#pwaInstallSummary");
  const diagnostics = document.querySelector("#pwaInstallDiagnostics");
  const actionButton = document.querySelector("#pwaInstallCheckButton");
  if (!summary || !diagnostics) return;

  const items = getInstallDiagnosticItems();
  summary.textContent = message || getInstallDiagnosticSummary(items);
  diagnostics.innerHTML = items.map(item => `
    <div class="install-diagnostic install-diagnostic--${item.status}">
      <strong>${escapeHtml(item.title)}</strong>
      <span class="install-diagnostic__status"><i aria-hidden="true"></i>${escapeHtml(item.value)}</span>
      ${item.action ? `<small>${escapeHtml(item.action)}</small>` : ""}
    </div>
  `).join("");

  if (!actionButton) return;

  if (document.documentElement.dataset.pwaUpdate === "available") {
    actionButton.textContent = "Обновить";
  } else if (window.focusInstallPrompt && document.documentElement.dataset.displayMode !== "standalone") {
    actionButton.textContent = "Установить";
  } else {
    actionButton.textContent = "Проверить";
  }

  renderDeviceCheck();
}

function getDeviceCheckItems() {
  const root = document.documentElement;
  const device = getDeviceRuntimeProfile();
  const pwaReady = root.dataset.pwaReady || ("serviceWorker" in navigator ? "loading" : "unsupported");
  const hasServiceWorker = pwaReady === "active" || Boolean(navigator.serviceWorker?.controller);
  const permission = focusNotifications.getPermission();
  const pushState = reminderPushDiagnostics;
  const nextReminder = getNextPendingReminder();

  const installedItem = device.isStandalone
    ? { title: "Установка PWA", value: "Установлено", status: "ok", action: "Приложение открыто в standalone-режиме." }
    : { title: "Установка PWA", value: "Браузер", status: "warn", action: device.isIos ? "Откройте приложение с экрана «Домой»." : "Установите приложение из браузера." };

  const cacheItem = (() => {
    if (hasServiceWorker) {
      return { title: "Офлайн-основа", value: "Готова", status: "ok", action: "Service worker активен." };
    }
    if (pwaReady === "failed" || pwaReady === "unsupported") {
      return { title: "Офлайн-основа", value: "Недоступна", status: "bad", action: "Проверьте поддержку PWA в браузере." };
    }
    return { title: "Офлайн-основа", value: "Готовится", status: "warn", action: "Обновите проверку через несколько секунд." };
  })();

  const notificationItem = (() => {
    if (permission === "granted") {
      return { title: "Уведомления", value: "Разрешены", status: "ok", action: "Системные уведомления включены." };
    }
    if (permission === "denied") {
      return { title: "Уведомления", value: "Заблокированы", status: "bad", action: "Разрешите уведомления в настройках устройства." };
    }
    if (permission === "unsupported") {
      return { title: "Уведомления", value: "Нет поддержки", status: "bad", action: "Проверьте установленное PWA или другой браузер." };
    }
    return { title: "Уведомления", value: "Не включены", status: "warn", action: "Нажмите «Тест push» или включите уведомления в напоминаниях." };
  })();

  const pushItem = (() => {
    if (!device.isSecure) {
      return { title: "Push-подписка", value: "Нужен HTTPS", status: "bad", action: "Откройте основной защищённый домен." };
    }
    if (!device.pushApiSupported) {
      return { title: "Push-подписка", value: "Недоступна", status: "bad", action: "Push API недоступен в этом окружении." };
    }
    if (permission !== "granted") {
      return { title: "Push-подписка", value: "Ожидает", status: "warn", action: "Сначала разрешите уведомления." };
    }
    if (pushState?.status?.deviceRegistered) {
      return { title: "Push-подписка", value: "Подключена", status: "ok", action: "Сервер видит это устройство." };
    }
    if (pushState?.status?.status === "offline") {
      return { title: "Push-подписка", value: "Нет связи", status: "bad", action: "Повторите проверку после подключения." };
    }
    return { title: "Push-подписка", value: "Не проверена", status: "warn", action: "Нажмите «Обновить» или «Тест push»." };
  })();

  const testItem = (() => {
    if (deviceCheckPushTestState === "sent") {
      return { title: "Тестовый push", value: "Отправлен", status: "ok", action: "Проверьте уведомление на этом устройстве." };
    }
    if (deviceCheckPushTestState === "failed") {
      return { title: "Тестовый push", value: "Ошибка", status: "bad", action: "Проверьте сеть, разрешения и подписку." };
    }
    if (deviceCheckPushTestState === "blocked") {
      return { title: "Тестовый push", value: "Недоступен", status: "warn", action: "Сначала завершите предыдущие пункты." };
    }
    return { title: "Тестовый push", value: "Не запускался", status: "warn", action: "Нажмите «Тест push»." };
  })();

  const reminderItem = nextReminder
    ? { title: "Реальное напоминание", value: formatReminderDateTime(nextReminder), status: "ok", action: "Ближайшее напоминание ожидает доставки." }
    : { title: "Реальное напоминание", value: "Нет активных", status: "warn", action: "Создайте напоминание на ближайшие 2–3 минуты." };

  return [installedItem, cacheItem, notificationItem, pushItem, testItem, reminderItem];
}

function getDeviceCheckSummary(items) {
  const readyCount = items.filter(item => item.status === "ok").length;
  const hasBadItems = items.some(item => item.status === "bad");

  if (readyCount === items.length) {
    return "Устройство прошло контрольную проверку PWA и push-уведомлений.";
  }

  if (hasBadItems) {
    return `Готово ${readyCount} из ${items.length}. Есть блокирующие пункты, которые нужно исправить.`;
  }

  return `Готово ${readyCount} из ${items.length}. Завершите оставшиеся пункты перед проверкой на устройстве.`;
}

function renderDeviceCheck() {
  const summary = document.querySelector("#deviceCheckSummary");
  const list = document.querySelector("#deviceCheckList");
  const testButton = document.querySelector("#deviceCheckTestButton");
  const refreshButton = document.querySelector("#deviceCheckRefreshButton");

  if (!summary || !list) return;

  const items = getDeviceCheckItems();
  summary.textContent = getDeviceCheckSummary(items);
  list.innerHTML = items.map(item => `
    <div class="device-check-item device-check-item--${item.status}">
      <strong><i aria-hidden="true"></i>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.value)}</span>
      <small>${escapeHtml(item.action)}</small>
    </div>
  `).join("");

  const permission = focusNotifications.getPermission();
  const device = getDeviceRuntimeProfile();
  if (testButton) {
    testButton.disabled = permission === "denied" || permission === "unsupported" || !device.pushApiSupported;
  }
  if (refreshButton) {
    refreshButton.disabled = false;
  }
}

async function refreshDeviceCheck() {
  renderInstallDiagnostics();
  try {
    await refreshReminderPushDiagnostics({ register: true });
  } catch {
    renderReminderPushDiagnostics({
      message: "Не удалось проверить серверные push-уведомления. Повторите после подключения.",
    });
  }
  renderDeviceCheck();
}

async function runInstallQualityAction() {
  const actionButton = document.querySelector("#pwaInstallCheckButton");
  const root = document.documentElement;

  if (root.dataset.pwaUpdate === "available" && typeof window.focusPwaApplyUpdate === "function") {
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = "Обновляем...";
    }
    await window.focusPwaApplyUpdate();
    renderInstallDiagnostics("Обновление применяется. Приложение перезапустится автоматически.");
    return;
  }

  if (window.focusInstallPrompt) {
    const promptEvent = window.focusInstallPrompt;
    window.focusInstallPrompt = null;
    root.removeAttribute("data-pwa-installable");
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
    renderInstallDiagnostics(choice.outcome === "accepted"
      ? "Установка запущена. После открытия с иконки режим станет standalone."
      : "Установка не запущена. Можно повторить из меню браузера.");
    return;
  }

  if (typeof window.focusPwaCheckForUpdate !== "function") {
    renderInstallDiagnostics("Проверка PWA недоступна в этом браузере.");
    return;
  }

  try {
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = "Проверяем...";
    }
    const result = await window.focusPwaCheckForUpdate();
    renderInstallDiagnostics(result?.status === "available"
      ? "Доступно обновление. Нажмите «Обновить», чтобы применить его."
      : "Проверка завершена. Актуальная версия уже используется.");
  } catch {
    renderInstallDiagnostics("Не удалось проверить обновление. Повторите после подключения к сети.");
  } finally {
    if (actionButton) {
      actionButton.disabled = false;
    }
  }
}

async function ensureSyncAccountReady() {
  setSyncStatus("Создаём код синхронизации...");
  await scheduleSync.getAccountId();
  renderSyncState();
  await refreshSyncAccountProfile();
  await refreshAccountEntitlements({ silent: true });
  await refreshEntitlementEvents({ silent: true });
  await refreshTranscriptionEvents({ silent: true });
  await syncSavedSchedules();
  await syncSavedTasks();
  await syncSavedNotes();
  await syncSavedBirthdays();
  await syncSavedDiaryEntries();
  await syncSavedReminders();
  await registerServerPushSubscription();
}

async function connectSyncAccount() {
  const input = document.querySelector("#syncConnectInput");
  const accountId = input?.value.trim();

  if (!accountId) {
    setSyncStatus("Введите код аккаунта с другого устройства.");
    return;
  }

  try {
    setSyncStatus("Проверяем код аккаунта...");
    const accountCheck = await scheduleSync.checkAccountId(accountId);

    if (accountCheck.status === "invalid") {
      setSyncStatus("Код аккаунта должен содержать от 8 до 160 символов.");
      return;
    }

    if (accountCheck.status === "not-found") {
      setSyncStatus("Такой аккаунт не найден. Проверьте код на другом устройстве.");
      return;
    }

    if (accountCheck.status === "offline") {
      setSyncStatus("Не удалось проверить код. Проверьте подключение и попробуйте ещё раз.");
      return;
    }

    const nextAccountId = accountCheck.accountId || accountId;
    const accountChanged = await cleanupCurrentSyncDeviceBeforeAccountChange(nextAccountId);
    scheduleSync.setAccountId(nextAccountId);
    if (accountChanged) {
      syncAccountProfile = null;
      resetSyncCollectionStates();
      renderSyncAccountProfile();
    }
    setSyncStatus("Подключаем аккаунт...");
    const result = await syncSavedSchedules();
    await syncSavedTasks();
    await syncSavedNotes();
    await syncSavedBirthdays();
    await syncSavedDiaryEntries();
    await syncSavedReminders();
    await registerServerPushSubscription();
    if (input) {
      input.value = "";
    }
    renderSyncState();
    await refreshSyncAccountProfile();
    await refreshAccountEntitlements({ silent: true });
    await refreshEntitlementEvents({ silent: true });
    if (result.status === "pulled") {
      setSyncStatus("Готово. Данные с другого устройства загружены.");
    } else {
      setSyncStatus("Готово. Это устройство подключено к аккаунту.");
    }
  } catch {
    setSyncStatus("Код аккаунта не подошёл.");
  }
}

async function hydrateSavedSchedules() {
  try {
    savedSchedules = await scheduleStorage.migrateSchedulesFromLocalStorage();
  } catch {
    savedSchedules = loadLegacySavedSchedules();
  }

  await syncSavedSchedules({ render: false });
  renderSavedSchedules();
}

async function hydrateSavedTasks() {
  try {
    savedTasks = normalizeTaskList(await scheduleStorage.migrateTasksFromLocalStorage());
  } catch {
    savedTasks = normalizeTaskList(loadLegacySavedTasks());
  }

  await syncSavedTasks({ render: false });
  renderTasks();
}

async function hydrateSavedNotes() {
  try {
    savedNotes = normalizeNoteList(await scheduleStorage.migrateNotesFromLocalStorage());
  } catch {
    savedNotes = normalizeNoteList(loadLegacySavedNotes());
  }

  await syncSavedNotes({ render: false });
  renderNotes();
}

async function hydrateSavedBirthdays() {
  try {
    savedBirthdays = normalizeBirthdayList(await scheduleStorage.migrateBirthdaysFromLocalStorage());
  } catch {
    savedBirthdays = normalizeBirthdayList(loadLegacySavedBirthdays());
  }

  await syncSavedBirthdays({ render: false });
  renderBirthdays();
  renderCalendar();
  renderSummary();
}

async function hydrateSavedDiaryEntries() {
  try {
    savedDiaryEntries = normalizeDiaryEntryList(await scheduleStorage.migrateDiaryEntriesFromLocalStorage());
  } catch {
    savedDiaryEntries = normalizeDiaryEntryList(loadLegacySavedDiaryEntries());
  }

  await syncSavedDiaryEntries({ render: false });
  renderDiaryEntries();
  renderCalendar();
  renderSummary();
}

function getFieldMap(selector) {
  const container = document.querySelector(selector);
  if (!container) return {};
  return [...container.querySelectorAll(".field-block")].reduce((values, field) => {
    const label = field.querySelector("span")?.textContent.trim();
    const input = field.querySelector("input, textarea");
    if (label && input) {
      values[label] = input.value.trim();
    }
    return values;
  }, {});
}

function getScheduleDayTimes() {
  const rows = [...document.querySelectorAll("#scheduleFollowupBody [data-day-time-row]")];
  return rows.map(row => {
    const day = row.querySelector(".day-time-day")?.textContent.trim();
    const times = [...row.querySelectorAll(".day-time-pill")].map(pill => pill.dataset.time);
    return { day, times };
  }).filter(item => item.day && item.times.length);
}

function getNumberFieldValue(fields, label, fallback) {
  const rawValue = fields[label] || "";
  const number = Number.parseInt(String(rawValue).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(number) ? number : fallback;
}

function parseTimeToMinutes(value, fallback = "08:30") {
  const [hours, minutes] = String(value || fallback)
    .split(":")
    .map(part => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return parseTimeToMinutes(fallback);
  return (hours * 60) + minutes;
}

function formatMinutesAsTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getSchoolLessonTimeRange(index) {
  const lessonTime = getFieldMap("#scheduleLessonTimeBody");
  const longBreak = getFieldMap("#scheduleLongBreakBody");
  const firstStart = parseTimeToMinutes(lessonTime["Первый урок начинается"], "08:30");
  const lessonDuration = getNumberFieldValue(lessonTime, "Длительность урока, минут", 45);
  const breakDuration = getNumberFieldValue(lessonTime, "Обычная перемена, минут", 10);
  const longBreakOption = document.querySelector("#scheduleLongBreakBody [data-long-break-option].choice-card--active")?.dataset.longBreakOption;
  const hasLongBreak = longBreakOption === "Да";
  const longBreakAfter = getNumberFieldValue(longBreak, "После какого урока", 3);
  const longBreakDuration = getNumberFieldValue(longBreak, "Длительность, минут", 20);

  let start = firstStart;
  for (let lessonIndex = 0; lessonIndex < index; lessonIndex += 1) {
    const previousLessonNumber = lessonIndex + 1;
    start += lessonDuration;
    start += hasLongBreak && previousLessonNumber === longBreakAfter ? longBreakDuration : breakDuration;
  }

  return `${formatMinutesAsTime(start)}–${formatMinutesAsTime(start + lessonDuration)}`;
}

function getSchoolTeachersMap() {
  const subjects = getSelectedSchoolSubjects();
  const inputs = [...document.querySelectorAll("#scheduleTeachersBody input")];
  return subjects.reduce((map, subject, index) => {
    const value = inputs[index]?.value.trim();
    if (value) map[subject] = value;
    return map;
  }, {});
}

function getSchoolLessonRows() {
  const dayStep = scheduleDayLessonSteps.school;
  const teachers = getSchoolTeachersMap();
  return dayStep.days.map(day => {
    const lessons = schoolDayLessonsByDay[day.key] || [];
    return {
      day: day.title,
      lessons: lessons.map((subject, index) => ({
        subject,
        order: index + 1,
        time: getSchoolLessonTimeRange(index),
        teacher: teachers[subject] || ""
      }))
    };
  }).filter(item => item.lessons.length);
}

function formatLessonCount(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} уроков`;
  if (last === 1) return `${count} урок`;
  if (last >= 2 && last <= 4) return `${count} урока`;
  return `${count} уроков`;
}

function getSchedulePayload(typeId, role = "participant") {
  const details = getFieldMap("#scheduleDetailsBody");
  const period = getFieldMap("#scheduleFollowupBody");
  const place = getFieldMap("#schedulePlaceBody");
  const color = document.querySelector("#scheduleColorBody [data-schedule-color].is-selected")?.dataset.scheduleColor || scheduleColorSteps[typeId]?.defaultColor || "#5678F5";
  const reminder = document.querySelector("#scheduleReminderBody [data-reminder-option].choice-card--active")?.dataset.reminderOption || "Без напоминания";
  const isActive = document.querySelector("#scheduleColorBody .schedule-status-toggle")?.classList.contains("is-active") ?? true;
  const note = document.querySelector("#scheduleColorBody textarea")?.value.trim();
  const dayTimes = getScheduleDayTimes();
  const schoolLessonRows = typeId === "school" ? getSchoolLessonRows() : [];

  const titleByType = {
    school: details["Название расписания"] || details["Учебное заведение"] || "Расписание уроков",
    sport: details["Вид спорта / название"] || "Тренировка",
    classes: details["Название занятия"] || "Занятие",
    custom: details["Название расписания"] || "Своё расписание"
  };
  const typeLabelByType = {
    school: "Уроки",
    sport: "Спорт",
    classes: details["Тип занятия"] || "Занятия",
    custom: "Своё"
  };
  const meta = typeId === "school"
    ? schoolLessonRows.length
      ? schoolLessonRows.map(item => `${item.day}: ${formatLessonCount(item.lessons.length)}`).join(" · ")
      : "Дни можно добавить позже"
    : dayTimes.length
      ? dayTimes.map(item => `${item.day}: ${item.times.join(", ")}`).join(" · ")
      : "Дни можно уточнить позже";

  return {
    id: `schedule-${Date.now()}`,
    role,
    type: typeId,
    title: titleByType[typeId] || "Расписание",
    typeLabel: typeLabelByType[typeId] || "Расписание",
    color,
    isActive,
    reminder,
    meta,
    note,
    details,
    period,
    place,
    dayTimes,
    schoolLessonRows
  };
}

function renderSavedSchedules() {
  const list = document.querySelector("#savedSchedulesList");
  if (!list) return;

  syncScheduleFilters();

  if (!savedSchedules.length) {
    list.innerHTML = `
      <div class="saved-schedules-empty">
        <strong>Расписаний пока нет.</strong>
        <span>Добавьте первое расписание — уроки, тренировки, занятия или свой ритм.</span>
      </div>
    `;
    return;
  }

  const filteredSchedules = savedSchedules.filter(matchesScheduleFilter);

  if (!filteredSchedules.length) {
    list.innerHTML = `
      <div class="saved-schedules-empty">
        <strong>По этому фильтру пока пусто.</strong>
        <span>Можно переключить фильтр или добавить новое расписание.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = filteredSchedules.map(schedule => `
    <article class="saved-schedule-card" style="--saved-schedule-color:${schedule.color}" data-open-schedule-detail="${schedule.id}" tabindex="0" role="button" aria-label="Открыть расписание ${escapeHtml(schedule.title)}">
      <div class="saved-schedule-card__main">
        <span class="saved-schedule-card__dot"></span>
        <div>
          <h3>${escapeHtml(schedule.title)}</h3>
          <div class="saved-schedule-card__meta">
            <span>${escapeHtml(getScheduleRoleLabel(schedule))}</span>
            <span>${escapeHtml(schedule.typeLabel)}</span>
          </div>
          <p>${escapeHtml(getScheduleCardMeta(schedule))}</p>
          ${schedule.note ? `<span>${escapeHtml(schedule.note)}</span>` : ""}
        </div>
      </div>
      <div class="saved-schedule-card__actions">
        <button class="schedule-status-pill ${schedule.isActive ? "is-active" : ""}" type="button" data-toggle-schedule="${schedule.id}">
          ${schedule.isActive ? "Активно" : "Пауза"}
        </button>
        <button class="icon-button icon-button--tiny" type="button" aria-label="Редактировать расписание" data-edit-schedule-list="${schedule.id}">
          <span class="icon icon-edit"></span>
        </button>
        <button class="icon-button icon-button--tiny" type="button" aria-label="Удалить расписание" data-delete-schedule="${schedule.id}">
          <span class="icon icon-trash"></span>
        </button>
      </div>
    </article>
  `).join("");
}

function getScheduleCardMeta(schedule) {
  if (schedule.schoolLessonRows?.length) {
    const visibleDays = schedule.schoolLessonRows.slice(0, 2);
    const hiddenDaysCount = schedule.schoolLessonRows.length - visibleDays.length;
    const dayMeta = visibleDays.map(day => {
      const firstTime = day.lessons?.find(lesson => lesson.time)?.time;
      const timeText = firstTime ? `${firstTime}, ` : "";
      return `${day.day}: ${timeText}${formatLessonCount(day.lessons?.length || 0)}`;
    });

    if (hiddenDaysCount > 0) {
      dayMeta.push(`+ ещё ${hiddenDaysCount}`);
    }

    return dayMeta.join(" · ");
  }

  return schedule.meta || "Дни можно уточнить позже";
}

function matchesScheduleFilter(schedule) {
  const role = schedule.role || "participant";
  if (scheduleFilter === "active") return schedule.isActive !== false;
  if (scheduleFilter === "paused") return schedule.isActive === false;
  if (scheduleFilter === "participant") return role === "participant";
  if (scheduleFilter === "mentor") return role === "mentor";
  return true;
}

function syncScheduleFilters() {
  const counts = getScheduleFilterCounts();
  document.querySelectorAll("[data-schedule-filter]").forEach(button => {
    const isActive = button.dataset.scheduleFilter === scheduleFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    const count = button.querySelector(".schedule-filter-count");
    if (count) {
      count.textContent = String(counts[button.dataset.scheduleFilter] ?? 0);
    }
  });
}

function getScheduleFilterCounts() {
  return savedSchedules.reduce((counts, schedule) => {
    const role = schedule.role || "participant";
    counts.all += 1;
    if (schedule.isActive === false) {
      counts.paused += 1;
    } else {
      counts.active += 1;
    }
    if (role === "mentor") {
      counts.mentor += 1;
    } else {
      counts.participant += 1;
    }
    return counts;
  }, {
    all: 0,
    active: 0,
    paused: 0,
    participant: 0,
    mentor: 0,
  });
}

function getScheduleRoleLabel(schedule) {
  return (schedule.role || "participant") === "mentor" ? "Наставник" : "Участник";
}

function saveCurrentSchedule(typeId, role) {
  const schedule = getSchedulePayload(typeId, role);
  if (scheduleEditDraft) {
    const updatedSchedule = { ...schedule, id: scheduleEditDraft.id };
    const hasExistingSchedule = savedSchedules.some(item => item.id === scheduleEditDraft.id);
    savedSchedules = hasExistingSchedule
      ? savedSchedules.map(item => item.id === scheduleEditDraft.id ? updatedSchedule : item)
      : [updatedSchedule, ...savedSchedules];
    scheduleEditDraft = null;
  } else {
    savedSchedules = [schedule, ...savedSchedules];
  }
  persistSavedSchedules();
  renderSavedSchedules();
}

function getScheduleDetailRows(schedule) {
  if (schedule.schoolLessonRows?.length) {
    return schedule.schoolLessonRows.map(day => `
      <section class="schedule-detail-day">
        <h3>${escapeHtml(day.day)}</h3>
        <div class="schedule-detail-lessons">
          ${day.lessons.map(lesson => `
            <article class="schedule-detail-lesson">
              <strong>${lesson.order}. ${escapeHtml(lesson.subject)}${lesson.time ? ` <small>${escapeHtml(lesson.time)}</small>` : ""}</strong>
              ${lesson.teacher ? `<span>${escapeHtml(lesson.teacher)}</span>` : ""}
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  if (schedule.dayTimes?.length) {
    return schedule.dayTimes.map(day => `
      <section class="schedule-detail-day">
        <h3>${escapeHtml(day.day)}</h3>
        <div class="schedule-detail-lessons">
          ${day.times.map(time => `
            <article class="schedule-detail-lesson">
              <strong>${escapeHtml(time)}</strong>
              <span>${escapeHtml(schedule.typeLabel)}</span>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  return `
    <div class="saved-schedules-empty">
      <strong>Подробности пока не заполнены.</strong>
      <span>Можно вернуться к редактированию и добавить дни или занятия.</span>
    </div>
  `;
}

function getSchedulePlaceText(schedule) {
  const place = schedule?.place;
  if (!place) return "";
  if (typeof place === "string") return place.trim();
  if (typeof place !== "object") return "";

  const preferredFields = ["Место", "Место / ссылка", "Кабинет", "Адрес"];
  const preferredValue = preferredFields
    .map(field => place[field])
    .find(value => typeof value === "string" && value.trim());

  if (preferredValue) return preferredValue.trim();

  return Object.values(place)
    .find(value => typeof value === "string" && value.trim())
    ?.trim() || "";
}

function getSchedulePeriodText(schedule) {
  const period = schedule?.period;
  if (!period) return "";
  if (typeof period === "string") return period.trim();
  if (typeof period !== "object") return "";

  const start = period["Действует с"] || period["Начало"] || period.startDate || "";
  const end = period["Действует до"] || period["Конец"] || period.endDate || "";
  if (start && end) return `${start} — ${end}`;
  return start || end || "";
}

function openScheduleDetail(scheduleId, openModal) {
  const schedule = savedSchedules.find(item => item.id === scheduleId);
  const title = document.querySelector("#scheduleDetailTitle");
  const body = document.querySelector("#scheduleDetailBody");
  if (!schedule || !title || !body) return;

  const placeText = getSchedulePlaceText(schedule);
  const periodText = getSchedulePeriodText(schedule);
  title.textContent = schedule.title;
  body.innerHTML = `
    <article class="schedule-detail-card" style="--schedule-detail-color:${schedule.color}">
      <header class="schedule-detail-card__head">
        <span class="saved-schedule-card__dot"></span>
        <div>
          <h3>${escapeHtml(schedule.title)}</h3>
          <div class="schedule-detail-card__meta">
            <span>${escapeHtml(getScheduleRoleLabel(schedule))}</span>
            <span>${escapeHtml(schedule.typeLabel)}</span>
            <button class="schedule-detail-status-chip ${schedule.isActive ? "is-active" : ""}" type="button" aria-pressed="${String(schedule.isActive)}" data-toggle-schedule-detail="${escapeHtml(schedule.id)}">
              ${schedule.isActive ? "Активно" : "Пауза"}
            </button>
            ${schedule.reminder ? `<span>${escapeHtml(schedule.reminder)}</span>` : ""}
          </div>
        </div>
      </header>
      <div class="schedule-detail-grid">
        ${getScheduleDetailRows(schedule)}
      </div>
      ${placeText ? `
        <section class="schedule-detail-info">
          <strong>Место</strong>
          <p>${escapeHtml(placeText)}</p>
        </section>
      ` : ""}
      ${periodText ? `
        <section class="schedule-detail-info schedule-detail-period">
          <strong>Период действия</strong>
          <p>${escapeHtml(periodText)}</p>
        </section>
      ` : ""}
      ${schedule.note ? `
        <section class="schedule-detail-note">
          <strong>Заметка</strong>
          <p>${escapeHtml(schedule.note)}</p>
        </section>
      ` : ""}
      <footer class="schedule-detail-footer">
        <button class="icon-button icon-button--tiny" type="button" aria-label="Редактировать расписание" title="Редактировать" data-edit-schedule="${escapeHtml(schedule.id)}">
          <span class="icon icon-edit"></span>
        </button>
        <button class="icon-button icon-button--tiny" type="button" aria-label="Удалить расписание" data-delete-schedule-detail="${escapeHtml(schedule.id)}">
          <span class="icon icon-trash"></span>
        </button>
      </footer>
    </article>
  `;
  openModal("scheduleDetail");
}

function renderSchedulePreview(typeId) {
  const previewBody = document.querySelector("#schedulePreviewBody");
  const previewTitle = document.querySelector("#schedulePreviewTitle");
  if (!previewBody || !previewTitle || !["school", "sport", "classes", "custom"].includes(typeId)) return;

  const details = getFieldMap("#scheduleDetailsBody");
  const place = getFieldMap("#schedulePlaceBody");
  const color = document.querySelector("#scheduleColorBody [data-schedule-color].is-selected")?.dataset.scheduleColor || scheduleColorSteps[typeId]?.defaultColor || "#47A7B8";
  const reminder = document.querySelector("#scheduleReminderBody [data-reminder-option].choice-card--active")?.dataset.reminderOption || "Без напоминания";
  const isActive = document.querySelector("#scheduleColorBody .schedule-status-toggle")?.classList.contains("is-active") ?? true;
  const note = document.querySelector("#scheduleColorBody textarea")?.value.trim();
  const dayTimes = getScheduleDayTimes();
  const isSchool = typeId === "school";
  const isClasses = typeId === "classes";
  const isCustom = typeId === "custom";

  const title = isSchool
    ? details["Название расписания"] || "Расписание уроков"
    : isCustom
    ? details["Название расписания"] || "Своё расписание"
    : isClasses
      ? details["Название занятия"] || "Занятие"
      : details["Вид спорта / название"] || "Тренировка";
  const subtitle = isSchool
    ? `Уроки · ${isActive ? "Активно" : "Пауза"}`
    : isCustom
    ? `Своё расписание · ${isActive ? "Активно" : "Пауза"}`
    : isClasses
    ? `${details["Тип занятия"] || "Занятие"} · ${isActive ? "Активно" : "Пауза"}`
    : `Спорт · ${isActive ? "Активно" : "Пауза"}`;
  const placeLabel = isClasses || isCustom ? "Место / ссылка" : "Место";
  const teacherLabel = isCustom ? "Дополнение" : isClasses ? "Преподаватель" : "Тренер / секция";
  const placeText = isClasses || isCustom
    ? place["Место / ссылка"] || "Место можно добавить позже"
    : place["Место"] || "Место можно добавить позже";
  const teacherText = isCustom ? place["Дополнение"] : isClasses ? place["Преподаватель / наставник"] : place["Тренер / секция"];
  const schoolLessonRows = isSchool ? getSchoolLessonRows() : [];
  const dayRows = isSchool
    ? schoolLessonRows.length
      ? schoolLessonRows.map(item => `
        <li>
          <span>${escapeHtml(item.day)}</span>
          <strong>${item.lessons.map(lesson => `${lesson.order}. ${escapeHtml(lesson.subject)}${lesson.teacher ? ` · ${escapeHtml(lesson.teacher)}` : ""}`).join("<br>")}</strong>
        </li>
      `).join("")
      : `<li><span>Уроки</span><strong>Можно добавить позже</strong></li>`
    : dayTimes.length
      ? dayTimes.map(item => `<li><span>${escapeHtml(item.day)}</span><strong>${escapeHtml(item.times.join(", "))}</strong></li>`).join("")
      : `<li><span>Дни</span><strong>Можно уточнить позже</strong></li>`;

  previewTitle.textContent = "Проверьте расписание";
  previewBody.innerHTML = `
    <article class="schedule-preview-card" style="--preview-color:${color}">
      <header class="schedule-preview-card__head">
        <span class="schedule-preview-card__dot"></span>
        <div>
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </header>
      <ul class="schedule-preview-list">
        ${dayRows}
        ${!isSchool ? `<li><span>${escapeHtml(placeLabel)}</span><strong>${escapeHtml(placeText)}</strong></li>` : ""}
        ${!isSchool && teacherText ? `<li><span>${escapeHtml(teacherLabel)}</span><strong>${escapeHtml(teacherText)}</strong></li>` : ""}
        <li><span>Напоминание</span><strong>${escapeHtml(reminder)}</strong></li>
      </ul>
      ${note ? `<p class="schedule-preview-note">${escapeHtml(note)}</p>` : ""}
    </article>
    <p class="scenario-note">Если всё верно, сохраните расписание. Если нужно поправить детали, вернитесь назад.</p>
  `;
}

function bindControls() {
  const modalLayer = document.querySelector("#modalLayer");
  const scheduleActions = document.querySelector("#scheduleActions");
  const scheduleBackButton = document.querySelector("#scheduleBackButton");
  const scheduleNextButton = document.querySelector("#scheduleNextButton");
  let scheduleRole = "participant";
  let scheduleStep = "role";
  let selectedScheduleType = "";
  const modals = {
    reminder: document.querySelector("#reminderModal"),
    task: document.querySelector("#taskModal"),
    note: document.querySelector("#noteModal"),
    notes: document.querySelector("#notesModal"),
    birthday: document.querySelector("#birthdayModal"),
    birthdays: document.querySelector("#birthdaysModal"),
    diary: document.querySelector("#diaryModal"),
    diaryEntry: document.querySelector("#diaryEntryModal"),
    diaryUnlock: document.querySelector("#diaryUnlockModal"),
    diaryPin: document.querySelector("#diaryPinModal"),
    sync: document.querySelector("#syncModal"),
    useful: document.querySelector("#usefulModal"),
    reminders: document.querySelector("#remindersModal"),
    schedules: document.querySelector("#schedulesModal"),
    scheduleDetail: document.querySelector("#scheduleDetailModal"),
    dayCard: document.querySelector("#dayCardModal"),
    weekView: document.querySelector("#weekViewModal"),
    schedule: document.querySelector("#scheduleModal")
  };

  document.querySelector('[aria-label="Предыдущий месяц"]')?.addEventListener("click", () => {
    currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1);
    renderCalendar();
  });

  document.querySelector('[aria-label="Следующий месяц"]')?.addEventListener("click", () => {
    currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

  document.querySelector("#calendarGrid")?.addEventListener("click", event => {
    const dayButton = event.target.closest("[data-calendar-date]");
    if (!dayButton) return;
    renderDayCard(parseIsoDate(dayButton.dataset.calendarDate));
    openModal("dayCard");
  });

  function openModal(name) {
    const modal = modals[name];
    if (!modal) return;
    if ((name === "diary" || name === "diaryEntry") && !diaryUnlocked) {
      diaryPendingModal = name;
      loadDiaryPinSettings()
        .then(() => {
          if (hasDiaryPin()) {
            prepareDiaryUnlockForm();
            openModal("diaryUnlock");
          } else {
            prepareDiaryPinForm("setup");
            openModal("diaryPin");
          }
        })
        .catch(() => {
          prepareDiaryPinForm("setup");
          openModal("diaryPin");
        });
      return;
    }
    if (name === "schedule") {
      scheduleEditDraft = null;
      selectedScheduleType = "";
      resetSchoolDayLessons();
      setScheduleRole("participant", { advance: false });
      setScheduleStep("role");
    }
    if (name === "schedules") {
      renderSavedSchedules();
    }
    if (name === "reminders") {
      renderReminderList();
      refreshReminderPushDiagnostics().catch(() => {
        renderReminderPushDiagnostics({
          message: "Не удалось проверить серверные push-уведомления. Локальные напоминания сохранены.",
        });
      });
      syncSavedReminders().catch(() => {
        renderReminderList();
      });
    }
    if (name === "notes") {
      renderNotes();
      syncSavedNotes().catch(() => {
        renderNotes();
      });
    }
    if (name === "birthdays") {
      renderBirthdays();
      syncSavedBirthdays().catch(() => {
        renderBirthdays();
      });
    }
    if (name === "diary") {
      renderDiaryEntries();
      syncSavedDiaryEntries().catch(() => {
        renderDiaryEntries();
      });
    }
    if (name === "diaryUnlock") {
      prepareDiaryUnlockForm();
    }
    if (name === "diaryPin") {
      prepareDiaryPinForm(diaryPinMode);
    }
    if (name === "sync") {
      renderSyncState();
      renderAuthState();
      renderSyncAccountProfile();
      renderPaidFeatureSurfaces();
      renderInstallDiagnostics();
      renderDeviceCheck();
      refreshAccountEntitlements({ silent: true }).catch(() => {
        renderPaidFeatureSurfaces();
      });
      refreshEntitlementEvents({ silent: true }).catch(() => {
        renderEntitlementEventsPanel();
      });
      refreshTranscriptionEvents({ silent: true }).catch(() => {
        renderTranscriptionEventsPanel();
      });
      refreshReminderPushDiagnostics().catch(() => {
        renderDeviceCheck();
      });
      renderDiaryPinSummary();
      loadDiaryPinSettings().catch(() => {
        renderDiaryPinSummary();
      });
      refreshAuthSession()
        .catch(() => {})
        .finally(() => {
          ensureSyncAccountReady().catch(() => {
            setSyncStatus("Синхронизация временно недоступна. Локальные данные сохранены.");
          });
        });
    }
    if (name === "useful") {
      renderPaidFeatureSurfaces();
      refreshAccountEntitlements({ silent: true }).catch(() => {
        renderPaidFeatureSurfaces();
      });
      refreshTranscriptionEvents({ silent: true }).catch(() => {
        renderTranscriptionEventsPanel();
      });
    }
    if (name === "reminder") {
      if (!reminderEditId) {
        prepareNewReminder();
      } else {
        renderReminderEditorState();
      }
      updateReminderPermissionState();
      refreshReminderPushStatus().catch(() => {
        // The local reminder state remains useful even if push diagnostics are unavailable.
      });
    }
    if (name === "task") {
      clearTaskForm();
    }
    if (name === "note") {
      if (!noteEditId) {
        prepareNewNote();
      } else {
        renderNoteEditorState();
      }
    }
    if (name === "birthday") {
      if (!birthdayEditId) {
        prepareNewBirthday();
      } else {
        renderBirthdayEditorState();
      }
    }
    if (name === "diaryEntry") {
      if (!diaryEditId) {
        const draftDate = diaryDraftDateKey ? parseIsoDate(diaryDraftDateKey) : new Date();
        prepareNewDiaryEntry(draftDate);
        diaryDraftDateKey = "";
      } else {
        renderDiaryEditorState();
      }
    }
    Object.values(modals).forEach(item => {
      item.hidden = true;
    });
    modal.hidden = false;
    modalLayer.hidden = false;
    requestAnimationFrame(() => {
      modal.querySelector("textarea, input, button")?.focus();
    });
  }

  function openScheduleEditor(scheduleId) {
    const schedule = savedSchedules.find(item => item.id === scheduleId);
    if (!schedule || !scheduleDetails[schedule.type]) return;

    scheduleEditDraft = JSON.parse(JSON.stringify(schedule));
    scheduleRole = schedule.role || "participant";
    selectedScheduleType = schedule.type;

    setScheduleRole(scheduleRole, { advance: false });
    hydrateSchoolDayLessons(scheduleEditDraft);
    renderScheduleDetails(selectedScheduleType, scheduleRole);
    renderScheduleFollowup(selectedScheduleType);
    setScheduleStep("details");

    Object.values(modals).forEach(item => {
      item.hidden = true;
    });
    modals.schedule.hidden = false;
    modalLayer.hidden = false;
    requestAnimationFrame(() => {
      modals.schedule.querySelector("textarea, input, button")?.focus();
    });
  }

  function closeModal() {
    modalLayer.hidden = true;
    Object.values(modals).forEach(item => {
      item.hidden = true;
    });
    reminderEditId = null;
    renderReminderEditorState();
    noteEditId = null;
    renderNoteEditorState();
    birthdayEditId = null;
    renderBirthdayEditorState();
    diaryEditId = null;
    diaryDraftDateKey = "";
    diaryPendingModal = "";
    renderDiaryEditorState();
  }

  document.querySelector("#quotePrev").addEventListener("click", () => {
    quoteIndex = (quoteIndex - 1 + quotes.length) % quotes.length;
    renderQuote();
  });

  document.querySelector("#quoteNext").addEventListener("click", () => {
    quoteIndex = (quoteIndex + 1) % quotes.length;
    renderQuote();
  });

  const addButton = document.querySelector("#addButton");
  const addMenu = document.querySelector("#addMenu");

  function closeAddMenu() {
    addMenu.hidden = true;
    addButton.setAttribute("aria-expanded", "false");
  }

  addButton.addEventListener("click", () => {
    const nextState = addMenu.hidden;
    addMenu.hidden = !nextState;
    addButton.setAttribute("aria-expanded", String(nextState));
  });

  addMenu.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", closeAddMenu);
  });

  document.querySelector("#scheduleFilters")?.addEventListener("click", event => {
    const filterButton = event.target.closest("[data-schedule-filter]");
    if (!filterButton) return;
    scheduleFilter = filterButton.dataset.scheduleFilter || "all";
    renderSavedSchedules();
  });

  document.querySelector("#reminderFilters")?.addEventListener("click", event => {
    const filterButton = event.target.closest("[data-reminder-filter]");
    if (!filterButton) return;
    reminderFilter = filterButton.dataset.reminderFilter || "active";
    renderReminderList();
  });

  document.querySelector("#savedRemindersList")?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-reminder]");
    if (editButton) {
      if (prepareReminderEdit(editButton.dataset.editReminder)) {
        openModal("reminder");
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-reminder]");
    if (deleteButton) {
      const reminderId = deleteButton.dataset.deleteReminder;
      localReminders = localReminders.filter(reminder => reminder.id !== reminderId);
      focusNotifications.clearReminder(reminderId);
      persistLocalReminders().then(() => {
        scheduleLocalReminders();
        renderReminderList();
        updateReminderPermissionState();
      });
    }
  });

  document.querySelector("#savedNotesList")?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-note]");
    if (editButton) {
      if (prepareNoteEdit(editButton.dataset.editNote)) {
        openModal("note");
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-note]");
    if (deleteButton) {
      savedNotes = savedNotes.filter(note => note.id !== deleteButton.dataset.deleteNote);
      persistSavedNotes();
      renderNotes();
    }
  });

  document.querySelector("#savedBirthdaysList")?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-birthday]");
    if (editButton) {
      if (prepareBirthdayEdit(editButton.dataset.editBirthday)) {
        openModal("birthday");
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-birthday]");
    if (deleteButton) {
      const birthdayId = deleteButton.dataset.deleteBirthday;
      savedBirthdays = savedBirthdays.filter(birthday => birthday.id !== birthdayId);
      localReminders = localReminders.filter(reminder => reminder.id !== `birthday-reminder-${birthdayId}`);
      persistSavedBirthdays();
      persistLocalReminders().then(() => {
        scheduleLocalReminders();
        renderReminderList();
      });
      renderBirthdays();
      renderCalendar();
      renderSummary();
    }
  });

  document.querySelector("#savedDiaryList")?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-diary]");
    if (editButton) {
      if (prepareDiaryEntryEdit(editButton.dataset.editDiary)) {
        openModal("diaryEntry");
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-diary]");
    if (deleteButton) {
      savedDiaryEntries = savedDiaryEntries.filter(entry => entry.id !== deleteButton.dataset.deleteDiary);
      persistSavedDiaryEntries();
      renderDiaryEntries();
      renderCalendar();
      renderSummary();
    }
  });

  document.querySelector("#savedSchedulesList")?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-schedule-list]");
    if (editButton) {
      openScheduleEditor(editButton.dataset.editScheduleList);
      return;
    }

    const toggleButton = event.target.closest("[data-toggle-schedule]");
    if (toggleButton) {
      savedSchedules = savedSchedules.map(schedule => {
        if (schedule.id !== toggleButton.dataset.toggleSchedule) return schedule;
        return { ...schedule, isActive: !schedule.isActive };
      });
      persistSavedSchedules();
      renderSavedSchedules();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-schedule]");
    if (deleteButton) {
      savedSchedules = savedSchedules.filter(schedule => schedule.id !== deleteButton.dataset.deleteSchedule);
      persistSavedSchedules();
      renderSavedSchedules();
      return;
    }

    const detailCard = event.target.closest("[data-open-schedule-detail]");
    if (detailCard) {
      openScheduleDetail(detailCard.dataset.openScheduleDetail, openModal);
    }
  });

  document.querySelector("#savedSchedulesList")?.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("button")) return;
    const detailCard = event.target.closest("[data-open-schedule-detail]");
    if (!detailCard) return;
    event.preventDefault();
    openScheduleDetail(detailCard.dataset.openScheduleDetail, openModal);
  });

  function setScheduleStep(step) {
    scheduleStep = step;
    document.querySelectorAll("[data-schedule-step]").forEach(section => {
      section.hidden = section.dataset.scheduleStep !== step;
    });
    const scheduleTitle = document.querySelector("#scheduleTitle");
    if (scheduleTitle) {
      scheduleTitle.textContent = step === "role"
        ? "Для кого создаём расписание?"
        : step === "type"
          ? (scheduleRole === "mentor" ? "Какое расписание ведёте" : "Какое расписание добавляем")
          : "Добавить расписание";
    }
    scheduleActions.hidden = step === "role";
    scheduleNextButton.hidden = !(
      step === "details" ||
      (step === "followup" && Boolean(scheduleLessonTimeSteps[selectedScheduleType])) ||
      (step === "lessonTime" && Boolean(scheduleLongBreakSteps[selectedScheduleType])) ||
      (step === "longBreak" && Boolean(scheduleSubjectSteps[selectedScheduleType])) ||
      (step === "subjects" && Boolean(scheduleTeacherSteps[selectedScheduleType])) ||
      (step === "teachers" && Boolean(scheduleDayLessonSteps[selectedScheduleType])) ||
      (step === "dayLessons" && Boolean(scheduleDayLessonSteps[selectedScheduleType])) ||
      (step === "followup" && Boolean(schedulePlaceSteps[selectedScheduleType])) ||
      (step === "place" && Boolean(scheduleReminderSteps[selectedScheduleType])) ||
      (step === "reminder" && Boolean(scheduleColorSteps[selectedScheduleType])) ||
      (step === "color" && Boolean(scheduleColorSteps[selectedScheduleType])) ||
      step === "preview"
    );
    scheduleNextButton.textContent = step === "preview" ? "Сохранить" : "Далее";
  }

  function setScheduleRole(role, options = { advance: true }) {
    scheduleRole = role;
    document.querySelectorAll("[data-schedule-role]").forEach(button => {
      button.classList.toggle("choice-card--active", button.dataset.scheduleRole === role);
      button.setAttribute("aria-pressed", String(button.dataset.scheduleRole === role));
    });
    renderScheduleTypes(role);
    if (options.advance) {
      setScheduleStep("type");
    }
  }

  document.querySelectorAll("[data-schedule-role]").forEach(button => {
    button.addEventListener("click", () => {
      setScheduleRole(button.dataset.scheduleRole);
    });
  });

  document.querySelector("#scheduleTypeGrid").addEventListener("click", event => {
    const typeButton = event.target.closest("[data-schedule-type]");
    if (!typeButton) return;
    selectedScheduleType = typeButton.dataset.scheduleType;
    resetSchoolDayLessons();
    renderScheduleDetails(selectedScheduleType, scheduleRole);
    renderScheduleFollowup(selectedScheduleType);
    setScheduleStep("details");
  });

  scheduleBackButton.addEventListener("click", () => {
    if (scheduleStep === "preview") {
      setScheduleStep("color");
      return;
    }
    if (scheduleStep === "color") {
      setScheduleStep("reminder");
      return;
    }
    if (scheduleStep === "reminder") {
      if (scheduleDayLessonSteps[selectedScheduleType]) {
        setScheduleStep("dayLessons");
        return;
      }
      setScheduleStep("place");
      return;
    }
    if (scheduleStep === "lessonTime") {
      setScheduleStep("followup");
      return;
    }
    if (scheduleStep === "longBreak") {
      setScheduleStep("lessonTime");
      return;
    }
    if (scheduleStep === "subjects") {
      setScheduleStep("longBreak");
      return;
    }
    if (scheduleStep === "teachers") {
      setScheduleStep("subjects");
      return;
    }
    if (scheduleStep === "dayLessons") {
      if (schoolDayLessonIndex > 0) {
        schoolDayLessonIndex -= 1;
        renderScheduleDayLessons(selectedScheduleType);
        setScheduleStep("dayLessons");
        return;
      }
      setScheduleStep("teachers");
      return;
    }
    if (scheduleStep === "place") {
      setScheduleStep("followup");
      return;
    }
    if (scheduleStep === "followup") {
      setScheduleStep("details");
      return;
    }
    setScheduleStep(scheduleStep === "details" ? "type" : "role");
  });

  scheduleNextButton.addEventListener("click", () => {
    if (!selectedScheduleType) return;
    if (scheduleStep === "preview") {
      saveCurrentSchedule(selectedScheduleType, scheduleRole);
      openModal("schedules");
      return;
    }
    if (scheduleStep === "details") {
      renderScheduleFollowup(selectedScheduleType);
      setScheduleStep("followup");
      return;
    }
    if (scheduleStep === "followup" && scheduleLessonTimeSteps[selectedScheduleType]) {
      renderScheduleLessonTime(selectedScheduleType);
      setScheduleStep("lessonTime");
      return;
    }
    if (scheduleStep === "lessonTime" && scheduleLongBreakSteps[selectedScheduleType]) {
      renderScheduleLongBreak(selectedScheduleType);
      setScheduleStep("longBreak");
      return;
    }
    if (scheduleStep === "longBreak" && scheduleSubjectSteps[selectedScheduleType]) {
      renderScheduleSubjects(selectedScheduleType);
      setScheduleStep("subjects");
      return;
    }
    if (scheduleStep === "subjects" && scheduleTeacherSteps[selectedScheduleType]) {
      renderScheduleTeachers(selectedScheduleType);
      setScheduleStep("teachers");
      return;
    }
    if (scheduleStep === "teachers" && scheduleDayLessonSteps[selectedScheduleType]) {
      renderScheduleDayLessons(selectedScheduleType);
      setScheduleStep("dayLessons");
      return;
    }
    if (scheduleStep === "dayLessons" && scheduleDayLessonSteps[selectedScheduleType]?.days?.[schoolDayLessonIndex + 1]) {
      schoolDayLessonIndex += 1;
      renderScheduleDayLessons(selectedScheduleType);
      setScheduleStep("dayLessons");
      return;
    }
    if (scheduleStep === "dayLessons" && scheduleReminderSteps[selectedScheduleType]) {
      renderScheduleReminder(selectedScheduleType);
      setScheduleStep("reminder");
      return;
    }
    if (scheduleStep === "dayLessons" && scheduleColorSteps[selectedScheduleType]) {
      renderScheduleColor(selectedScheduleType);
      setScheduleStep("color");
      return;
    }
    if (scheduleStep === "followup" && schedulePlaceSteps[selectedScheduleType]) {
      renderSchedulePlace(selectedScheduleType);
      setScheduleStep("place");
      return;
    }
    if (scheduleStep === "place" && scheduleReminderSteps[selectedScheduleType]) {
      renderScheduleReminder(selectedScheduleType);
      setScheduleStep("reminder");
      return;
    }
    if (scheduleStep === "reminder" && scheduleColorSteps[selectedScheduleType]) {
      renderScheduleColor(selectedScheduleType);
      setScheduleStep("color");
      return;
    }
    if (scheduleStep === "color" && scheduleColorSteps[selectedScheduleType]) {
      renderSchedulePreview(selectedScheduleType);
      setScheduleStep("preview");
    }
  });

  document.querySelectorAll("[data-open-modal]").forEach(button => {
    button.addEventListener("click", () => {
      closeAddMenu();
      openModal(button.dataset.openModal);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeModal);
  });

  document.querySelector("#syncRefreshButton")?.addEventListener("click", () => {
    ensureSyncAccountReady().catch(() => {
      setSyncStatus("Не удалось получить код. Проверьте подключение.");
    });
  });

  document.querySelector("#syncDataRefreshButton")?.addEventListener("click", () => {
    refreshSyncDataStatus();
  });

  document.querySelector("#paidFeaturesRefreshButton")?.addEventListener("click", () => {
    refreshAccountEntitlements();
    refreshEntitlementEvents({ silent: true });
    refreshTranscriptionEvents({ silent: true });
  });

  document.querySelector("#syncConnectButton")?.addEventListener("click", () => {
    connectSyncAccount();
  });

  document.querySelector("#syncCodeCopyButton")?.addEventListener("click", () => {
    copySyncAccountCode();
  });

  document.querySelector("#syncProfileSaveButton")?.addEventListener("click", () => {
    saveSyncAccountProfile();
  });

  document.querySelector("#syncDisconnectButton")?.addEventListener("click", () => {
    disconnectSyncAccount();
  });

  document.querySelector("#authLoginButton")?.addEventListener("click", () => {
    focusAuth.login(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  });

  document.querySelector("#authLogoutButton")?.addEventListener("click", () => {
    logoutAuthSession();
  });

  document.querySelector("#pwaInstallCheckButton")?.addEventListener("click", () => {
    runInstallQualityAction();
  });

  document.querySelector("#deviceCheckRefreshButton")?.addEventListener("click", () => {
    refreshDeviceCheck();
  });

  document.querySelector("#deviceCheckTestButton")?.addEventListener("click", () => {
    sendTestPushNotification();
  });

  document.querySelector("#reminderPermissionButton")?.addEventListener("click", () => {
    enableReminderPushFromButton();
  });

  document.querySelector("#reminderPushEnableButton")?.addEventListener("click", () => {
    enableReminderPushFromButton();
  });

  document.querySelector("#reminderPushRefreshButton")?.addEventListener("click", () => {
    refreshReminderPushDiagnostics({ register: true }).catch(() => {
      renderReminderPushDiagnostics({
        message: "Не удалось проверить серверные push-уведомления. Повторите после подключения.",
      });
    });
  });

  document.querySelector("#reminderPushTestButton")?.addEventListener("click", () => {
    sendTestPushNotification();
  });

  document.querySelector("#reminderTestPushButton")?.addEventListener("click", () => {
    sendTestPushNotification();
  });

  document.querySelector("#reminderSaveButton")?.addEventListener("click", () => {
    saveLocalReminder(closeModal);
  });

  document.querySelector("#taskSaveButton")?.addEventListener("click", () => {
    saveTodayTask(closeModal);
  });

  document.querySelector("#noteSaveButton")?.addEventListener("click", () => {
    saveNote(closeModal);
  });

  document.querySelector("#birthdaySaveButton")?.addEventListener("click", () => {
    saveBirthday(closeModal);
  });

  document.querySelector("#diarySaveButton")?.addEventListener("click", () => {
    saveDiaryEntry(closeModal);
  });

  document.querySelector("#diaryPinSetupButton")?.addEventListener("click", () => {
    diaryPendingModal = "";
    loadDiaryPinSettings()
      .catch(() => null)
      .finally(() => {
        diaryPinMode = hasDiaryPin() ? "change" : "setup";
        openModal("diaryPin");
      });
  });

  document.querySelector("#diaryPinSaveButton")?.addEventListener("click", () => {
    saveDiaryPin(() => {
      const nextModal = diaryPendingModal;
      diaryPendingModal = "";
      if (nextModal) {
        openModal(nextModal);
      } else {
        closeModal();
      }
    });
  });

  document.querySelector("#diaryUnlockButton")?.addEventListener("click", () => {
    unlockDiary(() => {
      const nextModal = diaryPendingModal || "diary";
      diaryPendingModal = "";
      openModal(nextModal);
    });
  });

  document.querySelector("#diaryLockButton")?.addEventListener("click", () => {
    lockDiary(closeModal);
  });

  document.querySelectorAll("#diaryUnlockPin, #diaryPinCurrent, #diaryPinNew, #diaryPinConfirm").forEach(field => {
    field.addEventListener("input", () => {
      field.value = field.value.replace(/\D/g, "").slice(0, 4);
    });
    field.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      if (field.id === "diaryUnlockPin") {
        document.querySelector("#diaryUnlockButton")?.click();
      } else {
        document.querySelector("#diaryPinSaveButton")?.click();
      }
    });
  });

  modalLayer.addEventListener("click", event => {
    const voiceButton = event.target.closest("[data-voice-target]");
    if (voiceButton) {
      handleVoiceInputAction(voiceButton, openModal).catch(() => {
        setVoiceStatus(voiceButton, "Не удалось включить голосовой ввод. Повторите попытку позже.", "bad");
      });
      return;
    }

    const paidFeatureButton = event.target.closest("[data-paid-feature-action]");
    if (paidFeatureButton) {
      handlePaidFeatureAction(paidFeatureButton.dataset.paidFeatureAction, openModal).catch(() => {
        setPaidFeatureCheckoutState({
          status: "failed",
          featureKey: paidFeatureButton.dataset.paidFeatureAction,
        });
        setSyncStatus("Не удалось подготовить оплату подписки. Повторите попытку позже.");
      });
      return;
    }

    const backToSchedulesButton = event.target.closest("[data-back-to-schedules]");
    if (backToSchedulesButton) {
      renderSavedSchedules();
      openModal("schedules");
      return;
    }

    const openWeekButton = event.target.closest("[data-open-week-view]");
    if (openWeekButton) {
      renderWeekView(selectedDayCardDate);
      openModal("weekView");
      return;
    }

    const backToDayCardButton = event.target.closest("[data-back-to-day-card]");
    if (backToDayCardButton) {
      renderDayCard(selectedDayCardDate);
      openModal("dayCard");
      return;
    }

    const openDiaryForDayButton = event.target.closest("[data-open-diary-entry-for-day]");
    if (openDiaryForDayButton) {
      diaryDraftDateKey = toIsoDate(selectedDayCardDate);
      openModal("diaryEntry");
      return;
    }

    const modalOpenButton = event.target.closest("[data-open-modal]");
    if (modalOpenButton) {
      openModal(modalOpenButton.dataset.openModal);
      return;
    }

    const detailStatusButton = event.target.closest("[data-toggle-schedule-detail]");
    if (detailStatusButton) {
      const scheduleId = detailStatusButton.dataset.toggleScheduleDetail;
      savedSchedules = savedSchedules.map(schedule => {
        if (schedule.id !== scheduleId) return schedule;
        return { ...schedule, isActive: !schedule.isActive };
      });
      persistSavedSchedules();
      openScheduleDetail(scheduleId, openModal);
      return;
    }

    const editButton = event.target.closest("[data-edit-schedule]");
    if (editButton) {
      openScheduleEditor(editButton.dataset.editSchedule);
      return;
    }

    const detailDeleteButton = event.target.closest("[data-delete-schedule-detail]");
    if (detailDeleteButton) {
      savedSchedules = savedSchedules.filter(schedule => schedule.id !== detailDeleteButton.dataset.deleteScheduleDetail);
      persistSavedSchedules();
      renderSavedSchedules();
      openModal("schedules");
      return;
    }

    if (event.target === modalLayer) {
      closeModal();
    }
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".add-wrap")) {
      closeAddMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAddMenu();
      closeModal();
    }
  });

  window.addEventListener("focus-pwa-state-change", () => {
    renderInstallDiagnostics();
  });

  function openInitialLaunchTarget() {
    const target = getInitialLaunchTarget();
    if (!target) return;
    closeAddMenu();
    openModal(target);
    clearInitialLaunchTarget();
  }

  return { openInitialLaunchTarget };
}

bindCompactWindowMode();
lockViewportScale();
formatDate();
renderQuote();
renderCalendar();
renderSummary();
renderTasks();
renderLabels();
renderScheduleTypes();
renderSyncDataStatus();
renderPaidFeatureSurfaces();
const controls = bindControls();
refreshAccountEntitlements({ silent: true }).then(() => {
  return checkPendingSubscriptionCheckout({ silent: true });
}).then(() => {
  return refreshEntitlementEvents({ silent: true });
}).then(() => {
  return refreshTranscriptionEvents({ silent: true });
}).catch(() => {
  renderPaidFeatureSurfaces();
});
loadDiaryPinSettings().catch(() => {
  renderDiaryPinSummary();
});
const schedulesReady = hydrateSavedSchedules();
const tasksReady = hydrateSavedTasks();
const notesReady = hydrateSavedNotes();
const remindersReady = hydrateLocalReminders().finally(() => {
  return hydrateSavedBirthdays().finally(() => hydrateSavedDiaryEntries());
});

Promise.allSettled([schedulesReady, tasksReady, notesReady, remindersReady]).finally(() => {
  controls.openInitialLaunchTarget();
});

let pendingOnlineRecoverySync = null;

function flushPendingSyncDeviceDisconnects() {
  return scheduleSync.flushPendingDeviceDisconnects().catch(() => null);
}

function flushPendingSyncAccountProfileUpdate() {
  return scheduleSync.flushPendingAccountProfileUpdate().catch(() => null);
}

function runOnlineRecoverySync() {
  if (pendingOnlineRecoverySync) return pendingOnlineRecoverySync;

  pendingOnlineRecoverySync = Promise.allSettled([
    flushPendingSyncDeviceDisconnects(),
    flushPendingSyncAccountProfileUpdate(),
    syncSavedSchedules(),
    syncSavedTasks(),
    syncSavedNotes(),
    syncSavedBirthdays(),
    syncSavedDiaryEntries(),
    syncSavedReminders(),
    registerServerPushSubscription(),
    refreshReminderPushStatus(),
    checkPendingSubscriptionCheckout({ silent: true }),
    refreshAccountEntitlements({ silent: true }),
    refreshEntitlementEvents({ silent: true }),
    refreshTranscriptionEvents({ silent: true }),
  ]).finally(() => {
    pendingOnlineRecoverySync = null;
  });

  return pendingOnlineRecoverySync;
}

window.addEventListener("online", () => {
  runOnlineRecoverySync();
});

flushPendingSyncDeviceDisconnects();
flushPendingSyncAccountProfileUpdate();
