#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const statsPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'stats-cache.json');

if (!fs.existsSync(statsPath)) {
  console.error('stats-cache.json not found:', statsPath);
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
const maxWeekTotal = Math.max(...sortedWeeks.map(w => weeklyTokens[w].total));
const grandTotal = sortedWeeks.reduce((sum, w) => sum + weeklyTokens[w].total, 0);

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
const TOKEN_W = 13;
const BAR_W = Math.min(35, W - WEEK_W - TOKEN_W - 10);

// Header
console.log(`\n${c.h}${'═'.repeat(W)}\n  WEEKLY TOKEN USAGE\n${'═'.repeat(W)}${c.r}\n`);

// Column headers
const hdr = `  ${'Week'.padEnd(WEEK_W)} ${'Tokens'.padEnd(TOKEN_W)}`;
console.log(`${c.y}${hdr}${' '.repeat(BAR_W)} Bar${c.r}`);
console.log(`${c.y}  ${'─'.repeat(WEEK_W)} ${'─'.repeat(TOKEN_W)} ${'─'.repeat(BAR_W)}${c.r}`);

// Data with model breakdown
for (const week of sortedWeeks) {
  const data = weeklyTokens[week];
  const barLen = Math.max(1, Math.floor((data.total / maxWeekTotal) * BAR_W));
  const bar = c.g + '█'.repeat(barLen) + c.r;
  
  // Week total row
  console.log(`  ${c.y}${week.padEnd(WEEK_W)}${c.r} ${c.m}${data.total.toLocaleString().padStart(TOKEN_W)}${c.r} ${bar}`);
  
  // Model sub-rows
  const models = Object.entries(data.byModel).sort((a, b) => b[1] - a[1]);
  for (const [model, tokens] of models) {
    const modelBarLen = Math.max(1, Math.floor((tokens / maxWeekTotal) * BAR_W));
    const modelBar = c.g + '▄'.repeat(modelBarLen) + c.r;
    const pct = ((tokens / data.total) * 100).toFixed(0);
    // Shorten model name for display
    const shortModel = model.replace('claude-', '').replace('-20251001', '');
    console.log(`    ${c.c}${shortModel.padEnd(WEEK_W - 4)}${c.r} ${c.m}${tokens.toLocaleString().padStart(TOKEN_W)}${c.r} ${pct.padStart(3)}% ${modelBar}`);
  }
}

console.log(`${c.y}  ${'─'.repeat(WEEK_W)} ${'─'.repeat(TOKEN_W)} ${'─'.repeat(BAR_W)}${c.r}`);

// Stats
const avg = Math.round(grandTotal / sortedWeeks.length);
console.log(`\n  ${c.h}Total:${c.r}   ${c.m}${grandTotal.toLocaleString().padStart(TOKEN_W)}${c.r} tokens`);
console.log(`  ${c.h}Average:${c.r} ${c.m}${avg.toLocaleString().padStart(TOKEN_W)}${c.r} tokens/week`);
console.log(`  ${c.h}Weeks:${c.r}   ${c.m}${sortedWeeks.length}${c.r}\n`);
