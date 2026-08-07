import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appJs = readFileSync("public/js/app.js", "utf8");
const appCss = readFileSync("public/css/app.css", "utf8");

test("daily quotes modal renders only quote text and author", () => {
  const cardRenderer = getFunctionBody(appJs, "renderDailyQuoteCards");

  assert.match(cardRenderer, /<blockquote>\$\{escapeHtml\(quote\.text\)\}<\/blockquote>/);
  assert.match(cardRenderer, /<cite>\$\{escapeHtml\(quote\.authorName\)\}<\/cite>/);
  assert.doesNotMatch(cardRenderer, /sourceTitle|sourceReference/);
});

test("daily quotes marquee renders only quote text and author", () => {
  const marqueeFormatter = getFunctionBody(appJs, "formatQuoteMarqueeText");

  assert.match(marqueeFormatter, /quote\?\.text/);
  assert.match(marqueeFormatter, /quote\?\.authorName/);
  assert.doesNotMatch(marqueeFormatter, /sourceTitle|sourceReference/);
});

test("daily quotes modal can open from launch query", () => {
  assert.match(appJs, /const installShortcutTargets = new Set\(\[[\s\S]*"quotes"[\s\S]*\]\);/);
  assert.match(appJs, /openModal\(target\)/);
});

test("quote preferences disable unavailable categories before saving", () => {
  const preferencesRenderer = getFunctionBody(appJs, "renderQuotePreferencesUi");
  const preferencesReader = getFunctionBody(appJs, "readQuotePreferencesDraft");
  const categoryCodeSet = getFunctionBody(appJs, "getAvailableQuoteCategoryCodeSet");

  assert.match(categoryCodeSet, /category\.available === true/);
  assert.match(preferencesRenderer, /aria-disabled/);
  assert.match(preferencesRenderer, /disabled/);
  assert.match(preferencesReader, /getAvailableQuoteCategoryCodeSet/);
  assert.match(preferencesReader, /availableCategoryCodes\.has\(input\.value\)/);
});

