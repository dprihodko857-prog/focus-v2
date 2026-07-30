import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const requisitesHtml = readFileSync("public/requisites.html", "utf8");
const serviceWorker = readFileSync("public/service-worker.js", "utf8");

test("public requisites page exposes merchant legal details", () => {
  assert.match(requisitesHtml, /<title>Реквизиты - Focus<\/title>/);
  assert.match(requisitesHtml, /Индивидуальный предприниматель Приходько Дмитрий Геннадьевич/);
  assert.match(requisitesHtml, /ИНН[\s\S]*?290130112170/);
  assert.match(requisitesHtml, /ОГРНИП[\s\S]*?325290000016639/);
  assert.match(requisitesHtml, /Отделение № 8637 СберБанка РФ/);
  assert.match(requisitesHtml, /dmprihodko@mail\.ru/);
  assert.match(requisitesHtml, /href="\/"/);
  assert.doesNotMatch(requisitesHtml, /<script/i);
});

test("service worker caches the public requisites page", () => {
  assert.match(serviceWorker, /focus-pwa-v76/);
  assert.match(serviceWorker, /"\/requisites\.html"/);
});
