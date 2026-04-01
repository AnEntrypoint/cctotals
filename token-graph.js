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
  // Haiku models
  'haiku-4-5': { input: 1, output: 5, base: 1 },      // $1/$5
  'haiku-3-5': { input: 0.8, output: 4, base: 0.8 },   // older
  'haiku-3': { input: 0.8, output: 4, base: 0.8 },
  // Sonnet models
  'sonnet-4-6': { input: 3, output: 15, base: 3 },     // $3/$15
  'sonnet-4-5': { input: 3, output: 15, base: 3 },
  'sonnet-3-5': { input: 3, output: 15, base: 3 },
  'sonnet-3': { input: 3, output: 15, base: 3 },
  // Opus models
  'opus-4-6': { input: 5, output: 25, base: 5 },      // $5/$25
  'opus-4-5': { input: 5, output: 25, base: 5 },
  'opus-3-5': { input: 5, output: 25, base: 5 },
  'opus-3': { input: 5, output: 25, base: 5 },
};

function getModelPricing(model) {
  const m = model.toLowerCase();
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (m.includes(key.replace('-', '-'))) {
      return price;
    }
  }
  return MODEL_PRICING['haiku-4-5']; // default
}

function getShortName(model) {
  return model
    .replace('claude-', '')
    .replace('-20251001', '')
    .replace('-20251120', '');
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
  if (!weeklyTokens[weekKey]) weeklyTokens[weekKey] = { 
    rawTokens: 0, 
    weightedTokens: 0, 
    byModel: {} 
  };
  for (const [model, tokens] of Object.entries(dayData.tokensByModel)) {
    const pricing = getModelPricing(model);
    // Use average of input/output cost as weight (assuming 30% output ratio)
    const weight = pricing.base * 1.3;
    weeklyTokens[weekKey].rawTokens += tokens;
    weeklyTokens[weekKey].weightedTokens += tokens * weight;
    weeklyTokens[weekKey].byModel[model] = { 
      tokens, 
      pricing,
      weight,
      weighted: tokens * weight 
    };
  }
}

const sortedWeeks = Object.keys(weeklyTokens).sort();
const maxWeighted = Math.max(...sortedWeeks.map(w => weeklyTokens[w].weightedTokens));
const grandRaw = sortedWeeks.reduce((sum, w) => sum + weeklyTokens[w].rawTokens, 0);
const grandWeighted = sortedWeeks.reduce((sum, w) => sum + weeklyTokens[w].weightedTokens, 0);

const W = process.stdout.columns || 80;
const c = {
  h: '\x1b[36m',  // header cyan
  y: '\x1b[33m',  // yellow labels
  g: '\x1b[32m',  // green bars
  m: '\x1b[35m',   // magenta numbers
  c: '\x1b[36m',  // cyan models
  r: '\x1b[0m'    // reset
};

// Column widths
const WEEK_W = 13;
const RAW_W = 12;
const COST_W = 10;
const BAR_W = Math.min(28, W - WEEK_W - RAW_W - COST_W - 12);

// Header
console.log(`\n${c.h}${'═'.repeat(W)}\n  WEEKLY TOKEN USAGE & COST ESTIMATE\n${'═'.repeat(W)}${c.r}\n`);

// Column headers
console.log(`${c.y}  ${'Week'.padEnd(WEEK_W)} ${'Raw Tokens'.padEnd(RAW_W)} ${'Weighted'.padEnd(COST_W)} ${'─'.repeat(BAR_W)} Bar${c.r}`);
console.log(`${c.y}  ${'─'.repeat(WEEK_W)} ${'─'.repeat(RAW_W)} ${'─'.repeat(COST_W)} ${'─'.repeat(BAR_W)}${c.r}`);

// Data with model breakdown
for (const week of sortedWeeks) {
  const data = weeklyTokens[week];
  const barLen = Math.max(1, Math.floor((data.weightedTokens / maxWeighted) * BAR_W));
  const bar = c.g + '█'.repeat(barLen) + c.r;
  
  // Week total row
  console.log(`  ${c.y}${week.padEnd(WEEK_W)}${c.r} ${c.m}${data.rawTokens.toLocaleString().padStart(RAW_W)}${c.r} ${c.m}${Math.round(data.weightedTokens).toLocaleString().padStart(COST_W)}${c.r} ${bar}`);
  
  // Model sub-rows
  const models = Object.entries(data.byModel).sort((a, b) => b[1].weighted - a[1].weighted);
  for (const [model, info] of models) {
    const shortName = getShortName(model);
    const pct = ((info.tokens / data.rawTokens) * 100).toFixed(0);
    const priceStr = `$${info.pricing.input}/${info.pricing.output}`;
    console.log(`    ${c.c}${shortName.padEnd(WEEK_W - 4)}${c.r} ${c.m}${info.tokens.toLocaleString().padStart(RAW_W)}${c.r} ${priceStr.padEnd(COST_W)} ${pct.padStart(3)}%`);
  }
}

console.log(`${c.y}  ${'─'.repeat(WEEK_W)} ${'─'.repeat(RAW_W)} ${'─'.repeat(COST_W)} ${'─'.repeat(BAR_W)}${c.r}`);

// Stats
const avgWeighted = Math.round(grandWeighted / sortedWeeks.length);
console.log(`\n  ${c.h}Total:${c.r}     ${c.m}${grandRaw.toLocaleString().padStart(RAW_W)}${c.r} raw tokens`);
console.log(`  ${c.h}Weighted:${c.r}  ${c.m}${grandWeighted.toLocaleString().padStart(RAW_W)}${c.r} (Haiku-equiv)`);
console.log(`  ${c.h}Avg/week:${c.r}  ${c.m}${avgWeighted.toLocaleString().padStart(RAW_W)}${c.r} weighted\n`);
