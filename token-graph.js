#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const statsPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'stats-cache.json');

if (!fs.existsSync(statsPath)) {
  console.error('stats-cache.json not found at:', statsPath);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

function getWeekKey(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

const weeklyTokens = {};

for (const dayData of stats.dailyModelTokens) {
  const weekKey = getWeekKey(dayData.date);
  if (!weeklyTokens[weekKey]) weeklyTokens[weekKey] = { total: 0, byModel: {} };
  for (const [model, tokens] of Object.entries(dayData.tokensByModel)) {
    weeklyTokens[weekKey].total += tokens;
    weeklyTokens[weekKey].byModel[model] = (weeklyTokens[weekKey].byModel[model] || 0) + tokens;
  }
}

const sortedWeeks = Object.keys(weeklyTokens).sort();
const maxTokens = Math.max(...sortedWeeks.map(w => weeklyTokens[w].total));
const grandTotal = sortedWeeks.reduce((sum, w) => sum + weeklyTokens[w].total, 0);

const W = process.stdout.columns || 80;
const c = {
  h: '\x1b[36m',  // header
  y: '\x1b[33m',  // yellow (labels)
  g: '\x1b[32m',  // green (bars)
  m: '\x1b[35m',   // magenta (numbers)
  r: '\x1b[0m'    // reset
};

// Fixed-width columns
const WEEK_W = 12;
const TOKEN_W = 12;
const BAR_W = Math.min(40, W - WEEK_W - TOKEN_W - 8);

// Header
console.log(`\n${c.h}${'═'.repeat(W)}\n  WEEKLY TOKEN USAGE\n${'═'.repeat(W)}${c.r}\n`);

// Column headers
console.log(`${c.y}  ${'Week'.padEnd(WEEK_W)} ${'Tokens'.padEnd(TOKEN_W)} ${'─'.repeat(BAR_W)}${c.r}`);
console.log(`${c.y}  ${'─'.repeat(WEEK_W)} ${'─'.repeat(TOKEN_W)} ${'─'.repeat(BAR_W)}${c.r}`);

// Data rows
for (const week of sortedWeeks) {
  const data = weeklyTokens[week];
  const barLen = Math.max(1, Math.floor((data.total / maxTokens) * BAR_W));
  const bar = c.g + '█'.repeat(barLen) + c.r;
  
  const line = `  ${c.y}${week.padEnd(WEEK_W)}${c.r} ${c.m}${data.total.toLocaleString().padStart(TOKEN_W)}${c.r} ${bar}`;
  console.log(line);
}

console.log(`${c.y}  ${'─'.repeat(WEEK_W)} ${'─'.repeat(TOKEN_W)} ${'─'.repeat(BAR_W)}${c.r}`);

// Stats
const avg = Math.round(grandTotal / sortedWeeks.length);
console.log(`\n  Total:   ${c.m}${grandTotal.toLocaleString().padStart(TOKEN_W)}${c.r} tokens`);
console.log(`  Average: ${c.m}${avg.toLocaleString().padStart(TOKEN_W)}${c.r} tokens/week`);
console.log(`  Weeks:   ${c.m}${sortedWeeks.length}${c.r}\n`);

// Model breakdown
console.log(`${c.h}  MODEL BREAKDOWN\n${'═'.repeat(W)}${c.r}\n`);

const modelTotals = {};
for (const week of sortedWeeks) {
  for (const [model, tokens] of Object.entries(weeklyTokens[week].byModel)) {
    modelTotals[model] = (modelTotals[model] || 0) + tokens;
  }
}

const maxModelLen = Math.max(20, ...Object.keys(modelTotals).map(m => m.length));
console.log(`${c.y}  ${'Model'.padEnd(maxModelLen)} ${'Tokens'.padEnd(TOKEN_W)} %${c.r}`);
console.log(`${c.y}  ${'─'.repeat(maxModelLen)} ${'─'.repeat(TOKEN_W)} ────${c.r}`);

for (const [model, tokens] of Object.entries(modelTotals)) {
  const pct = ((tokens / grandTotal) * 100).toFixed(1);
  console.log(`  ${c.y}${model.padEnd(maxModelLen)}${c.r} ${c.m}${tokens.toLocaleString().padStart(TOKEN_W)}${c.r} ${pct.padStart(6)}%`);
}
console.log();
