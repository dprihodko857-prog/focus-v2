import { readFileSync, writeFileSync } from "node:fs";
import {
  DEFAULT_INTERESTING_TODAY_CATALOG,
} from "../server/interesting-today-catalog.mjs";

const CATALOG_PATH = "server/interesting-today-catalog.mjs";
const NEXT_VERSION = "interesting-today-ru@2027-08-04.v6";

const UPDATED_RECORDS = [
  {
    id: "it-event-1268-02-18-rakovorskaya-bitva-v-kotoroi-voi-ska-livonskogo-ordena-poterpeli",
    type: "event",
    month: 2,
    day: 18,
    year: 1268,
    titleRu: "Раковорская битва: победа русских княжеств над Ливонским орденом",
    summaryRu: "Войска новгородцев, псковичей и их союзников разбили силы Ливонского ордена у Раковора.",
    descriptionRu: "Раковорская битва 1268 года стала одним из крупных столкновений северо-западной Руси с Ливонским орденом. Для русскоязычной подборки эта дата важна как эпизод военной истории Новгорода и Пскова.",
    primaryCountryCode: "RU",
    countryCodes: ["RU", "EE", "EU", "WORLD"],
    themeCodes: ["military", "state"],
    significance: 90,
    dateStatus: "exact",
    sources: [
      {
        id: "source-prlib-rakovor-1268",
        titleRu: "Раковорская битва",
        publisherRu: "Президентская библиотека",
        url: "https://www.prlib.ru/history/619035",
        sourceType: "presidential_library",
      },
    ],
  },
  {
    id: "it-person-1792-02-29-dzhoakkino-rossini-um-1868",
    type: "person",
    month: 2,
    day: 29,
    birthYear: 1792,
    deathYear: 1868,
    nameRu: "Джоаккино Россини",
    summaryRu: "итальянский композитор, автор оперы «Севильский цирюльник»",
    descriptionRu: "Джоаккино Россини вошёл в историю европейской музыки как один из главных оперных композиторов XIX века. В каталоге он остаётся мировой культурной фигурой, но без российской страновой метки.",
    primaryCountryCode: "IT",
    countryCodes: ["IT", "WORLD"],
    themeCodes: ["culture", "art"],
    significance: 88,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-persons-2-29",
        titleRu: "Кто родился 29 февраля, кто умер 29 февраля",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/persons/2-29/",
        sourceType: "calendar_biographies",
      },
    ],
  },
  {
    id: "it-event-1999-09-24-calend-ru-5299-v-londone-na-bei-ker-strit-otkryt-pamyatnik-sherloku-kholmsu",
    type: "event",
    month: 9,
    day: 24,
    year: 1999,
    titleRu: "В Лондоне на Бейкер-стрит открыт памятник Шерлоку Холмсу",
    summaryRu: "В Лондоне открыли памятник литературному герою Артура Конан Дойла Шерлоку Холмсу.",
    descriptionRu: "Памятник на Бейкер-стрит относится к британской литературной и городской культуре. Запись сохранена как мировая культурная дата, но больше не считается российским контекстом.",
    primaryCountryCode: "GB",
    countryCodes: ["GB", "WORLD"],
    themeCodes: ["culture", "literature"],
    significance: 84,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-5299",
        titleRu: "В Лондоне на Бейкер-стрит открыт памятник Шерлоку Холмсу",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/5299/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-event-1863-01-10-calend-ru-4196-v-londone-otkrylas-pervaya-v-mire-liniya-metro",
    type: "event",
    month: 1,
    day: 10,
    year: 1863,
    titleRu: "В Лондоне открылась первая в мире линия метро",
    summaryRu: "В Лондоне начала работу первая линия метрополитена, ставшая новым этапом городского транспорта.",
    descriptionRu: "Открытие лондонского метро относится к истории Великобритании и мирового городского транспорта. Запись сохранена в каталоге, но больше не помечается как российская.",
    primaryCountryCode: "GB",
    countryCodes: ["GB", "WORLD"],
    themeCodes: ["technology", "society"],
    significance: 88,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-4196",
        titleRu: "В Лондоне открылась первая в мире линия метро",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/4196/",
        sourceType: "calendar_chronology",
      },
    ],
  },
];

