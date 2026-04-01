#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const statsPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'stats-cache.json');

if (!fs.existsSync(statsPath)) {
  console.error('stats-cache.json not found:', statsPath);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

// Claude API pricing per 1M tokens (input/output USD)
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
const cy = (t) => `\x1b[33m${t}\x1b[0m`;
const cm = (t) => `\x1b[35m${t}\x1b[0m`;
const cc = (t) => `\x1b[36m${t}\x1b[0m`;
const cg = (t) => `\x1b[32m${t}\x1b[0m`;
const ch = (t) => `\x1b[36m${t}\x1b[0m`;

// Fixed column layout
const W = process.stdout.columns || 100;
const INDENT = '  ';
const WEEK_COL = 11;
const WEIGHTED_COL = 14;
const RAW_COL = 12;
const BAR_START = INDENT.length + WEEK_COL + WEIGHTED_COL + RAW_COL + 4;
const BAR_COL = W - BAR_START - 1;

function pad(str, n) {
  return String(str).padEnd(n).slice(0, n);
}
function padNum(n, len) {
  return String(Math.round(n).toLocaleString()).padStart(len);
}

console.log(`\n${ch('═').repeat(W)}\n${ch('  WEEKLY TOKEN USAGE & COST ESTIMATE')}\n${ch('═').repeat(W)}\n`);

// Header
const hdr = `${cy(INDENT + pad('Week', WEEK_COL) + ' ' + pad('Weighted', WEIGHTED_COL) + ' ' + pad('Raw', RAW_COL))}`;
console.log(`${hdr} ${cy('─').repeat(BAR_COL)} Bar`);
console.log(`${cy(INDENT + '─'.repeat(WEEK_COL) + ' ' + '─'.repeat(WEIGHTED_COL) + ' ' + '─'.repeat(RAW_COL))} ${cy('─').repeat(BAR_COL)}`);

// Data rows
for (const week of sortedWeeks) {
  const data = weeklyTokens[week];
  const barLen = Math.max(1, Math.floor((data.weightedTokens / maxWeighted) * BAR_COL));
  const bar = cg('█'.repeat(barLen));
  
  console.log(`${INDENT}${cy(pad(week, WEEK_COL))} ${cm(padNum(data.weightedTokens, WEIGHTED_COL))} ${cm(padNum(data.rawTokens, RAW_COL))} ${bar}`);
  
  // Model sub-rows
  const models = Object.entries(data.byModel).sort((a, b) => b[1].weighted - a[1].weighted);
  for (const [model, info] of models) {
    const shortModel = pad(getShortName(model), WEEK_COL);
    const pct = ((info.weighted / data.weightedTokens) * 100).toFixed(0);
    const priceStr = `$${info.pricing.input}/${info.pricing.output}`;
    console.log(`    ${cc(shortModel)} ${cc(padNum(info.weighted, WEIGHTED_COL))} ${cm(padNum(info.tokens, RAW_COL))} ${pct.padStart(3)}% ${priceStr}`);
  }
}

console.log(`${cy(INDENT + '─'.repeat(WEEK_COL) + ' ' + '─'.repeat(WEIGHTED_COL) + ' ' + '─'.repeat(RAW_COL))} ${cy('─').repeat(BAR_COL)}`);

// Stats
console.log(`\n${INDENT}${ch('Total:')}    ${cm(padNum(grandWeighted, WEIGHTED_COL))} weighted`);
console.log(`${INDENT}${ch('Raw:')}       ${cm(padNum(grandRaw, WEIGHTED_COL))} raw tokens`);
console.log(`${INDENT}${ch('Avg/week:')}  ${cm(padNum(Math.round(grandWeighted / sortedWeeks.length), WEIGHTED_COL))} weighted\n`);
