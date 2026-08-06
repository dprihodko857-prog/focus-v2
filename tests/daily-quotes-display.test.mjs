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
  assert.match(cardRenderer, /\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0446\u0438\u0442\u0430\u0442\u0443/);
  assert.match(cardRenderer, /Поделиться цитатой/);
  assert.match(shareMenu, /data-quote-share-target="system"/);
  assert.match(shareMenu, /data-quote-share-target="copy"/);
  assert.match(shareMenu, /https:\/\/wa\.me\/\?text=/);
  assert.match(shareMenu, /tg:\/\/msg_url\?text=/);
  assert.doesNotMatch(shareMenu, /https:\/\/t\.me\/share\/url/);
  assert.match(shareMenu, /mailto:\?subject=/);
  assert.match(appCss, /\.icon-star\s*\{/);
  assert.match(appCss, /\.icon-share\s*\{/);
  assert.match(appCss, /M11 5H7a3/);
  assert.doesNotMatch(appCss, /M5 7H4/);
  assert.match(appCss, /\.daily-quote-share-menu\s*\{/);
  assert.doesNotMatch(cardRenderer, /icon-more/);
});

test("daily quotes modal exposes favorite quotes view", () => {
  const modalRenderer = getFunctionBody(appJs, "renderDailyQuotesModal");
  const favoriteLoader = getFunctionBody(appJs, "loadFavoriteQuotes");
  const favoriteAction = getFunctionBody(appJs, "toggleQuoteFavorite");
  const quoteFinder = getFunctionBody(appJs, "findQuoteForAction");

  assert.match(appJs, /favoriteQuotesState/);
  assert.match(appJs, /function renderDailyQuoteTabs/);
  assert.match(appJs, /data-quote-view="favorites"/);
  assert.match(modalRenderer, /quoteModalView === "favorites"/);
  assert.match(modalRenderer, /Избранных цитат пока нет/);
  assert.match(favoriteLoader, /scheduleSync\.getFavoriteQuotes/);
  assert.match(favoriteAction, /favoriteQuotesState\.quotes/);
  assert.match(quoteFinder, /dailyQuotesState\.quotes/);
  assert.match(quoteFinder, /favoriteQuotesState\.quotes/);
  assert.match(appCss, /\.daily-quotes-tabs\s*\{/);
  assert.match(appCss, /\.daily-quotes-tab\.is-active\s*\{/);
});

test("daily quotes modal exposes quote history view", () => {
  const modalRenderer = getFunctionBody(appJs, "renderDailyQuotesModal");
  const historyLoader = getFunctionBody(appJs, "loadQuoteHistory");
  const historyRenderer = getFunctionBody(appJs, "renderQuoteHistorySets");
  const quoteFinder = getFunctionBody(appJs, "findQuoteForAction");
  const favoriteAction = getFunctionBody(appJs, "toggleQuoteFavorite");

  assert.match(appJs, /quoteHistoryState/);
  assert.match(appJs, /function getQuoteHistoryQuotes/);
  assert.match(appJs, /data-quote-view="history"/);
  assert.match(modalRenderer, /quoteModalView === "history"/);
  assert.match(modalRenderer, /Истории пока нет/);
  assert.match(historyLoader, /scheduleSync\.getQuoteHistory/);
  assert.match(historyRenderer, /renderDailyQuoteCards\(set\.quotes\)/);
  assert.match(favoriteAction, /quoteHistoryState\.sets/);
  assert.match(quoteFinder, /getQuoteHistoryQuotes/);
  assert.match(appCss, /\.daily-quotes-history-day\s*\{/);
  assert.match(appCss, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test("daily quote actions report favorite and copy status", () => {
  const favoriteAction = getFunctionBody(appJs, "toggleQuoteFavorite");
  const shareAction = getFunctionBody(appJs, "shareQuote");
  const copyAction = getFunctionBody(appJs, "copyQuoteToClipboard");
  const menuToggle = getFunctionBody(appJs, "toggleQuoteShareMenu");

  assert.match(favoriteAction, /setQuoteActionStatus/);
  assert.match(menuToggle, /quoteShareMenuQuoteId/);
  assert.match(appJs, /data-copy-quote/);
  assert.match(copyAction, /navigator\.clipboard/);
  assert.match(shareAction, /Цитата отправлена\./);
  assert.match(copyAction, /Цитата скопирована\./);
  assert.match(copyAction, /Копирование недоступно в этом браузере\./);
  assert.match(copyAction, /Не удалось скопировать цитату\./);
});

function getFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `Function ${functionName} not found.`);

  const openBrace = source.indexOf("{", start);
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
