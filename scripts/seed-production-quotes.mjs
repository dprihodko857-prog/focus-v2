import { pathToFileURL } from "node:url";

import { createSyncDatabase } from "../server/sync-server.mjs";

export const QUOTE_SEED_PER_CATEGORY = 450;
export const QUOTE_SEED_ID_PREFIX = "focus-seed";
export const QUOTE_SEED_CREATED_AT = "2026-08-04T00:00:00.000Z";

const CATEGORY_BLUEPRINTS = [
  {
    code: "life_wisdom",
    titleRu: "Жизнь и мудрость",
    anchor: "жизненной мудрости",
    focus: ["мудрость", "опыт", "выбор", "терпение", "зрелость", "наблюдение", "память", "поступок", "взгляд", "урок"],
    companion: ["вниманием", "честностью", "паузой", "простотой", "ответственностью", "добротой", "тишиной", "смелостью", "мерой"],
    outcome: ["ясность", "опора", "понимание", "спокойная сила", "новый смысл"],
  },
  {
    code: "motivation",
    titleRu: "Мотивация и вдохновение",
    anchor: "движения вперед",
    focus: ["движение", "намерение", "усилие", "шаг", "решение", "энергия", "старт", "настойчивость", "путь", "ритм"],
    companion: ["верой", "дисциплиной", "интересом", "поддержкой", "смелостью", "ясностью", "практикой", "целью", "терпением"],
    outcome: ["импульс", "уверенность", "новый ход", "сила действия", "пространство роста"],
  },
  {
    code: "love_relationships",
    titleRu: "Любовь и отношения",
    anchor: "отношений",
    focus: ["близость", "уважение", "внимание", "нежность", "диалог", "забота", "доверие", "присутствие", "тепло", "искренность"],
    companion: ["тактом", "слушанием", "мягкостью", "честностью", "терпением", "щедростью", "тишиной", "согласием", "уважением"],
    outcome: ["доверие", "тепло", "мир в доме", "глубина", "общий свет"],
  },
  {
    code: "family_children",
    titleRu: "Семья и дети",
    anchor: "семейного ритма",
    focus: ["дом", "семья", "забота", "родительство", "детство", "традиция", "вечер", "поддержка", "разговор", "уют"],
    companion: ["терпением", "вниманием", "лаской", "порядком", "игрой", "честностью", "теплом", "юмором", "принятием"],
    outcome: ["устойчивость", "близость", "радость", "бережный ритм", "чувство дома"],
  },
  {
    code: "friendship_people",
    titleRu: "Дружба и люди",
    anchor: "человеческих связей",
    focus: ["дружба", "общение", "доверие", "встреча", "поддержка", "разговор", "открытость", "участие", "уважение", "искренность"],
    companion: ["слушанием", "верностью", "тактом", "юмором", "добротой", "прямотой", "вниманием", "мягкостью", "согласием"],
    outcome: ["надежность", "легкость", "тепло", "общий путь", "сильная связь"],
  },
  {
    code: "health_self_care",
    titleRu: "Здоровье и забота о себе",
    anchor: "заботы о себе",
    focus: ["здоровье", "сон", "дыхание", "организм", "ресурс", "забота", "пауза", "движение", "восстановление", "самочувствие"],
    companion: ["регулярностью", "бережностью", "вниманием", "мерой", "тишиной", "прогулкой", "водой", "покоем", "терпением"],
    outcome: ["ровная энергия", "ясность", "легкость", "устойчивость", "спокойный тонус"],
  },
  {
    code: "work_vocation",
    titleRu: "Работа и призвание",
    anchor: "призвания",
    focus: ["ремесло", "труд", "призвание", "ответственность", "мастерство", "задача", "проект", "усилие", "дело", "практика"],
    companion: ["точностью", "терпением", "интересом", "порядком", "честностью", "вниманием", "ритмом", "смыслом", "уважением"],
    outcome: ["мастерство", "результат", "профессиональная сила", "ясный вклад", "ценность труда"],
  },
  {
    code: "business",
    titleRu: "Бизнес и предпринимательство",
    anchor: "предпринимательства",
    focus: ["дело", "решение", "рынок", "ценность", "сервис", "идея", "риск", "рост", "продукт", "партнерство"],
    companion: ["расчетом", "доверием", "честностью", "скоростью", "вниманием", "смелостью", "фокусом", "проверкой", "простотой"],
    outcome: ["устойчивая модель", "полезный результат", "ясная сделка", "рост доверия", "ценность для людей"],
  },
  {
    code: "goals_success",
    titleRu: "Цели и успех",
    anchor: "целей",
    focus: ["цель", "успех", "план", "направление", "достижение", "приоритет", "шаг", "выбор", "маршрут", "результат"],
    companion: ["ясностью", "постоянством", "смелостью", "мерой", "дисциплиной", "терпением", "фокусом", "ритмом", "проверкой"],
    outcome: ["движение вперед", "уверенный результат", "собранность", "точная траектория", "сила намерения"],
  },
  {
    code: "self_development",
    titleRu: "Саморазвитие и знания",
    anchor: "обучения",
    focus: ["знание", "обучение", "навык", "вопрос", "любопытство", "практика", "чтение", "наблюдение", "ошибка", "исследование"],
    companion: ["терпением", "вниманием", "повторением", "интересом", "честностью", "практикой", "проверкой", "тишиной", "смелостью"],
    outcome: ["понимание", "новый навык", "широкий взгляд", "ясная мысль", "личный рост"],
  },
  {
    code: "calm_balance",
    titleRu: "Спокойствие и внутреннее равновесие",
    anchor: "внутреннего равновесия",
    focus: ["спокойствие", "тишина", "пауза", "дыхание", "равновесие", "ясность", "покой", "присутствие", "мера", "устойчивость"],
    companion: ["мягкостью", "вниманием", "ритмом", "терпением", "простотой", "доверием", "порядком", "покоем", "бережностью"],
    outcome: ["внутренняя опора", "ровный день", "светлая мысль", "тихая сила", "ясное решение"],
  },
  {
    code: "creativity",
    titleRu: "Творчество",
    anchor: "творчества",
    focus: ["идея", "образ", "форма", "воображение", "эскиз", "замысел", "поиск", "голос", "цвет", "создание"],
    companion: ["смелостью", "игрой", "вниманием", "тишиной", "практикой", "любопытством", "свободой", "точностью", "теплом"],
    outcome: ["живая форма", "новый образ", "свежий ход", "собственный стиль", "искреннее звучание"],
  },
  {
    code: "humor",
    titleRu: "Юмор и хорошее настроение",
    anchor: "доброго настроения",
    focus: ["улыбка", "легкость", "шутка", "настроение", "ирония", "радость", "игра", "смех", "остроумие", "добрый взгляд"],
    companion: ["тактом", "теплом", "мерой", "вниманием", "добротой", "легкостью", "свежестью", "простотой", "искренностью"],
    outcome: ["хороший день", "мягкая пауза", "легкое общение", "теплый след", "радость без шума"],
  },
  {
    code: "time_productivity",
    titleRu: "Время и продуктивность",
    anchor: "времени",
    focus: ["время", "план", "день", "приоритет", "календарь", "задача", "ритм", "фокус", "порядок", "темп"],
    companion: ["ясностью", "мерой", "простотой", "дисциплиной", "паузой", "точностью", "вниманием", "реализмом", "ритмом"],
    outcome: ["свободное окно", "спокойный результат", "собранный день", "больше внимания", "точное действие"],
  },
];