test("quote preferences explain category availability", () => {
  const preferencesRenderer = getFunctionBody(appJs, "renderQuotePreferencesUi");
  const categorySummary = getFunctionBody(appJs, "getQuoteCategorySummaryText");
  const categoryReadiness = getFunctionBody(appJs, "getQuoteCategoryReadinessText");
  const preferenceSync = getFunctionBody(appJs, "syncQuotePreferenceControls");

  assert.match(preferencesRenderer, /quote-category-summary/);
  assert.match(preferencesRenderer, /quote-category-option__meta/);
  assert.match(preferencesRenderer, /getQuoteCategoryReadinessText/);
  assert.match(preferencesRenderer, /title=/);
  assert.match(categorySummary, /availableCount/);
  assert.match(categorySummary, /formatPlural/);
  assert.match(categoryReadiness, /activeVerifiedCount/);
  assert.match(categoryReadiness, /minimumCatalogSize/);
  assert.match(preferenceSync, /getSelectedQuoteCategoriesStatusText/);
  assert.match(appCss, /\.quote-category-summary\s*\{/);
  assert.match(appCss, /\.quote-category-option__meta\s*\{/);
});

test("quote preferences save button reflects saved and dirty states", () => {
  const loadPreferences = getFunctionBody(appJs, "loadQuotePreferencesUi");
  const saveStateRenderer = getFunctionBody(appJs, "renderQuotePreferencesSaveState");
  const resetSaveState = getFunctionBody(appJs, "resetQuotePreferencesSaveState");
  const preferenceSync = getFunctionBody(appJs, "syncQuotePreferenceControls");
  const savePreferences = getFunctionBody(appJs, "saveQuotePreferencesUi");

  assert.match(loadPreferences, /quotePreferencesSaveState = "idle"/);
  assert.match(saveStateRenderer, /#quotePreferencesSaveButton/);
  assert.match(saveStateRenderer, /Сохраняем\.\.\./);
  assert.match(saveStateRenderer, /Сохранено/);
  assert.match(saveStateRenderer, /Сохранить/);
  assert.match(saveStateRenderer, /is-saved/);
  assert.match(resetSaveState, /quotePreferencesSaveState = "idle"/);
  assert.match(preferenceSync, /resetQuotePreferencesSaveState/);
  assert.match(savePreferences, /quotePreferencesSaveState = "saving"/);
  assert.match(savePreferences, /quotePreferencesSaveState = "saved"/);
  assert.match(savePreferences, /quotePreferencesSaveMessage/);
  assert.match(appCss, /\.quote-preferences-panel__head \.primary-button\.is-saved\s*\{/);
});

test("daily quote cards expose explicit favorite, share and copy actions", () => {
  const cardRenderer = getFunctionBody(appJs, "renderDailyQuoteCards");
  const shareMenu = getFunctionBody(appJs, "renderQuoteShareMenu");

  assert.match(cardRenderer, /data-toggle-quote-favorite/);
  assert.match(cardRenderer, /data-share-quote/);
  assert.match(cardRenderer, /data-copy-quote/);
  assert.match(cardRenderer, /renderQuoteShareMenu/);
  assert.match(cardRenderer, /icon-star/);
  assert.match(cardRenderer, /icon-share/);
  assert.match(cardRenderer, /icon-copy/);
  assert.match(cardRenderer, /Копировать цитату/);
  assert.match(cardRenderer, /Поделиться цитатой/);
  assert.match(shareMenu, /data-quote-share-target="system"/);
  assert.match(shareMenu, /data-quote-share-target="telegram"/);
  assert.match(shareMenu, /data-quote-share-target="copy"/);
  assert.match(shareMenu, /https:\/\/wa\.me\/\?text=/);
  assert.match(shareMenu, /type="button" role="menuitem" data-quote-share-target="telegram"/);
  assert.match(shareMenu, /href="mailto:\?subject=\$\{subject\}&amp;body=\$\{encodedText\}"/);
  assert.match(shareMenu, /https:\/\/outlook\.office\.com\/mail\/deeplink\/compose/);
  assert.match(shareMenu, /https:\/\/mail\.google\.com\/mail\/\?view=cm/);
  assert.match(shareMenu, /data-copy-quote-before-open/);
  assert.doesNotMatch(shareMenu, /https:\/\/t\.me\/share\/url/);
  assert.match(appCss, /\.icon-star\s*\{/);
  assert.match(appCss, /\.icon-share\s*\{/);
  assert.match(appCss, /M11 5H7a3/);
  assert.doesNotMatch(appCss, /M5 7H4/);
  assert.match(appCss, /\.daily-quote-share-menu\s*\{/);
  assert.doesNotMatch(cardRenderer, /icon-more/);
});

test("daily quotes modal exposes favorite quotes view", () => {
  const dailyLoader = getFunctionBody(appJs, "loadDailyQuotes");
  const modalRenderer = getFunctionBody(appJs, "renderDailyQuotesModal");
  const favoriteLoader = getFunctionBody(appJs, "loadFavoriteQuotes");
  const favoriteCacheLoader = getFunctionBody(appJs, "loadFavoriteQuotesFromCache");
  const favoriteCacheSaver = getFunctionBody(appJs, "saveFavoriteQuotesToCache");
  const favoriteCacheSync = getFunctionBody(appJs, "syncFavoriteQuotesFromCache");
  const favoriteMerger = getFunctionBody(appJs, "mergeFavoriteQuotes");
  const favoriteStateApplier = getFunctionBody(appJs, "applyFavoriteStateToQuoteCollections");
  const favoriteAction = getFunctionBody(appJs, "toggleQuoteFavorite");
  const quoteFinder = getFunctionBody(appJs, "findQuoteForAction");

  assert.match(appJs, /favoriteQuotesState/);
  assert.match(appJs, /QUOTE_FAVORITES_CACHE_KEY/);
  assert.match(appJs, /function renderDailyQuoteTabs/);
  assert.match(appJs, /data-quote-view="favorites"/);
  assert.match(modalRenderer, /quoteModalView === "favorites"/);
  assert.match(modalRenderer, /Избранных цитат пока нет/);
  assert.match(favoriteLoader, /syncFavoriteQuotesFromCache/);
  assert.match(favoriteLoader, /scheduleSync\.getFavoriteQuotes/);
  assert.match(favoriteLoader, /saveFavoriteQuotesToCache/);
  assert.match(favoriteLoader, /offline-cached/);
  assert.match(favoriteCacheLoader, /scheduleStorage\.loadFavoriteQuotesCache/);
  assert.match(favoriteCacheSaver, /scheduleStorage\.saveFavoriteQuotesCache/);
  assert.match(favoriteCacheSaver, /QUOTE_FAVORITES_CACHE_KEY/);
  assert.match(favoriteCacheSync, /applyFavoriteStateToQuoteCollections/);
  assert.match(favoriteMerger, /byId\.has\(quote\.id\)/);
  assert.match(favoriteStateApplier, /dailyQuotesState\.quotes/);
  assert.match(favoriteStateApplier, /quoteHistoryState\.sets/);
  assert.match(favoriteAction, /favoriteQuotesState\.quotes/);
  assert.match(favoriteAction, /nextIsFavorite/);
  assert.match(favoriteAction, /saveFavoriteQuotesToCache/);
  assert.match(favoriteAction, /локальное избранное/);
  assert.match(quoteFinder, /dailyQuotesState\.quotes/);
  assert.match(quoteFinder, /favoriteQuotesState\.quotes/);
  assert.equal((dailyLoader.match(/await syncFavoriteQuotesFromCache\(\);/g) || []).length, 2);
  assert.match(dailyLoader, /await syncFavoriteQuotesFromCache\(\);[\s\S]*await saveDailyQuotesToHistory/);
  assert.match(dailyLoader, /await syncFavoriteQuotesFromCache\(\);[\s\S]*await saveDailyQuotesToCache[\s\S]*await saveDailyQuotesToHistory/);
  assert.match(appCss, /\.daily-quotes-tabs\s*\{/);
  assert.match(appCss, /\.daily-quotes-tab\.is-active\s*\{/);
});

test("daily quotes modal exposes quote history view", () => {
  const modalRenderer = getFunctionBody(appJs, "renderDailyQuotesModal");
  const historyLoader = getFunctionBody(appJs, "loadQuoteHistory");
  const historyCacheLoader = getFunctionBody(appJs, "loadQuoteHistoryFromCache");
  const historyCacheSaver = getFunctionBody(appJs, "saveQuoteHistoryToCache");
  const historySaver = getFunctionBody(appJs, "saveDailyQuotesToHistory");
  const historyMerger = getFunctionBody(appJs, "mergeQuoteHistorySets");
  const historyRenderer = getFunctionBody(appJs, "renderQuoteHistorySets");
  const historyToolbar = getFunctionBody(appJs, "renderQuoteHistoryToolbar");
  const historyDelete = getFunctionBody(appJs, "deleteQuoteHistorySet");
  const historyClear = getFunctionBody(appJs, "clearQuoteHistory");
  const quoteSetFormatter = getFunctionBody(appJs, "formatQuoteSetShareText");
  const quoteFinder = getFunctionBody(appJs, "findQuoteForAction");
  const favoriteStateApplier = getFunctionBody(appJs, "applyFavoriteStateToQuoteCollections");
  const favoriteAction = getFunctionBody(appJs, "toggleQuoteFavorite");

  assert.match(appJs, /quoteHistoryState/);
  assert.match(appJs, /QUOTE_HISTORY_CACHE_KEY/);
  assert.match(appJs, /function getQuoteHistoryQuotes/);
  assert.match(appJs, /data-quote-view="history"/);
  assert.match(modalRenderer, /quoteModalView === "history"/);
  assert.match(modalRenderer, /История пока пуста/);
  assert.match(appJs, /async function loadDailyQuotes\(\{ force = false \} = \{\}\)[\s\S]*saveDailyQuotesToHistory/);
  assert.match(historyLoader, /loadQuoteHistoryFromCache/);
  assert.match(historyLoader, /scheduleSync\.getQuoteHistory/);
  assert.match(historyLoader, /saveQuoteHistoryToCache/);
  assert.match(historyCacheLoader, /scheduleStorage\.loadDailyQuoteHistoryCache/);
  assert.match(historyCacheSaver, /scheduleStorage\.saveDailyQuoteHistoryCache/);
  assert.match(historySaver, /mergeQuoteHistorySets/);
  assert.match(historyMerger, /byDate\.has\(set\.localDate\)/);
  assert.match(historyRenderer, /renderDailyQuoteCards\(set\.quotes\)/);
  assert.match(historyRenderer, /data-copy-quote-set/);
  assert.match(historyRenderer, /data-share-quote-set/);
  assert.match(historyRenderer, /data-delete-quote-set/);
  assert.match(historyToolbar, /data-clear-quote-history/);
  assert.match(historyDelete, /window\.confirm/);
  assert.match(historyDelete, /saveQuoteHistoryToCache/);
  assert.match(historyClear, /window\.confirm/);
  assert.match(historyClear, /sets: \[\]/);
  assert.match(historyCacheSaver, /saveDailyQuoteHistoryCache\(null\)/);
  assert.match(quoteSetFormatter, /formatQuoteMarqueeText/);
  assert.doesNotMatch(quoteSetFormatter, /sourceTitle|sourceReference/);
  assert.match(favoriteStateApplier, /quoteHistoryState\.sets/);
  assert.match(favoriteAction, /saveQuoteHistoryToCache/);
  assert.match(quoteFinder, /getQuoteHistoryQuotes/);
  assert.match(appCss, /\.daily-quotes-history-day\s*\{/);
  assert.match(appCss, /\.daily-quotes-history-day__actions\s*\{/);
  assert.match(appCss, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test("daily quotes modal filters quotes by text and author", () => {
  const modalRenderer = getFunctionBody(appJs, "renderDailyQuotesModal");
  const searchControl = getFunctionBody(appJs, "renderQuoteSearchControl");
  const quoteMatcher = getFunctionBody(appJs, "quoteMatchesSearch");
  const quoteListFilter = getFunctionBody(appJs, "filterQuoteListBySearch");
  const historyFilter = getFunctionBody(appJs, "filterQuoteHistorySetsBySearch");
  const historySetFinder = getFunctionBody(appJs, "findQuoteHistorySetForAction");

  assert.match(appJs, /quoteSearchQuery/);
  assert.match(modalRenderer, /normalizeQuoteSearchQuery\(quoteSearchQuery\)/);
  assert.match(modalRenderer, /filterQuoteListBySearch/);
  assert.match(modalRenderer, /filterQuoteHistorySetsBySearch/);
  assert.match(searchControl, /type="search"/);
  assert.match(searchControl, /data-quote-search/);
  assert.match(searchControl, /data-clear-quote-search/);
  assert.match(searchControl, /Найти цитату или автора/);
  assert.match(quoteMatcher, /quote\?\.text/);
  assert.match(quoteMatcher, /quote\?\.authorName/);
  assert.doesNotMatch(quoteMatcher, /sourceTitle|sourceReference/);
  assert.match(quoteListFilter, /quoteMatchesSearch/);
  assert.match(historyFilter, /filterQuoteListBySearch/);
  assert.match(historySetFinder, /applySearch/);
  assert.match(historySetFinder, /filterQuoteListBySearch/);
  assert.match(appJs, /addEventListener\("input"[\s\S]*data-quote-search/);
  assert.match(appJs, /data-clear-quote-search/);
  assert.match(appJs, /renderDailyQuotesModal\(\{ preserveSearchFocus: true \}\)/);
  assert.match(appCss, /\.daily-quotes-search\s*\{/);
  assert.match(appCss, /\.daily-quotes-search input\s*\{/);
});

test("daily quote actions report favorite and copy status", () => {
  const favoriteAction = getFunctionBody(appJs, "toggleQuoteFavorite");
  const shareAction = getFunctionBody(appJs, "shareQuote");
  const shareSetAction = getFunctionBody(appJs, "shareQuoteSet");
  const copyAction = getFunctionBody(appJs, "copyQuoteToClipboard");
  const copySetAction = getFunctionBody(appJs, "copyQuoteSetToClipboard");
  const externalCopyAction = getFunctionBody(appJs, "copyQuoteBeforeExternalOpen");
  const telegramAction = getFunctionBody(appJs, "shareQuoteToTelegram");
  const telegramUrl = getFunctionBody(appJs, "getTelegramQuoteShareUrl");
  const menuToggle = getFunctionBody(appJs, "toggleQuoteShareMenu");

  assert.match(favoriteAction, /setQuoteActionStatus/);
  assert.match(menuToggle, /quoteShareMenuQuoteId/);
  assert.match(appJs, /data-copy-quote/);
  assert.match(appJs, /data-copy-quote-set/);
  assert.match(appJs, /data-share-quote-set/);
  assert.match(appJs, /data-delete-quote-set/);
  assert.match(appJs, /data-clear-quote-history/);
  assert.match(appJs, /data-copy-quote-before-open/);
  assert.match(copyAction, /navigator\.clipboard/);
  assert.match(copySetAction, /navigator\.clipboard/);
  assert.match(copySetAction, /Подборка скопирована\./);
  assert.match(shareSetAction, /navigator\.share/);
  assert.match(shareSetAction, /Подборка отправлена\./);
  assert.match(externalCopyAction, /navigator\.clipboard\.writeText/);
  assert.match(externalCopyAction, /Открываем почту/);
  assert.match(telegramAction, /navigator\.clipboard\.writeText/);
  assert.match(telegramAction, /window\.location\.href/);
  assert.match(telegramUrl, /tg:\/\/msg_url\?url=/);
  assert.doesNotMatch(appJs, /shareQuoteByEmail/);
  assert.match(shareAction, /Цитата отправлена\./);
  assert.match(copyAction, /Цитата скопирована\./);
  assert.match(copyAction, /Копирование недоступно в этом браузере\./);
  assert.match(copyAction, /Не удалось скопировать цитату\./);
});

function getFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `Function ${functionName} not found.`);

  const openParameters = source.indexOf("(", start);
  assert.notEqual(openParameters, -1, `Function ${functionName} parameters not found.`);

  let parameterDepth = 0;
  let closeParameters = -1;
  for (let index = openParameters; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      parameterDepth += 1;
    } else if (char === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        closeParameters = index;
        break;
      }
    }
  }
  assert.notEqual(closeParameters, -1, `Function ${functionName} parameters are not closed.`);

  const openBrace = source.indexOf("{", closeParameters);
  assert.notEqual(openBrace, -1, `Function ${functionName} body not found.`);

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBrace + 1, index);
      }
    }
  }

  assert.fail(`Function ${functionName} body is not closed.`);
}
