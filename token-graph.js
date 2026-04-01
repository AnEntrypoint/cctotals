#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const statsPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'stats-cache.json');

if (!fs.existsSync(statsPath)) {
  console.error('stats-cache.json not found at:', statsPath);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

// Group daily tokens into weeks
function getWeekKey(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(date.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

const weeklyTokens = {};

for (const dayData of stats.dailyModelTokens) {
  const weekKey = getWeekKey(dayData.date);
  if (!weeklyTokens[weekKey]) {
    weeklyTokens[weekKey] = { total: 0, byModel: {} };
  }
  
  for (const [model, tokens] of Object.entries(dayData.tokensByModel)) {
    weeklyTokens[weekKey].total += tokens;
    weeklyTokens[weekKey].byModel[model] = (weeklyTokens[weekKey].byModel[model] || 0) + tokens;
  }
}

const sortedWeeks = Object.keys(weeklyTokens).sort();
const maxTokens = Math.max(...sortedWeeks.map(w => weeklyTokens[w].total));

// Colors
const c = {
  hdr: '\x1b[36m',
  lbl: '\x1b[33m',
  bar: '\x1b[32m',
  num: '\x1b[35m',
  res: '\x1b[0m'
};

// Terminal width
const W = process.stdout.columns || 80;
const CHART_W = Math.min(50, W - 30);
const PAD = Math.floor((W - CHART_W - 30) / 2);

// Header
console.log('\n' + c.hdr + '═'.repeat(W));
console.log(' '.repeat(PAD) + 'WEEKLY TOKEN USAGE GRAPH');
console.log('═'.repeat(W) + c.res);
console.log();

// Column headers
const hdr = '  Week         Tokens';
console.log(c.lbl + hdr + ' '.repeat(CHART_W - hdr.length + 5) + '| Bar' + c.res);
console.log(c.lbl + '─'.repeat(W) + c.res);

let grandTotal = 0;
for (const week of sortedWeeks) {
  const data = weeklyTokens[week];
  const barLen = Math.max(1, Math.floor((data.total / maxTokens) * CHART_W));
  
  // Format: week left-aligned, tokens right-aligned
  const weekStr = week;
  const tokenStr = data.total.toLocaleString();
  const bar = c.bar + '█'.repeat(barLen) + c.res;
  
  const line = `  ${c.lbl}${weekStr}${c.res}  ${c.num}${tokenStr}${c.res}  ${bar}`;
  console.log(line);
  grandTotal += data.total;
}

console.log(c.lbl + '─'.repeat(W) + c.res);

const avg = Math.round(grandTotal / sortedWeeks.length);
console.log(`\n  Total:   ${c.num}${grandTotal.toLocaleString()}${c.res} tokens (${sortedWeeks.length} weeks)`);
console.log(`  Average: ${c.num}${avg.toLocaleString()}${c.res} tokens/week`);
console.log('\n' + c.hdr + '═'.repeat(W) + c.res + '\n');

// Model breakdown
console.log(c.hdr + '  MODEL BREAKDOWN' + c.res);
console.log(c.lbl + '─'.repeat(W) + c.res);

const modelTotals = {};
for (const week of sortedWeeks) {
  for (const [model, tokens] of Object.entries(weeklyTokens[week].byModel)) {
    modelTotals[model] = (modelTotals[model] || 0) + tokens;
  }
}

const maxModelLen = Math.max(...Object.keys(modelTotals).map(m => m.length));
for (const [model, tokens] of Object.entries(modelTotals)) {
  const pct = ((tokens / grandTotal) * 100).toFixed(1);
  const padded = model.padEnd(maxModelLen);
  console.log(`  ${c.lbl}${padded}${c.res}  ${c.num}${tokens.toLocaleString()}${c.res}  (${pct}%)`);
}
console.log();
