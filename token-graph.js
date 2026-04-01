#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const statsPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'stats-cache.json');

if (!fs.existsSync(statsPath)) {
  console.error('stats-cache.json not found:', statsPath);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

const MODEL_PRICING = {
  'haiku-4-5': { input: 1, output: 5, base: 1 },
  'haiku-3-5': { input: 0.8, output: 4, base: 0.8 },
  'haiku-3': { input: 0.8, output: 4, base: 0.8 },
  'sonnet-4-6': { input: 3, output: 15, base: 3 },
  'sonnet-4-5': { input: 3, output: 15, base: 3 },
  'sonnet-3-5': { input: 3, output: 15, base: 3 },
  'sonnet-3': { input: 3, output: 15, base: 3 },
  'opus-4-6': { input: 5, output: 25, base: 5 },
  'opus-4-5': { input: 5, output: 25, base: 5 },
  'opus-3-5': { input: 5, output: 25, base: 5 },
  'opus-3': { input: 5, output: 25, base: 5 },
};

function getModelPricing(model) {
  const m = model.toLowerCase();
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (m.includes(key.replace('-', '-'))) return price;
  }
  return MODEL_PRICING['haiku-4-5'];
}

function getShortName(model) {
  return model.replace('claude-', '').replace('-20251001', '').replace('-20251120', '');
}

function getWeekKey(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

const weeklyTokens = {};

for (const dayData of stats.dailyModelTokens) {
  const weekKey = getWeekKey(dayData.date);
  if (!weeklyTokens[weekKey]) weeklyTokens[weekKey] = { rawTokens: 0, weightedTokens: 0, byModel: {} };
  for (const [model, tokens] of Object.entries(dayData.tokensByModel)) {
    const pricing = getModelPricing(model);
    const weight = pricing.base * 1.3;
    weeklyTokens[weekKey].rawTokens += tokens;
    weeklyTokens[weekKey].weightedTokens += tokens * weight;
    weeklyTokens[weekKey].byModel[model] = { tokens, pricing, weight, weighted: tokens * weight };
  }
}

const sortedWeeks = Object.keys(weeklyTokens).sort();
const maxWeighted = Math.max(...sortedWeeks.map(w => weeklyTokens[w].weightedTokens));
const grandRaw = sortedWeeks.reduce((sum, w) => sum + weeklyTokens[w].rawTokens, 0);
const grandWeighted = sortedWeeks.reduce((sum, w) => sum + weeklyTokens[w].weightedTokens, 0);

// Colors
const L = {
  y: '\x1b[33m', m: '\x1b[35m', c: '\x1b[36m', g: '\x1b[32m', h: '\x1b[36m', r: '\x1b[0m'
};

const fmt = (n) => Math.round(n).toLocaleString();
const pad = (s, n) => String(s).padEnd(n);
const padn = (n, w) => fmt(n).padStart(w);

// Fixed columns - main row
const W_COL = 10, WT_COL = 14, RW_COL = 13, BARS = 36;

function weekLine(week, weighted, raw) {
  const barLen = Math.max(1, Math.floor((weighted / maxWeighted) * BARS));
  return `${L.y}  ${pad(week, W_COL)}  ${L.m}${padn(weighted, WT_COL)}  ${padn(raw, RW_COL)}  ${L.g}${'█'.repeat(barLen)}${' '.repeat(BARS - barLen)}${L.r}`;
}

function modelLine(model, weighted, raw, pct, price) {
  const modelShort = pad(getShortName(model), W_COL);
  return `${L.c}    ${modelShort}  ${L.c}${padn(weighted, WT_COL)}  ${L.m}${padn(raw, RW_COL)}  ${pct.padStart(3)}%  ${price}`;
}

const HR = `${L.y}  ${'─'.repeat(W_COL)}  ${'─'.repeat(WT_COL)}  ${'─'.repeat(RW_COL)}  ${'─'.repeat(BARS)}${L.r}`;
const HDR = `${L.y}  ${pad('Week', W_COL)}  ${pad('Weighted', WT_COL)}  ${pad('Raw', RW_COL)}  ${'─'.repeat(BARS)}${L.r}`;

console.log(`\n${L.h}  WEEKLY TOKEN USAGE & COST ESTIMATE${L.r}`);
console.log(`${L.h}  ${'─'.repeat(W_COL + WT_COL + RW_COL + BARS + 14)}${L.r}\n`);
console.log(HDR);
console.log(HR);

for (const week of sortedWeeks) {
  const data = weeklyTokens[week];
  console.log(weekLine(week, data.weightedTokens, data.rawTokens));
  const models = Object.entries(data.byModel).sort((a, b) => b[1].weighted - a[1].weighted);
  for (const [model, info] of models) {
    const pct = ((info.weighted / data.weightedTokens) * 100).toFixed(0);
    const price = `$${info.pricing.input}/${info.pricing.output}`;
    console.log(modelLine(model, info.weighted, info.tokens, pct, price));
  }
}

console.log(HR);
console.log(`\n${L.h}  Total:    ${L.m}${padn(grandWeighted, WT_COL)}${L.r} weighted`);
console.log(`${L.h}  Raw:      ${L.m}${padn(grandRaw, WT_COL)}${L.r} tokens`);
console.log(`${L.h}  Avg/week: ${L.m}${padn(grandWeighted / sortedWeeks.length, WT_COL)}${L.r} weighted\n`);