export function createProductionQuoteSeed({ perCategory = QUOTE_SEED_PER_CATEGORY } = {}) {
  const normalizedPerCategory = Math.max(1, Math.floor(Number(perCategory) || QUOTE_SEED_PER_CATEGORY));
  return CATEGORY_BLUEPRINTS.flatMap(category => createCategoryQuotes(category, normalizedPerCategory));
}

export function getProductionQuoteSeedSummary(quotes = createProductionQuoteSeed()) {
  const categoryCounts = new Map(CATEGORY_BLUEPRINTS.map(category => [category.code, 0]));
  quotes.forEach(quote => {
    (quote.categoryCodes || []).forEach(code => {
      if (categoryCounts.has(code)) {
        categoryCounts.set(code, categoryCounts.get(code) + 1);
      }
    });
  });

  return {
    quoteCount: quotes.length,
    categoryCount: categoryCounts.size,
    perCategory: Object.fromEntries(categoryCounts),
  };
}

export function importProductionQuoteSeed(dbPath, { replaceSeed = true } = {}) {
  if (!dbPath) {
    throw new Error("dbPath is required.");
  }

  const db = createSyncDatabase(dbPath);
  try {
    const seedQuotes = createProductionQuoteSeed();
    const existingQuotes = db.getQuoteCatalog();
    const preservedQuotes = replaceSeed
      ? existingQuotes.filter(quote => !String(quote.id || "").startsWith(`${QUOTE_SEED_ID_PREFIX}-`))
      : existingQuotes;
    const saved = db.replaceQuoteCatalog({ quotes: [...preservedQuotes, ...seedQuotes] });
    const audit = db.auditQuoteCatalogForProduction({ checkedAt: new Date().toISOString() });
    const summary = getProductionQuoteSeedSummary(saved.quotes.filter(quote => String(quote.id || "").startsWith(`${QUOTE_SEED_ID_PREFIX}-`)));
    return {
      status: "imported",
      dbPath,
      replaceSeed,
      preservedQuoteCount: preservedQuotes.length,
      seedQuoteCount: seedQuotes.length,
      totalQuoteCount: saved.quotes.length,
      audit,
      summary,
    };
  } finally {
    db.close();
  }
}