const ADDITIONS = [
  {
    id: "it-event-1928-01-07-calend-ru-4157-po2-flight-tests",
    type: "event",
    month: 1,
    day: 7,
    year: 1928,
    titleRu: "Начались лётные испытания самолёта У-2 (По-2)",
    summaryRu: "Советский самолёт У-2, позднее известный как По-2, вышел на лётные испытания.",
    descriptionRu: "У-2 стал одним из самых массовых советских самолётов и использовался в учебной, связной, санитарной и военной авиации. Для русскоязычной аудитории это заметная дата истории отечественной авиации.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["technology", "military"],
    significance: 88,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-4157",
        titleRu: "Начались летные испытания самолета У-2",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/4157/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-event-1942-01-08-calend-ru-7378-rzhev-battle-began",
    type: "event",
    month: 1,
    day: 8,
    year: 1942,
    titleRu: "Началась Ржевская битва",
    summaryRu: "Советские войска начали Ржевско-Вяземскую стратегическую наступательную операцию.",
    descriptionRu: "Ржевская битва стала одной из самых тяжёлых страниц Великой Отечественной войны. Эта дата усиливает российский исторический контекст 8 января без вытеснения уже существующих мировых записей.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["military", "state"],
    significance: 94,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-7378",
        titleRu: "Началась Ржевская битва",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/7378/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-event-1781-01-10-prlib-petrovsky-theatre-opened",
    type: "event",
    month: 1,
    day: 10,
    year: 1781,
    titleRu: "В Москве открылся Петровский театр",
    summaryRu: "Открылось каменное здание Петровского театра, предшественника Большого театра.",
    descriptionRu: "Петровский театр стал первым постоянным публичным театром старой Москвы. Позднее на его месте было построено здание Большого театра, поэтому дата важна для истории российской сценической культуры.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["culture", "art"],
    significance: 92,
    dateStatus: "exact",
    sources: [
      {
        id: "source-prlib-petrovsky-theatre-1781",
        titleRu: "В Москве открылся Петровский театр",
        publisherRu: "Президентская библиотека",
        url: "https://www.prlib.ru/history/618931",
        sourceType: "presidential_library",
      },
    ],
  },
  {
    id: "it-event-1942-01-10-stavka-directive-03",
    type: "event",
    month: 1,
    day: 10,
    year: 1942,
    titleRu: "Ставка ВГК издала директивное письмо № 03",
    summaryRu: "Ставка Верховного Главнокомандования обобщила опыт наступательных операций Красной армии.",
    descriptionRu: "Директивное письмо № 03 от 10 января 1942 года закрепляло выводы из зимнего контрнаступления и рекомендации по прорыву обороны противника. Запись добавлена как военный и управленческий контекст Великой Отечественной войны.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["military", "state"],
    significance: 86,
    dateStatus: "exact",
    sources: [
      {
        id: "source-wikisource-stavka-directive-03",
        titleRu: "Директивное письмо Ставки Верховного Главнокомандования № 03",
        publisherRu: "Викитека",
        url: "https://ru.wikisource.org/wiki/%D0%A1%D0%B1%D0%BE%D1%80%D0%BD%D0%B8%D0%BA_%D0%B1%D0%BE%D0%B5%D0%B2%D1%8B%D1%85_%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%BE%D0%B2/05/04",
        sourceType: "document_archive",
      },
    ],
  },
  {
    id: "it-event-1920-01-17-historyrussia-death-penalty-decree",
    type: "event",
    month: 1,
    day: 17,
    year: 1920,
    titleRu: "В РСФСР приняли постановление об отмене смертной казни",
    summaryRu: "ВЦИК и СНК РСФСР приняли постановление об отмене применения расстрела как высшей меры наказания.",
    descriptionRu: "Постановление 17 января 1920 года отражает раннюю советскую правовую практику периода Гражданской войны. Для русскоязычной выдачи это государственно-правовой контекст даты.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["state", "society"],
    significance: 87,
    dateStatus: "exact",
    sources: [
      {
        id: "source-historyrussia-death-penalty-1920",
        titleRu: "Постановление ВЦИК и СНК об отмене смертной казни",
        publisherRu: "Электронная библиотека исторических документов",
        url: "https://docs.historyrussia.org/ru/nodes/449424-postanovlenie-vtsik-i-snk-ob-otmene-smertnoy-kazni-17-yanvarya-1920-g",
        sourceType: "document_archive",
      },
    ],
  },
  {
    id: "it-event-1981-02-18-ussr-zimbabwe-diplomatic-relations",
    type: "event",
    month: 2,
    day: 18,
    year: 1981,
    titleRu: "СССР и Зимбабве установили дипломатические отношения",
    summaryRu: "Между СССР и Зимбабве были установлены дипломатические отношения.",
    descriptionRu: "Установление дипломатических отношений 18 февраля 1981 года показывает советское внешнеполитическое присутствие в Африке после провозглашения независимости Зимбабве.",
    primaryCountryCode: "RU",
    countryCodes: ["RU", "ZW", "WORLD"],
    themeCodes: ["diplomacy", "state"],
    significance: 84,
    dateStatus: "exact",
    sources: [
      {
        id: "source-bigenc-zimbabwe-ussr-relations",
        titleRu: "Зимбабве",
        publisherRu: "Большая российская энциклопедия",
        url: "https://old.bigenc.ru/geography/text/5721187",
        sourceType: "encyclopedia",
      },
    ],
  },
  {
    id: "it-event-1908-02-29-calend-ru-4800-letuchaya-mysh",
    type: "event",
    month: 2,
    day: 29,
    year: 1908,
    titleRu: "В Москве открылся клуб-кабаре «Летучая мышь»",
    summaryRu: "В Москве начал работу артистический клуб-кабаре «Летучая мышь».",
    descriptionRu: "«Летучая мышь» стала заметной частью московской театральной среды начала XX века и связана с кругом Московского Художественного театра. Для 29 февраля это российская культурная опора даты.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["culture", "art"],
    significance: 84,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-4800",
        titleRu: "В Москве открылся клуб-кабаре «Летучая мышь»",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/4800/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-person-1952-02-29-raisa-smetanina",
    type: "person",
    month: 2,
    day: 29,
    birthYear: 1952,
    deathYear: null,
    nameRu: "Раиса Сметанина",
    summaryRu: "советская лыжница, четырёхкратная олимпийская чемпионка",
    descriptionRu: "Раиса Сметанина выступала за сборную СССР и стала одной из самых титулованных лыжниц в олимпийской истории. Её дата рождения закрывает российский спортивный контекст редкого дня 29 февраля.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["sports"],
    significance: 90,
    dateStatus: "exact",
    sources: [
      {
        id: "source-wikipedia-raisa-smetanina",
        titleRu: "Раиса Сметанина",
        publisherRu: "Википедия",
        url: "https://ru.wikipedia.org/wiki/%D0%A1%D0%BC%D0%B5%D1%82%D0%B0%D0%BD%D0%B8%D0%BD%D0%B0,_%D0%A0%D0%B0%D0%B8%D1%81%D0%B0_%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D0%BD%D0%B0",
        sourceType: "profile",
      },
    ],
  },
  {
    id: "it-event-1944-04-10-calend-ru-6058-odessa-liberated",
    type: "event",
    month: 4,
    day: 10,
    year: 1944,
    titleRu: "Одесса освобождена от немецко-румынских войск",
    summaryRu: "Советские войска освободили Одессу в ходе Одесской наступательной операции.",
    descriptionRu: "Освобождение Одессы стало важным эпизодом наступления Красной армии на юго-западном направлении в 1944 году. Запись добавляет для 10 апреля советский военный контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU", "UA", "WORLD"],
    themeCodes: ["military", "state"],
    significance: 94,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-6058",
        titleRu: "Одесса освобождена от немецко-румынских войск",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/6058/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-event-1981-04-10-calend-ru-6026-moscow-cosmonautics-museum",
    type: "event",
    month: 4,
    day: 10,
    year: 1981,
    titleRu: "В Москве открылся Мемориальный музей космонавтики",
    summaryRu: "У монумента «Покорителям космоса» открылся московский Мемориальный музей космонавтики.",
    descriptionRu: "Открытие музея закрепило публичную память о советской космической программе и её героях. Для 10 апреля эта запись даёт научно-культурный российский контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["space", "culture"],
    significance: 86,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-6026",
        titleRu: "В Москве открылся Мемориальный музей космонавтики",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/6026/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-event-1867-05-03-prlib-russian-red-cross-founded",
    type: "event",
    month: 5,
    day: 3,
    year: 1867,
    titleRu: "Основано Российское общество Красного Креста",
    summaryRu: "В России было учреждено общество помощи раненым и больным воинам, ставшее Российским Красным Крестом.",
    descriptionRu: "Создание Российского общества Красного Креста стало важным шагом в развитии отечественной гуманитарной помощи и военной медицины. Дата усиливает социальный российский контекст 3 мая.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["society", "state"],
    significance: 91,
    dateStatus: "exact",
    sources: [
      {
        id: "source-prlib-russian-red-cross-1867",
        titleRu: "Российский Красный Крест",
        publisherRu: "Президентская библиотека",
        url: "https://www.prlib.ru/node/619244",
        sourceType: "presidential_library",
      },
    ],
  },
  {
    id: "it-event-1808-05-03-sveaborg-captured",
    type: "event",
    month: 5,
    day: 3,
    year: 1808,
    titleRu: "Русские войска взяли крепость Свеаборг",
    summaryRu: "Во время Русско-шведской войны русские войска заняли крепость Свеаборг.",
    descriptionRu: "Взятие Свеаборга укрепило позиции Российской империи в Финляндии во время войны 1808-1809 годов. Это военная и дипломатическая опора для русскоязычной выдачи 3 мая.",
    primaryCountryCode: "RU",
    countryCodes: ["RU", "FI", "SE", "WORLD"],
    themeCodes: ["military", "diplomacy"],
    significance: 89,
    dateStatus: "exact",
    sources: [
      {
        id: "source-rosslovo-sveaborg-1808",
        titleRu: "Русские войска взяли крепость Свеаборг",
        publisherRu: "Росслово",
        url: "https://www.rosslovo.ru/news-history/sobytiya_10660.html",
        sourceType: "reference",
      },
    ],
  },
  {
    id: "it-event-1924-08-08-calend-ru-2794-moscow-bus-line",
    type: "event",
    month: 8,
    day: 8,
    year: 1924,
    titleRu: "В Москве появилась первая регулярная автобусная линия",
    summaryRu: "В Москве начала работать первая регулярная внутригородская автобусная линия.",
    descriptionRu: "Запуск регулярной автобусной линии стал частью развития московского общественного транспорта в первые советские годы. Для 8 августа это локальная городская и технологическая запись.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["technology", "society"],
    significance: 84,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-2794",
        titleRu: "В Москве появилась первая регулярная внутригородская автобусная линия",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/2794/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-event-1524-08-10-novodevichy-monastery-founded",
    type: "event",
    month: 8,
    day: 10,
    year: 1524,
    titleRu: "Основан московский Новодевичий монастырь",
    summaryRu: "В Москве был основан Новодевичий монастырь, один из ключевых памятников русской архитектуры.",
    descriptionRu: "Новодевичий монастырь связан с историей Москвы, русской государственности и церковной архитектуры. Запись добавляет 10 августа устойчивый культурно-исторический российский контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["culture", "state"],
    significance: 90,
    dateStatus: "exact",
    sources: [
      {
        id: "source-ria-novodevichy-1524",
        titleRu: "Новодевичий монастырь в Москве",
        publisherRu: "РИА Новости",
        url: "https://ria.ru/20140810/1019336897.html",
        sourceType: "agency_archive",
      },
    ],
  },
  {
    id: "it-event-1928-08-13-minsport-first-all-union-spartakiad",
    type: "event",
    month: 8,
    day: 13,
    year: 1928,
    titleRu: "В Москве открылась первая Всесоюзная спартакиада",
    summaryRu: "В Москве стартовала первая Всесоюзная спартакиада.",
    descriptionRu: "Первая Всесоюзная спартакиада стала крупным спортивным событием раннего СССР и одной из форм массового спортивного движения. Для 13 августа это сильная российская спортивная запись.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["sports", "society"],
    significance: 87,
    dateStatus: "exact",
    sources: [
      {
        id: "source-minsport-first-spartakiad-1928",
        titleRu: "Первая Всесоюзная спартакиада 1928 года в Москве",
        publisherRu: "Министерство спорта Российской Федерации",
        url: "https://www.minsport.gov.ru/pervaya-vsesoyuznaya-spartakiada-1928-goda-v-moskve/",
        sourceType: "government_archive",
      },
    ],
  },
  {
    id: "it-event-0911-09-15-calend-ru-4288-oleg-byzantium-treaty",
    type: "event",
    month: 9,
    day: 15,
    year: 911,
    titleRu: "Князь Олег заключил договор Руси с Византией",
    summaryRu: "Договор князя Олега с Византией закрепил торговые и правовые условия для русских купцов.",
    descriptionRu: "Договор 911 года относится к ранней истории Руси и её международных связей. Для русскоязычной подборки 15 сентября это базовая историко-дипломатическая дата.",
    primaryCountryCode: "RU",
    countryCodes: ["RU", "GR", "WORLD"],
    themeCodes: ["diplomacy", "state"],
    significance: 93,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-event-4288",
        titleRu: "Князь Олег заключил первый международный договор с Византией",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/events/4288/",
        sourceType: "calendar_chronology",
      },
    ],
  },
  {
    id: "it-event-1723-09-23-russia-persia-petersburg-treaty",
    type: "event",
    month: 9,
    day: 23,
    year: 1723,
    titleRu: "Россия и Персия подписали Петербургский мирный договор",
    summaryRu: "Петербургский договор завершил Персидский поход Петра I и закрепил территориальные уступки России.",
    descriptionRu: "Петербургский мирный договор 1723 года относится к внешней политике Российской империи на Каспии и Кавказе. Запись усиливает дипломатический контекст 23 сентября.",
    primaryCountryCode: "RU",
    countryCodes: ["RU", "IR", "WORLD"],
    themeCodes: ["diplomacy", "state"],
    significance: 94,
    dateStatus: "exact",
    sources: [
      {
        id: "source-vesti-september-23-history",
        titleRu: "23 сентября в истории",
        publisherRu: "Вести",
        url: "https://www.vesti.ru/article/3564660",
        sourceType: "media_archive",
      },
    ],
  },
  {
    id: "it-event-1928-09-23-moscow-planetarium-founded",
    type: "event",
    month: 9,
    day: 23,
    year: 1928,
    titleRu: "Заложено здание Московского планетария",
    summaryRu: "В Москве заложили здание будущего Московского планетария.",
    descriptionRu: "Московский планетарий стал одним из символов популяризации науки в СССР. Для 23 сентября запись добавляет научно-просветительский российский контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["science", "culture"],
    significance: 91,
    dateStatus: "exact",
    sources: [
      {
        id: "source-vesti-september-23-planetarium",
        titleRu: "23 сентября в истории",
        publisherRu: "Вести",
        url: "https://www.vesti.ru/article/3564660",
        sourceType: "media_archive",
      },
    ],
  },
  {
    id: "it-event-1938-09-24-rodina-flight-began",
    type: "event",
    month: 9,
    day: 24,
    year: 1938,
    titleRu: "Экипаж самолёта «Родина» начал беспосадочный перелёт Москва — Дальний Восток",
    summaryRu: "Женский экипаж Валентины Гризодубовой стартовал на самолёте АНТ-37 «Родина».",
    descriptionRu: "Перелёт Москва — Дальний Восток стал одним из символов советской авиации 1930-х годов и женских рекордов в воздухоплавании. Для 24 сентября это сильная российская авиационная запись.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["technology", "society"],
    significance: 92,
    dateStatus: "exact",
    sources: [
      {
        id: "source-kskdivniy-rodina-flight-1938",
        titleRu: "Женский экипаж на самолёте АНТ-37 «Родина» совершил беспосадочный полёт",
        publisherRu: "Историко-культурный музейный комплекс в Разливе",
        url: "https://www.kskdivniy.ru/museum/etot-den-v-istorii/24-sentyabrya-1938-g-zhenskiy-ekipazh-pod-komandovaniem-valentiny-grizodubovoy-na-samolete-ant-37-rodina-sovershil-besposadochnyy-polet-moskva-dalniy-vostok/",
        sourceType: "museum",
      },
    ],
  },
  {
    id: "it-event-1970-09-24-luna-16-lunar-soil-returned",
    type: "event",
    month: 9,
    day: 24,
    year: 1970,
    titleRu: "Станция «Луна-16» доставила на Землю лунный грунт",
    summaryRu: "Советская автоматическая станция «Луна-16» впервые доставила лунный грунт на Землю в автоматическом режиме.",
    descriptionRu: "Миссия «Луна-16» стала крупным достижением советской космической программы и первым автоматическим возвращением образцов лунного грунта. Запись задаёт для 24 сентября российско-советский научный контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU", "WORLD"],
    themeCodes: ["space", "science"],
    significance: 96,
    dateStatus: "exact",
    sources: [
      {
        id: "source-laspace-luna-16-1970",
        titleRu: "50 лет назад впервые лунный грунт доставлен на Землю в автоматическом режиме",
        publisherRu: "НПО Лавочкина",
        url: "https://www.laspace.ru/ru/press/news/50-let-nazad-vpervye-lunnyy-grunt-dostavlen-na-zemlyu-v-avtomaticheskom-rezhime/",
        sourceType: "official_history",
      },
    ],
  },
  {
    id: "it-event-1994-10-21-civil-code-part-one-adopted",
    type: "event",
    month: 10,
    day: 21,
    year: 1994,
    titleRu: "Госдума приняла первую часть Гражданского кодекса РФ",
    summaryRu: "Государственная Дума приняла первую часть Гражданского кодекса Российской Федерации.",
    descriptionRu: "Первая часть Гражданского кодекса РФ стала одной из ключевых основ постсоветского гражданского права. Для 21 октября запись добавляет важный государственно-правовой российский контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["state", "society"],
    significance: 90,
    dateStatus: "exact",
    sources: [
      {
        id: "source-government-civil-code-part-one",
        titleRu: "Гражданский кодекс Российской Федерации. Часть первая",
        publisherRu: "Правительство Российской Федерации",
        url: "https://government.ru/docs/all/95825/",
        sourceType: "government_document",
      },
    ],
  },
  {
    id: "it-event-1923-10-21-rostec-ant1-first-flight",
    type: "event",
    month: 10,
    day: 21,
    year: 1923,
    titleRu: "Состоялся первый полёт самолёта АНТ-1",
    summaryRu: "Первый самолёт конструкторского бюро Андрея Туполева, АНТ-1, поднялся в воздух.",
    descriptionRu: "АНТ-1 стал ранним этапом советского авиастроения и истории конструкторской школы Туполева. Для 21 октября запись добавляет технологический и инженерный российский контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["technology", "science"],
    significance: 88,
    dateStatus: "exact",
    sources: [
      {
        id: "source-rostec-ant1-first-flight",
        titleRu: "Первые пташки авиационных КБ",
        publisherRu: "Ростех",
        url: "https://rostec.ru/media/news/pervye-ptashki-aviatsionnykh-kb/",
        sourceType: "official_history",
      },
    ],
  },
  {
    id: "it-event-1918-12-19-vchk-special-department-created",
    type: "event",
    month: 12,
    day: 19,
    year: 1918,
    titleRu: "Создан Особый отдел ВЧК",
    summaryRu: "В системе ВЧК был образован Особый отдел для борьбы с контрреволюцией в армии и на флоте.",
    descriptionRu: "Создание Особого отдела ВЧК стало частью формирования советских органов государственной безопасности в годы Гражданской войны. Для 19 декабря это заметная запись российской государственной истории.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["state", "military"],
    significance: 88,
    dateStatus: "exact",
    sources: [
      {
        id: "source-bigenc-vchk-special-department",
        titleRu: "Особый отдел ВЧК",
        publisherRu: "Большая российская энциклопедия",
        url: "https://old.bigenc.ru/military_science/text/2681256",
        sourceType: "encyclopedia",
      },
    ],
  },
  {
    id: "it-event-1866-12-19-russian-telegraph-agency-created",
    type: "event",
    month: 12,
    day: 19,
    year: 1866,
    titleRu: "Создано Российское телеграфное агентство",
    summaryRu: "В Санкт-Петербурге начало работу Российское телеграфное агентство.",
    descriptionRu: "Российское телеграфное агентство стало важной частью развития отечественной новостной инфраструктуры и оперативной передачи сообщений. Для 19 декабря это медийно-технологический российский контекст.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["technology", "society"],
    significance: 84,
    dateStatus: "exact",
    sources: [
      {
        id: "source-verav-russian-telegraph-agency-1866",
        titleRu: "Российское телеграфное агентство",
        publisherRu: "Вера Воронеж",
        url: "https://www.verav.ru/common/message.php?num=1238&table=calend",
        sourceType: "reference",
      },
    ],
  },
  {
    id: "it-person-1861-12-26-calend-ru-7651-nadezhda-lamanova",
    type: "person",
    month: 12,
    day: 26,
    birthYear: 1861,
    deathYear: 1941,
    nameRu: "Надежда Ламанова",
    summaryRu: "русский и советский модельер, театральный художник",
    descriptionRu: "Надежда Ламанова работала с императорским двором, театром и советской модой, оставаясь заметной фигурой российской культуры костюма. Запись усиливает российскую подборку людей, родившихся 26 декабря.",
    primaryCountryCode: "RU",
    countryCodes: ["RU"],
    themeCodes: ["culture", "art"],
    significance: 86,
    dateStatus: "exact",
    sources: [
      {
        id: "source-calend-person-7651",
        titleRu: "Надежда Ламанова",
        publisherRu: "Calend.ru",
        url: "https://www.calend.ru/persons/7651/",
        sourceType: "calendar_biographies",
      },
    ],
  },
];

