export const HOLIDAY_SUPPORTED_COUNTRIES = [
  { code: "RU", title: "Россия", language: "ru" },
];

export const HOLIDAY_CALENDAR_KINDS = ["public", "professional", "religious"];
export const HOLIDAY_CATALOG_STATUSES = ["draft", "validation", "approved", "published", "archived"];
export const HOLIDAY_EVENT_TYPES = [
  "public_holiday",
  "commemorative_date",
  "professional_holiday",
  "religious_holiday",
  "additional_day_off",
  "working_weekend",
  "transferred_day_off",
];
export const HOLIDAY_WORKING_DAY_OVERRIDE_TYPES = [
  "additional_day_off",
  "working_weekend",
  "transferred_day_off",
];
export const HOLIDAY_DATE_STATUSES = ["fixed", "calculated", "preliminary", "confirmed"];
export const HOLIDAY_IMPORT_STATUSES = ["draft", "validation", "approved", "published"];

export const HOLIDAY_RELIGIOUS_TRADITIONS = [
  { code: "orthodox", title: "Православный календарь", shortTitle: "Православный" },
  { code: "catholic", title: "Католический календарь", shortTitle: "Католический" },
  { code: "islamic", title: "Исламский календарь", shortTitle: "Исламский" },
];

export const HOLIDAY_PROFESSIONAL_MODES = [
  { code: "none", title: "Не показывать" },
  { code: "all", title: "Показывать все" },
  { code: "selected", title: "Выбрать направления" },
];

export const HOLIDAY_PROFESSIONAL_CATEGORIES = [
  { code: "education", title: "Образование", sortOrder: 10 },
  { code: "medicine_healthcare", title: "Медицина и здравоохранение", sortOrder: 20 },
  { code: "it_telecom", title: "IT и связь", sortOrder: 30 },
  { code: "business_entrepreneurship", title: "Бизнес и предпринимательство", sortOrder: 40 },
  { code: "economics_finance", title: "Экономика и финансы", sortOrder: 50 },
  { code: "law", title: "Право", sortOrder: 60 },
  { code: "government_municipal_service", title: "Государственная и муниципальная служба", sortOrder: 70 },
  { code: "construction_architecture", title: "Строительство и архитектура", sortOrder: 80 },
  { code: "industry_energy", title: "Промышленность и энергетика", sortOrder: 90 },
  { code: "transport_logistics", title: "Транспорт и логистика", sortOrder: 100 },
  { code: "agriculture", title: "Сельское хозяйство", sortOrder: 110 },
  { code: "trade_services", title: "Торговля и сфера услуг", sortOrder: 120 },
  { code: "culture_arts", title: "Культура и искусство", sortOrder: 130 },
  { code: "science", title: "Наука", sortOrder: 140 },
  { code: "media_publishing", title: "СМИ и издательская деятельность", sortOrder: 150 },
  { code: "safety_rescue", title: "Безопасность и спасательные службы", sortOrder: 160 },
  { code: "sport", title: "Спорт", sortOrder: 170 },
  { code: "other_industries", title: "Другие отрасли", sortOrder: 180 },
];

export const HOLIDAY_DEFAULT_PREFERENCES = {
  countryCode: "RU",
  publicHolidaysEnabled: true,
  workingDayOverridesEnabled: true,
  professionalMode: "none",
  professionalCategoryCodes: [],
  hiddenCalendarIds: [],
  setupCompleted: false,
  updatedAt: null,
};

export const HOLIDAY_DEFAULT_RELIGIOUS_PREFERENCES = {
  selectedTraditions: [],
  hiddenCalendarIds: [],
  setupCompleted: false,
  updatedAt: null,
};

const CATALOG_CREATED_AT = "2026-08-04T00:00:00.000Z";
const CATALOG_PUBLISHED_AT = "2026-08-04T00:00:00.000Z";

const RU_2026_PUBLIC_CALENDAR_ID = "holiday-calendar-ru-2026-public";
const RU_2026_PROFESSIONAL_CALENDAR_ID = "holiday-calendar-ru-2026-professional";
const RU_2026_ORTHODOX_CALENDAR_ID = "holiday-calendar-ru-2026-orthodox";
const RU_2026_CATHOLIC_CALENDAR_ID = "holiday-calendar-ru-2026-catholic";
const RU_2026_ISLAMIC_CALENDAR_ID = "holiday-calendar-ru-2026-islamic";

const RU_2026_SOURCES = [
  {
    id: "ru-labor-code-112",
    title: "Трудовой кодекс Российской Федерации, статья 112",
    organization: "Российская Федерация",
    sourceType: "law",
    documentNumber: "ТК РФ ст. 112",
    publicationDate: "2001-12-30",
    sourceUrl: "https://www.consultant.ru/document/cons_doc_LAW_34683/",
  },
  {
    id: "ru-government-decree-2025-1466",
    title: "Постановление Правительства РФ от 24.09.2025 № 1466",
    organization: "Правительство Российской Федерации",
    sourceType: "government_decree",
    documentNumber: "№ 1466",
    publicationDate: "2025-09-24",
    sourceUrl: "https://government.ru/docs/all/161028/",
  },
  {
    id: "ru-professional-editorial-2026",
    title: "Focus approved professional dates seed RU-2026",
    organization: "Focus Holiday Catalog",
    sourceType: "other_official_source",
    publicationDate: "2026-08-04",
    sourceUrl: "https://www.consultant.ru/document/cons_doc_LAW_19238/",
  },
  {
    id: "ru-orthodox-patriarchia-2026",
    title: "Богослужебные указания Русской Православной Церкви на 2026 год",
    organization: "Официальный сайт Московского Патриархата",
    sourceType: "official_religious_calendar",
    publicationDate: "2026-01-01",
    sourceUrl: "https://www.patriarchia.ru/bu/2026-05-31",
  },
  {
    id: "vatican-liturgical-calendar-2026",
    title: "Calendar of Activities 2026",
    organization: "Vatican.va",
    sourceType: "official_religious_calendar",
    publicationDate: "2026-01-01",
    sourceUrl: "https://www.vatican.va/content/liturgy/en/events/year.dir.html/2026.html.html",
  },
  {
    id: "dumrf-islamic-calendar-2026",
    title: "Мусульманские праздники и знаменательные события в 2026 году",
    organization: "Духовное управление мусульман Российской Федерации",
    sourceType: "official_religious_calendar",
    publicationDate: "2025-12-30",
    sourceUrl: "https://new.dumrf.ru/articles/announcement/2026-godu-uraza-bairam-nastupit-20-marta-a-kurban-bairam-27-maia-nacalo-ramadana-19-fevralia",
  },
  {
    id: "dumrf-kurban-2026",
    title: "Богословское заключение ДУМ РФ о Курбан-байраме в 2026 году",
    organization: "Духовное управление мусульман Российской Федерации",
    sourceType: "official_announcement",
    documentNumber: "№ 2/26",
    publicationDate: "2026-05-12",
    sourceUrl: "https://new.dumrf.ru/articles/event/27-maia-kurban-bairam",
  },
];

