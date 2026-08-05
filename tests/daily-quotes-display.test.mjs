import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appJs = readFileSync("public/js/app.js", "utf8");
const appCss = readFileSync("public/css/app.css", "utf8");

test("daily quotes modal renders only quote text and author", () => {
  const modalRenderer = getFunctionBody(appJs, "renderDailyQuotesModal");

  assert.match(modalRenderer, /<blockquote>\$\{escapeHtml\(quote\.text\)\}<\/blockquote>/);
  assert.match(modalRenderer, /<cite>\$\{escapeHtml\(quote\.authorName\)\}<\/cite>/);
  assert.doesNotMatch(modalRenderer, /sourceTitle|sourceReference/);
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

test("daily quote cards expose explicit favorite and copy actions", () => {
  const modalRenderer = getFunctionBody(appJs, "renderDailyQuotesModal");

  assert.match(modalRenderer, /data-toggle-quote-favorite/);
  assert.match(modalRenderer, /data-share-quote/);
  assert.match(modalRenderer, /icon-star/);
  assert.match(modalRenderer, /icon-copy/);
  assert.match(modalRenderer, /Скопировать или поделиться цитатой/);
  assert.match(appCss, /\.icon-star\s*\{/);
  assert.match(appCss, /\.icon-copy\s*\{/);
  assert.doesNotMatch(modalRenderer, /icon-more/);
});

test("daily quote actions report favorite and copy status", () => {
  const favoriteAction = getFunctionBody(appJs, "toggleQuoteFavorite");
  const shareAction = getFunctionBody(appJs, "shareQuote");

  assert.match(favoriteAction, /setQuoteActionStatus/);
  assert.match(shareAction, /Цитата отправлена\./);
  assert.match(shareAction, /Цитата скопирована\./);
  assert.match(shareAction, /Копирование недоступно в этом браузере\./);
  assert.match(shareAction, /Не удалось скопировать цитату\./);
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