function stringifyValue(value, indent = 4) {
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    if (typeof value[0] !== "object") {
      return `[${value.map(item => JSON.stringify(item)).join(", ")}]`;
    }
    const spaces = " ".repeat(indent);
    const innerSpaces = " ".repeat(indent + 2);
    return `[\n${value.map(item => `${spaces}{\n${Object.entries(item).map(([key, itemValue]) => `${innerSpaces}${key}: ${JSON.stringify(itemValue)},`).join("\n")}\n${spaces}}`).join(",\n")},\n${" ".repeat(indent - 2)}]`;
  }
  return JSON.stringify(value);
}

function stringifyRecord(record) {
  const lines = ["  {"];
  for (const [key, value] of Object.entries(record)) {
    lines.push(`    ${key}: ${stringifyValue(value, 6)},`);
  }
  lines.push("  }");
  return lines.join("\n");
}

function findRecordBlock(text, id) {
  const idLine = `    id: ${JSON.stringify(id)},`;
  const idIndex = text.indexOf(idLine);
  if (idIndex === -1) {
    throw new Error(`Record not found: ${id}`);
  }

  const start = text.lastIndexOf("  {", idIndex);
  if (start === -1) {
    throw new Error(`Record start not found: ${id}`);
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { start, end: index + 1 };
      }
    }
  }

  throw new Error(`Record end not found: ${id}`);
}