function createCategoryQuotes(category, perCategory) {
  const quotes = [];
  let quoteIndex = 0;

  for (const focus of category.focus) {
    for (const companion of category.companion) {
      for (const outcome of category.outcome) {
        if (quotes.length >= perCategory) return quotes;
        quoteIndex += 1;
        quotes.push(createQuoteRecord({
          category,
          focus,
          companion,
          outcome,
          quoteIndex,
        }));
      }
    }
  }

  if (quotes.length < perCategory) {
    throw new Error(`Not enough phrase combinations for ${category.code}: ${quotes.length}/${perCategory}.`);
  }

  return quotes;
}

function createQuoteRecord({ category, focus, companion, outcome, quoteIndex }) {
  const id = `${QUOTE_SEED_ID_PREFIX}-${category.code}-${String(quoteIndex).padStart(3, "0")}`;
  return {
    id,
    text: `В теме ${category.anchor} ${focus} встречается с ${companion}, и появляется ${outcome}.`,
    authorName: "Редакция Focus",
    authorNameOriginal: "Focus Editorial",
    sourceTitle: "Редакционный каталог Focus 2026",
    sourceType: "other",
    sourceReference: `${category.titleRu}, запись ${quoteIndex}`,
    publicationYear: 2026,
    originalLanguage: "ru",
    displayLanguage: "ru",
    verificationStatus: "verified",
    rightsStatus: "permission_granted",
    rightsNote: "Оригинальная редакционная формулировка Focus для production-каталога.",
    mood: getCategoryMood(category.code),
    isActive: true,
    verifiedBy: "Focus Editorial",
    verifiedAt: QUOTE_SEED_CREATED_AT,
    createdAt: QUOTE_SEED_CREATED_AT,
    updatedAt: QUOTE_SEED_CREATED_AT,
    categoryCodes: [category.code],
  };
}

function getCategoryMood(categoryCode) {
  if (categoryCode === "humor") return "light";
  if (categoryCode === "calm_balance" || categoryCode === "health_self_care") return "calm";
  if (categoryCode === "motivation" || categoryCode === "goals_success") return "active";
  return "balanced";
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function runCli() {
  const [command = "summary", dbPath = "", ...flags] = process.argv.slice(2);
  const replaceSeed = !flags.includes("--preserve-existing-seed");

  if (command === "summary") {
    printJson(getProductionQuoteSeedSummary());
    return;
  }

  if (command === "import") {
    printJson(importProductionQuoteSeed(dbPath, { replaceSeed }));
    return;
  }

  printJson({
    status: "failed",
    error: "unknown_command",
    usage: "node scripts/seed-production-quotes.mjs summary | import <dbPath> [--preserve-existing-seed]",
  });
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