const RU_2026_CALENDARS = [
  createCalendar({
    id: RU_2026_PUBLIC_CALENDAR_ID,
    code: "RU-2026-PUBLIC",
    title: "Государственные праздники России",
    calendarKind: "public",
  }),
  createCalendar({
    id: RU_2026_PROFESSIONAL_CALENDAR_ID,
    code: "RU-2026-PROFESSIONAL",
    title: "Профессиональные праздники России",
    calendarKind: "professional",
  }),
  createCalendar({
    id: RU_2026_ORTHODOX_CALENDAR_ID,
    code: "RU-2026-ORTHODOX",
    title: "Православный календарь",
    calendarKind: "religious",
    religiousTradition: "orthodox",
  }),
  createCalendar({
    id: RU_2026_CATHOLIC_CALENDAR_ID,
    code: "RU-2026-CATHOLIC",
    title: "Католический календарь",
    calendarKind: "religious",
    religiousTradition: "catholic",
  }),
  createCalendar({
    id: RU_2026_ISLAMIC_CALENDAR_ID,
    code: "RU-2026-ISLAMIC",
    title: "Исламский календарь",
    calendarKind: "religious",
    religiousTradition: "islamic",
  }),
];

const RU_2026_EVENTS = [
  publicEvent("ru-2026-public-new-year-01", "Новогодние каникулы", "2026-01-01", "ru-labor-code-112"),
  publicEvent("ru-2026-public-new-year-02", "Новогодние каникулы", "2026-01-02", "ru-labor-code-112"),
  publicEvent("ru-2026-public-new-year-03", "Новогодние каникулы", "2026-01-03", "ru-labor-code-112"),
  publicEvent("ru-2026-public-new-year-04", "Новогодние каникулы", "2026-01-04", "ru-labor-code-112"),
  publicEvent("ru-2026-public-new-year-05", "Новогодние каникулы", "2026-01-05", "ru-labor-code-112"),
  publicEvent("ru-2026-public-new-year-06", "Новогодние каникулы", "2026-01-06", "ru-labor-code-112"),
  publicEvent("ru-2026-public-christmas", "Рождество Христово", "2026-01-07", "ru-labor-code-112"),
  publicEvent("ru-2026-public-new-year-08", "Новогодние каникулы", "2026-01-08", "ru-labor-code-112"),
  overrideEvent({
    id: "ru-2026-public-day-off-jan-09",
    title: "Выходной день за 3 января",
    startLocalDate: "2026-01-09",
    eventType: "additional_day_off",
    sourceReference: "Перенос с субботы 3 января на пятницу 9 января.",
    relatedLocalDate: "2026-01-03",
  }),
  publicEvent("ru-2026-public-defender", "День защитника Отечества", "2026-02-23", "ru-labor-code-112"),
  publicEvent("ru-2026-public-women", "Международный женский день", "2026-03-08", "ru-labor-code-112"),
  overrideEvent({
    id: "ru-2026-public-day-off-mar-09",
    title: "Выходной день за 8 марта",
    startLocalDate: "2026-03-09",
    eventType: "additional_day_off",
    sourceId: "ru-labor-code-112",
    sourceReference: "Перенос по части второй статьи 112 ТК РФ: праздничный день 8 марта совпадает с воскресеньем.",
    relatedLocalDate: "2026-03-08",
  }),
  publicEvent("ru-2026-public-spring-labor", "Праздник Весны и Труда", "2026-05-01", "ru-labor-code-112"),
  publicEvent("ru-2026-public-victory", "День Победы", "2026-05-09", "ru-labor-code-112"),
  overrideEvent({
    id: "ru-2026-public-day-off-may-11",
    title: "Выходной день за 9 мая",
    startLocalDate: "2026-05-11",
    eventType: "additional_day_off",
    sourceId: "ru-labor-code-112",
    sourceReference: "Перенос по части второй статьи 112 ТК РФ: праздничный день 9 мая совпадает с субботой.",
    relatedLocalDate: "2026-05-09",
  }),
  publicEvent("ru-2026-public-russia", "День России", "2026-06-12", "ru-labor-code-112"),
  publicEvent("ru-2026-public-unity", "День народного единства", "2026-11-04", "ru-labor-code-112"),
  overrideEvent({
    id: "ru-2026-public-day-off-dec-31",
    title: "Выходной день за 4 января",
    startLocalDate: "2026-12-31",
    eventType: "additional_day_off",
    sourceReference: "Перенос с воскресенья 4 января на четверг 31 декабря.",
    relatedLocalDate: "2026-01-04",
  }),

  professionalEvent("ru-2026-prof-press", "День российской печати", "2026-01-13", ["media_publishing"]),
  professionalEvent("ru-2026-prof-science", "День российской науки", "2026-02-08", ["science", "education"]),
  professionalEvent("ru-2026-prof-culture", "День работника культуры", "2026-03-25", ["culture_arts"]),
  professionalEvent("ru-2026-prof-cosmonautics", "День космонавтики", "2026-04-12", ["science", "industry_energy"]),
  professionalEvent("ru-2026-prof-local-government", "День местного самоуправления", "2026-04-21", ["government_municipal_service"]),
  professionalEvent("ru-2026-prof-radio", "День радио", "2026-05-07", ["it_telecom", "media_publishing"]),
  professionalEvent("ru-2026-prof-entrepreneur", "День российского предпринимательства", "2026-05-26", ["business_entrepreneurship"]),
  professionalEvent("ru-2026-prof-medical-worker", "День медицинского работника", "2026-06-21", ["medicine_healthcare"], "calculated"),
  professionalEvent("ru-2026-prof-post", "День российской почты", "2026-07-12", ["transport_logistics", "trade_services"], "calculated"),
  professionalEvent("ru-2026-prof-trade", "День работника торговли", "2026-07-25", ["trade_services"], "calculated"),
  professionalEvent("ru-2026-prof-physical-culture", "День физкультурника", "2026-08-08", ["sport"], "calculated"),
  professionalEvent("ru-2026-prof-railway", "День железнодорожника", "2026-08-02", ["transport_logistics"], "calculated"),
  professionalEvent("ru-2026-prof-builder", "День строителя", "2026-08-09", ["construction_architecture"], "calculated"),
  professionalEvent("ru-2026-prof-financier", "День финансиста", "2026-09-08", ["economics_finance"]),
  professionalEvent("ru-2026-prof-programmer", "День программиста", "2026-09-13", ["it_telecom"], "calculated"),
  professionalEvent("ru-2026-prof-machine-builder", "День машиностроителя", "2026-09-27", ["industry_energy"], "calculated"),
  professionalEvent("ru-2026-prof-teacher", "День учителя", "2026-10-05", ["education"]),
  professionalEvent("ru-2026-prof-agriculture", "День работника сельского хозяйства", "2026-10-11", ["agriculture"], "calculated"),
  professionalEvent("ru-2026-prof-lawyer", "День юриста", "2026-12-03", ["law"]),
  professionalEvent("ru-2026-prof-power-engineer", "День энергетика", "2026-12-22", ["industry_energy"]),
  professionalEvent("ru-2026-prof-rescuer", "День спасателя Российской Федерации", "2026-12-27", ["safety_rescue"]),

  religiousEvent({
    id: "ru-2026-orthodox-christmas",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Рождество Христово",
    tradition: "orthodox",
    startLocalDate: "2026-01-07",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-theophany",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Крещение Господне",
    tradition: "orthodox",
    startLocalDate: "2026-01-19",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-annunciation",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Благовещение Пресвятой Богородицы",
    tradition: "orthodox",
    startLocalDate: "2026-04-07",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-palm-sunday",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Вход Господень в Иерусалим",
    shortTitle: "Вербное воскресенье",
    tradition: "orthodox",
    startLocalDate: "2026-04-05",
    dateStatus: "calculated",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-easter",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Пасха Христова",
    tradition: "orthodox",
    startLocalDate: "2026-04-12",
    dateStatus: "calculated",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-ascension",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Вознесение Господне",
    tradition: "orthodox",
    startLocalDate: "2026-05-21",
    dateStatus: "calculated",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-pentecost",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "День Святой Троицы",
    tradition: "orthodox",
    startLocalDate: "2026-05-31",
    dateStatus: "calculated",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-transfiguration",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Преображение Господне",
    tradition: "orthodox",
    startLocalDate: "2026-08-19",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-dormition",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Успение Пресвятой Богородицы",
    tradition: "orthodox",
    startLocalDate: "2026-08-28",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-nativity-theotokos",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Рождество Пресвятой Богородицы",
    tradition: "orthodox",
    startLocalDate: "2026-09-21",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-cross",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Воздвижение Креста Господня",
    tradition: "orthodox",
    startLocalDate: "2026-09-27",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),
  religiousEvent({
    id: "ru-2026-orthodox-presentation-theotokos",
    calendarId: RU_2026_ORTHODOX_CALENDAR_ID,
    title: "Введение во храм Пресвятой Богородицы",
    tradition: "orthodox",
    startLocalDate: "2026-12-04",
    dateStatus: "fixed",
    sourceId: "ru-orthodox-patriarchia-2026",
  }),

  religiousEvent({
    id: "ru-2026-catholic-mary-mother",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Торжество Пресвятой Богородицы Марии",
    tradition: "catholic",
    startLocalDate: "2026-01-01",
    dateStatus: "fixed",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-epiphany",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Богоявление Господне",
    tradition: "catholic",
    startLocalDate: "2026-01-06",
    dateStatus: "fixed",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-palm-sunday",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Пальмовое воскресенье",
    tradition: "catholic",
    startLocalDate: "2026-03-29",
    dateStatus: "calculated",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-easter",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Пасха",
    tradition: "catholic",
    startLocalDate: "2026-04-05",
    dateStatus: "calculated",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-ascension",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Вознесение Господне",
    tradition: "catholic",
    startLocalDate: "2026-05-14",
    dateStatus: "calculated",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-pentecost",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Пятидесятница",
    tradition: "catholic",
    startLocalDate: "2026-05-24",
    dateStatus: "calculated",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-assumption",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Успение Пресвятой Богородицы",
    tradition: "catholic",
    startLocalDate: "2026-08-15",
    dateStatus: "fixed",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-all-saints",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "День всех святых",
    tradition: "catholic",
    startLocalDate: "2026-11-01",
    dateStatus: "fixed",
    sourceId: "vatican-liturgical-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-catholic-christmas",
    calendarId: RU_2026_CATHOLIC_CALENDAR_ID,
    title: "Рождество Христово",
    tradition: "catholic",
    startLocalDate: "2026-12-25",
    dateStatus: "fixed",
    sourceId: "vatican-liturgical-calendar-2026",
  }),

  religiousEvent({
    id: "ru-2026-islamic-isra-miraj",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Ночь аль-Исра ва-ль-Мирадж",
    tradition: "islamic",
    startLocalDate: "2026-01-16",
    startsAtSunsetPreviousDay: true,
    dateStatus: "preliminary",
    sourceId: "dumrf-islamic-calendar-2026",
    sourceReference: "Дата указана по астрономическим расчётам ДУМ РФ.",
  }),
  religiousEvent({
    id: "ru-2026-islamic-baraat",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Ночь Бараат",
    tradition: "islamic",
    startLocalDate: "2026-02-03",
    startsAtSunsetPreviousDay: true,
    dateStatus: "preliminary",
    sourceId: "dumrf-islamic-calendar-2026",
    sourceReference: "Дата указана по астрономическим расчётам ДУМ РФ.",
  }),
  religiousEvent({
    id: "ru-2026-islamic-ramadan-start",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Начало месяца Рамадан",
    tradition: "islamic",
    startLocalDate: "2026-02-19",
    dateStatus: "preliminary",
    sourceId: "dumrf-islamic-calendar-2026",
    sourceReference: "Дата указана по астрономическим расчётам ДУМ РФ.",
  }),
  religiousEvent({
    id: "ru-2026-islamic-qadr",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Ночь предопределения",
    tradition: "islamic",
    startLocalDate: "2026-03-17",
    startsAtSunsetPreviousDay: true,
    dateStatus: "preliminary",
    sourceId: "dumrf-islamic-calendar-2026",
    sourceReference: "Дата указана по астрономическим расчётам ДУМ РФ.",
  }),
  religiousEvent({
    id: "ru-2026-islamic-eid-fitr",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Ураза-байрам",
    shortTitle: "Ид аль-Фитр",
    tradition: "islamic",
    startLocalDate: "2026-03-20",
    dateStatus: "confirmed",
    sourceId: "dumrf-islamic-calendar-2026",
  }),
  religiousEvent({
    id: "ru-2026-islamic-arafah",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "День Арафа",
    tradition: "islamic",
    startLocalDate: "2026-05-26",
    dateStatus: "confirmed",
    sourceId: "dumrf-kurban-2026",
  }),
  religiousEvent({
    id: "ru-2026-islamic-eid-adha",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Курбан-байрам",
    shortTitle: "Ид аль-Адха",
    tradition: "islamic",
    startLocalDate: "2026-05-27",
    endLocalDate: "2026-05-30",
    dateStatus: "confirmed",
    sourceId: "dumrf-kurban-2026",
  }),
  religiousEvent({
    id: "ru-2026-islamic-hijri-new-year",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Начало 1448 года по хиджре",
    tradition: "islamic",
    startLocalDate: "2026-06-16",
    dateStatus: "preliminary",
    sourceId: "dumrf-islamic-calendar-2026",
    sourceReference: "Дата указана по астрономическим расчётам ДУМ РФ.",
  }),
  religiousEvent({
    id: "ru-2026-islamic-ashura",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "День Ашура",
    tradition: "islamic",
    startLocalDate: "2026-06-25",
    dateStatus: "preliminary",
    sourceId: "dumrf-islamic-calendar-2026",
    sourceReference: "Дата указана по астрономическим расчётам ДУМ РФ.",
  }),
  religiousEvent({
    id: "ru-2026-islamic-mawlid",
    calendarId: RU_2026_ISLAMIC_CALENDAR_ID,
    title: "Мавлид ан-Набий",
    tradition: "islamic",
    startLocalDate: "2026-08-24",
    startsAtSunsetPreviousDay: true,
    dateStatus: "preliminary",
    sourceId: "dumrf-islamic-calendar-2026",
    sourceReference: "Дата указана по астрономическим расчётам ДУМ РФ.",
  }),
];

const RU_2026_CATALOG = {
  catalogId: "focus-holiday-catalog-ru-2026-v1",
  countryCode: "RU",
  calendarYear: 2026,
  version: 1,
  status: "published",
  validFromLocalDate: "2026-01-01",
  validUntilLocalDate: "2026-12-31",
  publishedAt: CATALOG_PUBLISHED_AT,
  createdAt: CATALOG_CREATED_AT,
  updatedAt: CATALOG_PUBLISHED_AT,
  calendars: RU_2026_CALENDARS,
  events: RU_2026_EVENTS,
  sources: RU_2026_SOURCES,
  professionalCategories: HOLIDAY_PROFESSIONAL_CATEGORIES,
  changeLog: [
    {
      id: "ru-2026-v1-published",
      changeType: "event_added",
      title: "Первичная публикация каталога RU-2026",
      changedAt: CATALOG_PUBLISHED_AT,
      reason: "Первый релиз Focus Holiday Calendar Catalog для России.",
    },
  ],
};

const BUNDLED_CATALOGS = new Map([
  [createCatalogKey("RU", 2026), RU_2026_CATALOG],
]);

export function getPublishedHolidayCatalog({ countryCode = "RU", year = 2026 } = {}) {
  const normalizedCountryCode = normalizeHolidayCountryCode(countryCode);
  const calendarYear = normalizeHolidayYear(year);
  const catalog = BUNDLED_CATALOGS.get(createCatalogKey(normalizedCountryCode, calendarYear));
  if (!catalog || catalog.status !== "published") {
    return null;
  }

  return finalizeHolidayCatalog(catalog);
}

export function getHolidayCatalogVersion({ countryCode = "RU", year = 2026 } = {}) {
  const catalog = getPublishedHolidayCatalog({ countryCode, year });
  if (!catalog) {
    return null;
  }

  return {
    countryCode: catalog.countryCode,
    calendarYear: catalog.calendarYear,
    version: catalog.version,
    status: catalog.status,
    publishedAt: catalog.publishedAt,
    checksum: catalog.checksum,
  };
}

export function getProfessionalHolidayCategories() {
  return HOLIDAY_PROFESSIONAL_CATEGORIES.map(category => ({ ...category }));
}

export function normalizeHolidayPreferences(preferences = {}) {
  const source = isPlainObject(preferences) ? preferences : {};
  const categoryCodes = normalizeProfessionalCategoryCodes(
    source.professionalCategoryCodes || source.selectedProfessionalCategoryCodes || []
  );
  const professionalMode = normalizeProfessionalMode(source.professionalMode || source.professionalSelectionMode);
  const normalizedMode = professionalMode === "selected" && !categoryCodes.length ? "none" : professionalMode;

  return {
    countryCode: normalizeHolidayCountryCode(source.countryCode || source.country || HOLIDAY_DEFAULT_PREFERENCES.countryCode) || "RU",
    publicHolidaysEnabled: source.publicHolidaysEnabled !== false && source.includePublicHolidays !== false,
    workingDayOverridesEnabled: source.workingDayOverridesEnabled !== false && source.includeWorkingDayOverrides !== false,
    professionalMode: normalizedMode,
    professionalCategoryCodes: normalizedMode === "selected" ? categoryCodes : [],
    hiddenCalendarIds: normalizeHolidayIdList(source.hiddenCalendarIds),
    setupCompleted: source.setupCompleted === true,
    updatedAt: normalizeIsoTimestamp(source.updatedAt),
  };
}

export function normalizeHolidayReligiousPreferences(preferences = {}) {
  const source = isPlainObject(preferences) ? preferences : {};
  return {
    selectedTraditions: normalizeReligiousTraditions(
      source.selectedTraditions || source.selectedReligiousTraditions || source.religiousTraditions || []
    ),
    hiddenCalendarIds: normalizeHolidayIdList(source.hiddenCalendarIds),
    setupCompleted: source.setupCompleted === true,
    updatedAt: normalizeIsoTimestamp(source.updatedAt),
  };
}

export function validateHolidayPreferences(preferences = {}) {
  const normalized = normalizeHolidayPreferences(preferences);
  const errors = [];

  if (normalized.countryCode !== "RU") {
    errors.push({ code: "unsupported_country", message: "Первый релиз поддерживает только Россию." });
  }

  if (normalized.professionalMode === "selected" && !normalized.professionalCategoryCodes.length) {
    errors.push({ code: "professional_categories_required", message: "Для выбранного режима нужны направления." });
  }

  return {
    ok: errors.length === 0,
    errors,
    preferences: normalized,
  };
}

export function validateHolidayCatalog(catalog = {}, { targetStatus = "published" } = {}) {
  const source = isPlainObject(catalog) ? catalog : {};
  const errors = [];
  const warnings = [];
  const calendarIds = new Set();
  const sourceIds = new Set();
  const eventIds = new Set();
  const eventKeys = new Set();
  const categoryCodes = new Set(HOLIDAY_PROFESSIONAL_CATEGORIES.map(category => category.code));

  if (!source.catalogId) errors.push(validationError("catalog_id_required", "У каталога должен быть идентификатор."));
  if (normalizeHolidayCountryCode(source.countryCode) !== "RU") {
    errors.push(validationError("unsupported_country", "Каталог первого релиза должен быть для RU."));
  }
  if (!normalizeHolidayYear(source.calendarYear)) {
    errors.push(validationError("calendar_year_required", "Нужен календарный год."));
  }
  if (!HOLIDAY_CATALOG_STATUSES.includes(source.status)) {
    errors.push(validationError("invalid_catalog_status", "Неверный статус каталога."));
  }
  if (targetStatus === "published" && source.status !== "published") {
    errors.push(validationError("catalog_not_published", "Production может использовать только published-каталог."));
  }

  if (!Array.isArray(source.calendars) || !source.calendars.length) {
    errors.push(validationError("calendars_required", "Нужен реестр календарей."));
  } else {
    source.calendars.forEach(calendar => {
      if (!calendar?.id) errors.push(validationError("calendar_id_required", "Календарь без id."));
      if (calendar?.id && calendarIds.has(calendar.id)) {
        errors.push(validationError("duplicate_calendar", `Дублируется календарь ${calendar.id}.`));
      }
      if (calendar?.id) calendarIds.add(calendar.id);
      if (!HOLIDAY_CALENDAR_KINDS.includes(calendar?.calendarKind)) {
        errors.push(validationError("invalid_calendar_kind", `Неверный тип календаря ${calendar?.id || ""}.`));
      }
      if (calendar?.calendarKind === "religious" && !normalizeReligiousTradition(calendar.religiousTradition)) {
        errors.push(validationError("religious_tradition_required", `Религиозному календарю нужна традиция ${calendar?.id || ""}.`));
      }
    });
  }

  if (!Array.isArray(source.sources) || !source.sources.length) {
    errors.push(validationError("sources_required", "Нужны источники событий."));
  } else {
    source.sources.forEach(item => {
      if (!item?.id) errors.push(validationError("source_id_required", "Источник без id."));
      if (item?.id && sourceIds.has(item.id)) {
        errors.push(validationError("duplicate_source", `Дублируется источник ${item.id}.`));
      }
      if (item?.id) sourceIds.add(item.id);
      if (!item?.title || !item?.organization || !item?.sourceType) {
        errors.push(validationError("source_fields_required", `Источник ${item?.id || ""} заполнен не полностью.`));
      }
    });
  }

  if (!Array.isArray(source.events) || !source.events.length) {
    errors.push(validationError("events_required", "Нужны события каталога."));
  } else {
    source.events.forEach(event => {
      const eventId = event?.id || "";
      if (!eventId) errors.push(validationError("event_id_required", "Событие без id."));
      if (eventId && eventIds.has(eventId)) {
        errors.push(validationError("duplicate_event_id", `Дублируется событие ${eventId}.`));
      }
      if (eventId) eventIds.add(eventId);
      if (!calendarIds.has(event?.calendarId)) {
        errors.push(validationError("unknown_calendar", `Событие ${eventId} ссылается на неизвестный календарь.`));
      }
      if (!sourceIds.has(event?.sourceId)) {
        errors.push(validationError("source_required", `Событие ${eventId} без проверенного источника.`));
      }
      if (!event?.title || typeof event.title !== "string") {
        errors.push(validationError("event_title_required", `Событие ${eventId} без названия.`));
      }
      if (!HOLIDAY_EVENT_TYPES.includes(event?.eventType)) {
        errors.push(validationError("invalid_event_type", `Неверный тип события ${eventId}.`));
      }
      if (!HOLIDAY_DATE_STATUSES.includes(event?.dateStatus)) {
        errors.push(validationError("invalid_date_status", `Неверный статус даты ${eventId}.`));
      }
      if (!isValidLocalDate(event?.startLocalDate)) {
        errors.push(validationError("invalid_start_date", `Неверная дата начала ${eventId}.`));
      }
      if (event?.endLocalDate && (!isValidLocalDate(event.endLocalDate) || event.endLocalDate < event.startLocalDate)) {
        errors.push(validationError("invalid_end_date", `Неверная дата окончания ${eventId}.`));
      }
      if (event?.startLocalDate && Number(event.startLocalDate.slice(0, 4)) !== Number(source.calendarYear)) {
        errors.push(validationError("event_year_mismatch", `Событие ${eventId} вне года каталога.`));
      }
      if (event?.eventType === "professional_holiday" && !normalizeProfessionalCategoryCodes(event.professionalCategoryCodes).length) {
        errors.push(validationError("professional_category_required", `Профессиональному событию ${eventId} нужна категория.`));
      }
      normalizeProfessionalCategoryCodes(event?.professionalCategoryCodes).forEach(code => {
        if (!categoryCodes.has(code)) {
          errors.push(validationError("unknown_professional_category", `Неизвестная категория ${code} у ${eventId}.`));
        }
      });
      if (event?.eventType === "religious_holiday" && !normalizeReligiousTradition(event.religiousTradition)) {
        errors.push(validationError("religious_tradition_required", `Религиозному событию ${eventId} нужна традиция.`));
      }
      if (event?.religiousTradition === "islamic" && !["preliminary", "confirmed"].includes(event.dateStatus)) {
        errors.push(validationError("islamic_date_status_required", `Исламскому событию ${eventId} нужен preliminary или confirmed.`));
      }
      if (HOLIDAY_WORKING_DAY_OVERRIDE_TYPES.includes(event?.eventType) && !event.sourceReference) {
        errors.push(validationError("working_day_override_source_required", `Переносу ${eventId} нужно основание.`));
      }

      const duplicateKey = [
        event?.countryCode,
        event?.calendarId,
        event?.startLocalDate,
        normalizeComparableText(event?.title),
      ].join("|");
      if (eventKeys.has(duplicateKey)) {
        errors.push(validationError("duplicate_event", `Дублируется событие ${eventId}.`));
      }
      eventKeys.add(duplicateKey);
    });
  }

  if (source.status === "published" && !source.publishedAt) {
    warnings.push({ code: "published_at_missing", message: "У опубликованного каталога нет publishedAt." });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checksum: createHolidayCatalogChecksum(source),
    counts: {
      calendars: Array.isArray(source.calendars) ? source.calendars.length : 0,
      events: Array.isArray(source.events) ? source.events.length : 0,
      sources: Array.isArray(source.sources) ? source.sources.length : 0,
    },
  };
}

export function importHolidayCatalogToStaging(catalog = {}, { dryRun = true, expectedStatus = "approved" } = {}) {
  const validation = validateHolidayCatalog(catalog, { targetStatus: expectedStatus === "published" ? "published" : "approved" });
  const normalizedStatus = HOLIDAY_IMPORT_STATUSES.includes(expectedStatus) ? expectedStatus : "approved";
  const canPublish = normalizedStatus === "published" && catalog?.status === "published" && validation.ok;

  return {
    status: validation.ok ? "validated" : "blocked",
    dryRun: dryRun !== false,
    canPublish,
    targetStatus: normalizedStatus,
    directProductionPublishBlocked: normalizedStatus === "published" && catalog?.status !== "published",
    validation,
    preview: {
      catalogId: catalog?.catalogId || "",
      countryCode: catalog?.countryCode || "",
      calendarYear: catalog?.calendarYear || null,
      version: catalog?.version || null,
      checksum: createHolidayCatalogChecksum(catalog),
    },
  };
}

export function selectHolidayEvents({ catalog, preferences, religiousPreferences, date, userEvents = [] } = {}) {
  const localDate = typeof date === "string" ? normalizeLocalDate(date) : dateToLocalIso(date);
  if (!localDate || !catalog || !Array.isArray(catalog.events)) {
    return mergeHolidayEvents([], userEvents);
  }

  const normalizedPreferences = normalizeHolidayPreferences(preferences);
  const normalizedReligiousPreferences = normalizeHolidayReligiousPreferences(religiousPreferences);
  const hiddenCalendarIds = new Set([
    ...normalizedPreferences.hiddenCalendarIds,
    ...normalizedReligiousPreferences.hiddenCalendarIds,
  ]);
  const calendarById = new Map((catalog.calendars || []).map(calendar => [calendar.id, calendar]));
  const selectedReligiousTraditions = new Set(normalizedReligiousPreferences.selectedTraditions);
  const selectedProfessionalCategories = new Set(normalizedPreferences.professionalCategoryCodes);

  const systemEvents = catalog.events
    .filter(event => event.countryCode === normalizedPreferences.countryCode)
    .filter(event => event.calendarYear === Number(localDate.slice(0, 4)))
    .filter(event => isDateInsideEvent(localDate, event))
    .filter(event => event.isActive !== false)
    .filter(event => {
      const calendar = calendarById.get(event.calendarId);
      if (!calendar || hiddenCalendarIds.has(event.calendarId)) return false;

      if (calendar.calendarKind === "public") {
        if (HOLIDAY_WORKING_DAY_OVERRIDE_TYPES.includes(event.eventType)) {
          return normalizedPreferences.publicHolidaysEnabled && normalizedPreferences.workingDayOverridesEnabled;
        }
        return normalizedPreferences.publicHolidaysEnabled;
      }

      if (calendar.calendarKind === "professional") {
        if (normalizedPreferences.professionalMode === "none") return false;
        if (normalizedPreferences.professionalMode === "all") return true;
        return normalizeProfessionalCategoryCodes(event.professionalCategoryCodes)
          .some(code => selectedProfessionalCategories.has(code));
      }

      if (calendar.calendarKind === "religious") {
        return selectedReligiousTraditions.has(event.religiousTradition);
      }

      return false;
    })
    .map(event => ({
      ...event,
      calendarKind: calendarById.get(event.calendarId)?.calendarKind || "",
      calendarTitle: calendarById.get(event.calendarId)?.title || "",
      isSystemEvent: true,
    }));

  return mergeHolidayEvents(systemEvents, userEvents);
}

export function mergeHolidayEvents(systemEvents = [], userEvents = []) {
  const merged = [];
  const seen = new Map();

  [...systemEvents, ...userEvents].forEach(event => {
    if (!event) return;
    const key = event.isSystemEvent
      ? [event.startLocalDate, event.endLocalDate || "", normalizeComparableText(event.title)].join("|")
      : `user:${event.id || event.title || merged.length}`;
    if (seen.has(key)) {
      const existingIndex = seen.get(key);
      merged[existingIndex] = mergeSystemHolidayDuplicate(merged[existingIndex], event);
      return;
    }
    seen.set(key, merged.length);
    merged.push(event);
  });

  return merged.sort(compareHolidayEvents);
}

function mergeSystemHolidayDuplicate(existing = {}, event = {}) {
  if (!existing.isSystemEvent || !event.isSystemEvent) return existing;
  return {
    ...existing,
    isOfficialNonWorkingDay: existing.isOfficialNonWorkingDay === true || event.isOfficialNonWorkingDay === true,
    mergedEventIds: mergeUniqueValues(existing.mergedEventIds || [existing.id], [event.id]),
    mergedEventTypes: mergeUniqueValues(existing.mergedEventTypes || [existing.eventType], [event.eventType]),
    mergedCalendarKinds: mergeUniqueValues(existing.mergedCalendarKinds || [existing.calendarKind], [event.calendarKind]),
    mergedCalendarTitles: mergeUniqueValues(existing.mergedCalendarTitles || [existing.calendarTitle], [event.calendarTitle]),
    mergedReligiousTraditions: mergeUniqueValues(existing.mergedReligiousTraditions || [existing.religiousTradition], [event.religiousTradition]),
  };
}

function mergeUniqueValues(existingValues = [], nextValues = []) {
  return [...new Set([...existingValues, ...nextValues].filter(Boolean))];
}

export function getHolidayEventColor(event = {}) {
  if (event.eventType === "working_weekend") return "#4C433A";
  if (HOLIDAY_WORKING_DAY_OVERRIDE_TYPES.includes(event.eventType)) return "#C56A4B";
  if (event.eventType === "professional_holiday") return "#5F9073";
  if (event.eventType === "religious_holiday") {
    if (event.religiousTradition === "islamic") return "#47A7B8";
    if (event.religiousTradition === "catholic") return "#8C7AE6";
    return "#D89A3D";
  }
  return "#D96B5F";
}

export function getHolidayEventTypeLabel(event = {}) {
  if (event.eventType === "public_holiday") return event.isOfficialNonWorkingDay ? "Государственный праздник" : "Памятная дата";
  if (event.eventType === "additional_day_off") return "Официальный нерабочий день";
  if (event.eventType === "transferred_day_off") return "Перенесённый выходной";
  if (event.eventType === "working_weekend") return "Рабочий день после переноса";
  if (event.eventType === "professional_holiday") return "Профессиональный праздник";
  if (event.eventType === "religious_holiday") return "Религиозный календарь";
  return "Системное событие";
}

export function getHolidayDateStatusMessage(event = {}) {
  if (event.religiousTradition === "islamic" && event.dateStatus === "preliminary") {
    return "Дата может быть уточнена ближе к событию.";
  }
  return "";
}

export function createHolidayCatalogChecksum(catalog = {}) {
  const source = isPlainObject(catalog) ? { ...catalog } : {};
  delete source.checksum;
  const serialized = stableStringify(source);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function finalizeHolidayCatalog(catalog) {
  const clone = cloneJson(catalog);
  clone.checksum = createHolidayCatalogChecksum(clone);
  return clone;
}

function createCalendar({ id, code, title, calendarKind, religiousTradition = undefined }) {
  return {
    id,
    countryCode: "RU",
    code,
    title,
    language: "ru",
    calendarKind,
    ...(religiousTradition ? { religiousTradition } : {}),
    calendarYear: 2026,
    version: 1,
    status: "published",
    validFromLocalDate: "2026-01-01",
    validUntilLocalDate: "2026-12-31",
    createdAt: CATALOG_CREATED_AT,
    updatedAt: CATALOG_PUBLISHED_AT,
  };
}

function publicEvent(id, title, startLocalDate, sourceId) {
  return createEvent({
    id,
    calendarId: RU_2026_PUBLIC_CALENDAR_ID,
    title,
    eventType: "public_holiday",
    startLocalDate,
    isOfficialNonWorkingDay: true,
    importance: "major",
    dateStatus: "fixed",
    sourceId,
  });
}

function overrideEvent({
  id,
  title,
  startLocalDate,
  eventType,
  sourceReference,
  relatedLocalDate,
  sourceId = "ru-government-decree-2025-1466",
}) {
  return createEvent({
    id,
    calendarId: RU_2026_PUBLIC_CALENDAR_ID,
    title,
    description: "Официальный перенос выходного дня хранится отдельно от праздничного события.",
    eventType,
    startLocalDate,
    isOfficialNonWorkingDay: eventType !== "working_weekend",
    importance: "regular",
    dateStatus: "confirmed",
    sourceId,
    sourceReference,
    relatedLocalDate,
  });
}

function professionalEvent(id, title, startLocalDate, professionalCategoryCodes, dateStatus = "fixed") {
  return createEvent({
    id,
    calendarId: RU_2026_PROFESSIONAL_CALENDAR_ID,
    title,
    eventType: "professional_holiday",
    professionalCategoryCodes,
    startLocalDate,
    isOfficialNonWorkingDay: false,
    importance: "regular",
    dateStatus,
    sourceId: "ru-professional-editorial-2026",
  });
}

function religiousEvent({
  id,
  calendarId,
  title,
  shortTitle,
  tradition,
  startLocalDate,
  endLocalDate,
  startsAtSunsetPreviousDay = false,
  dateStatus,
  sourceId,
  sourceReference,
}) {
  return createEvent({
    id,
    calendarId,
    title,
    shortTitle,
    eventType: "religious_holiday",
    religiousTradition: tradition,
    startLocalDate,
    ...(endLocalDate ? { endLocalDate } : {}),
    startsAtSunsetPreviousDay,
    isOfficialNonWorkingDay: false,
    importance: "major",
    dateStatus,
    sourceId,
    ...(sourceReference ? { sourceReference } : {}),
  });
}

function createEvent(event) {
  return {
    countryCode: "RU",
    calendarYear: 2026,
    catalogVersion: 1,
    isActive: true,
    createdAt: CATALOG_CREATED_AT,
    updatedAt: CATALOG_PUBLISHED_AT,
    ...event,
  };
}

function normalizeProfessionalMode(value) {
  const mode = String(value || "").trim();
  return ["none", "all", "selected"].includes(mode) ? mode : "none";
}

function normalizeProfessionalCategoryCodes(value) {
  const knownCodes = new Set(HOLIDAY_PROFESSIONAL_CATEGORIES.map(category => category.code));
  const seen = new Set();
  return Array.isArray(value)
    ? value
      .map(item => String(item || "").trim())
      .filter(code => knownCodes.has(code) && !seen.has(code) && seen.add(code))
    : [];
}

function normalizeReligiousTraditions(value) {
  const seen = new Set();
  return Array.isArray(value)
    ? value
      .map(normalizeReligiousTradition)
      .filter(code => code && !seen.has(code) && seen.add(code))
    : [];
}

function normalizeReligiousTradition(value) {
  const tradition = String(value || "").trim();
  return HOLIDAY_RELIGIOUS_TRADITIONS.some(item => item.code === tradition) ? tradition : "";
}

function normalizeHolidayCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return HOLIDAY_SUPPORTED_COUNTRIES.some(country => country.code === code) ? code : "";
}

function normalizeHolidayYear(value) {
  const year = Math.floor(Number(value));
  return Number.isInteger(year) && year >= 2026 && year <= 2100 ? year : 0;
}

function normalizeHolidayIdList(value) {
  const seen = new Set();
  return Array.isArray(value)
    ? value
      .map(item => String(item || "").trim())
      .filter(item => /^[a-zA-Z0-9_.:-]{1,180}$/.test(item) && !seen.has(item) && seen.add(item))
      .slice(0, 40)
    : [];
}

function normalizeLocalDate(value) {
  const date = String(value || "").trim();
  return isValidLocalDate(date) ? date : "";
}

function normalizeIsoTimestamp(value) {
  const timestamp = String(value || "").trim();
  if (!timestamp) return null;
  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function isDateInsideEvent(localDate, event) {
  const start = normalizeLocalDate(event?.startLocalDate);
  const end = normalizeLocalDate(event?.endLocalDate) || start;
  return Boolean(start) && localDate >= start && localDate <= end;
}

function isValidLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateToLocalIso(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareHolidayEvents(first, second) {
  const firstDate = first?.startLocalDate || "";
  const secondDate = second?.startLocalDate || "";
  if (firstDate !== secondDate) return firstDate.localeCompare(secondDate);

  const firstRank = getEventSortRank(first);
  const secondRank = getEventSortRank(second);
  if (firstRank !== secondRank) return firstRank - secondRank;

  return String(first?.title || "").localeCompare(String(second?.title || ""), "ru");
}

function getEventSortRank(event = {}) {
  if (event.eventType === "public_holiday") return 10;
  if (HOLIDAY_WORKING_DAY_OVERRIDE_TYPES.includes(event.eventType)) return 20;
  if (event.eventType === "professional_holiday") return 30;
  if (event.eventType === "religious_holiday") return 40;
  return 90;
}

function createCatalogKey(countryCode, year) {
  return `${countryCode}:${year}`;
}

function validationError(code, message) {
  return { code, message };
}

function normalizeComparableText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