function replaceRecord(text, record) {
  const block = findRecordBlock(text, record.id);
  return `${text.slice(0, block.start)}${stringifyRecord(record)}${text.slice(block.end)}`;
}

const existingIds = new Set(DEFAULT_INTERESTING_TODAY_CATALOG.map(record => record.id));
let text = readFileSync(CATALOG_PATH, "utf8");

text = text.replace(
  /INTERESTING_TODAY_CATALOG_VERSION = "interesting-today-ru@[^"]+"/,
  `INTERESTING_TODAY_CATALOG_VERSION = "${NEXT_VERSION}"`,
);

for (const record of UPDATED_RECORDS) {
  text = replaceRecord(text, record);
}

const missingAdditions = ADDITIONS.filter(record => !existingIds.has(record.id));
if (missingAdditions.length) {
  const insertionPoint = "\n];\n\nexport function normalizeInterestingTodayCatalog";
  if (!text.includes(insertionPoint)) {
    throw new Error("Catalog insertion point was not found.");
  }
  text = text.replace(
    insertionPoint,
    `\n${missingAdditions.map(stringifyRecord).join(",\n")},\n];\n\nexport function normalizeInterestingTodayCatalog`,
  );
}

writeFileSync(CATALOG_PATH, text, "utf8");

console.log(JSON.stringify({
  version: NEXT_VERSION,
  updatedRecords: UPDATED_RECORDS.length,
  addedRecords: missingAdditions.length,
}, null, 2));
