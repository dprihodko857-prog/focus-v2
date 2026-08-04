import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const requisitesHtml = readFileSync("public/requisites.html", "utf8");
const subscriptionHtml = readFileSync("public/subscription.html", "utf8");
const pricesHtml = readFileSync("public/prices.html", "utf8");
const offerHtml = readFileSync("public/offer.html", "utf8");
const privacyHtml = readFileSync("public/privacy.html", "utf8");
const serviceWorker = readFileSync("public/service-worker.js", "utf8");

test("public requisites page exposes merchant legal details", () => {
  assert.match(requisitesHtml, /<title>Реквизиты - Focus<\/title>/);
  assert.match(requisitesHtml, /Индивидуальный предприниматель Приходько Дмитрий Геннадьевич/);
  assert.match(requisitesHtml, /ИНН[\s\S]*?290130112170/);
  assert.match(requisitesHtml, /ОГРНИП[\s\S]*?325290000016639/);
  assert.match(requisitesHtml, /Отделение № 8637 СберБанка РФ/);
  assert.match(requisitesHtml, /dmprihodko@mail\.ru/);
  assert.match(requisitesHtml, /href="\/"/);
  assert.match(requisitesHtml, /href="\/prices\.html"/);
  assert.doesNotMatch(requisitesHtml, /<script/i);
});

test("service worker caches the public requisites page", () => {
  assert.match(serviceWorker, /focus-pwa-v117/);
  assert.match(serviceWorker, /"\/requisites\.html"/);
});

test("public subscription page exposes Focus Plus price and service details", () => {
  assert.match(subscriptionHtml, /<title>Подписка Focus Plus - Focus<\/title>/);
  assert.match(subscriptionHtml, /Focus Plus/);
  assert.match(subscriptionHtml, /199 ₽/);
  assert.match(subscriptionHtml, /Фиксированная цена тарифа Focus Plus: 199 ₽ за 30 календарных дней доступа/);
  assert.doesNotMatch(subscriptionHtml, /от 199 ₽/i);
  assert.match(subscriptionHtml, /Голосовой ввод/);
  assert.match(subscriptionHtml, /транскрибации речи в текст/);
  assert.match(subscriptionHtml, /href="\/requisites\.html"/);
  assert.match(subscriptionHtml, /href="\/prices\.html"/);
  assert.match(subscriptionHtml, /href="\/offer\.html"/);
  assert.match(subscriptionHtml, /href="\/privacy\.html"/);
  assert.match(subscriptionHtml, /href="\/\?open=useful"/);
  assert.doesNotMatch(subscriptionHtml, /<script/i);
});

test("public prices page exposes fixed Focus Plus price list", () => {
  assert.match(pricesHtml, /<title>Прайс-лист - Focus<\/title>/);
  assert.match(pricesHtml, /Прайс-лист/);
  assert.match(pricesHtml, /Тариф Focus Plus/);
  assert.match(pricesHtml, /Фиксированная цена/);
  assert.match(pricesHtml, /199 ₽/);
  assert.match(pricesHtml, /30 календарных дней/);
  assert.match(pricesHtml, /Голосовой ввод и транскрибация речи в текст/);
  assert.match(pricesHtml, /href="\/subscription\.html"/);
  assert.match(pricesHtml, /href="\/offer\.html"/);
  assert.match(pricesHtml, /href="\/requisites\.html"/);
  assert.doesNotMatch(pricesHtml, /от 199 ₽/i);
  assert.doesNotMatch(pricesHtml, /<script/i);
});

test("service worker caches the public subscription page", () => {
  assert.match(serviceWorker, /"\/subscription\.html"/);
  assert.match(serviceWorker, /"\/prices\.html"/);
});

test("public offer page exposes payment, activation, and refund conditions", () => {
  assert.match(offerHtml, /<title>Публичная оферта - Focus<\/title>/);
  assert.match(offerHtml, /Focus Plus/);
  assert.match(offerHtml, /Фиксированная стоимость: 199 ₽ за 30 календарных дней доступа/);
  assert.match(offerHtml, /href="\/prices\.html"/);
  assert.doesNotMatch(offerHtml, /от 199 ₽/i);
  assert.match(offerHtml, /транскрибацией речи в текст/);
  assert.match(offerHtml, /Доступ включается только после подтвержденного платежа/);
  assert.match(offerHtml, /Возвраты и отмена/);
  assert.match(offerHtml, /href="\/requisites\.html"/);
  assert.match(offerHtml, /href="\/privacy\.html"/);
  assert.doesNotMatch(offerHtml, /<script/i);
});

test("public privacy page describes data processing for sync, push, and transcription", () => {
  assert.match(privacyHtml, /<title>Политика обработки данных - Focus<\/title>/);
  assert.match(privacyHtml, /индивидуальный предприниматель Приходько Дмитрий Геннадьевич/);
  assert.match(privacyHtml, /расписания, напоминания, дела, заметки/);
  assert.match(privacyHtml, /push-подписка устройства/);
  assert.match(privacyHtml, /IndexedDB/);
  assert.match(privacyHtml, /Текст, полученный из голосового ввода/);
  assert.match(privacyHtml, /PIN личного дневника/);
  assert.match(privacyHtml, /href="\/offer\.html"/);
  assert.doesNotMatch(privacyHtml, /<script/i);
});

test("service worker caches public legal documents", () => {
  assert.match(serviceWorker, /"\/offer\.html"/);
  assert.match(serviceWorker, /"\/privacy\.html"/);
});
