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
  // Get ISO week start (Monday)
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(date.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

const weeklyTokens = {};

// Process daily model tokens
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

// Sort weeks chronologically
const sortedWeeks = Object.keys(weeklyTokens).sort();

// Find max for scaling
const maxTokens = Math.max(...sortedWeeks.map(w => weeklyTokens[w].total));

// Chart settings
const CHART_WIDTH = 60;
const LABEL_WIDTH = 12;
const BAR_HEIGHT = 1;
const SCALE = CHART_WIDTH / maxTokens;

// Colors for terminal (Windows-compatible)
const colors = {
  header: '\x1b[36m',     // Cyan
  label: '\x1b[33m',      // Yellow  
  bar: '\x1b[32m',        // Green
  total: '\x1b[35m',      // Magenta
  reset: '\x1b[0m'
};

console.log('\n' + colors.header + '═'.repeat(70));
console.log('  WEEKLY TOKEN USAGE GRAPH');
console.log('═'.repeat(70) + colors.reset);
console.log();

// Draw the chart
console.log(colors.label + '  Week Start    ' + colors.reset + '|' + colors.bar + ' Tokens (scaled)' + colors.reset);

// Find longest bar needed for alignment
const maxBarWidth = Math.floor(maxTokens / (maxTokens / CHART_WIDTH));
const chartLine = '─'.repeat(LABEL_WIDTH) + '┼' + '─'.repeat(CHART_WIDTH);
console.log(colors.label + chartLine + colors.reset);

let grandTotal = 0;
for (const week of sortedWeeks) {
  const data = weeklyTokens[week];
  const barLen = Math.max(1, Math.floor(data.total / (maxTokens / CHART_WIDTH)));
  const bar = colors.bar + '█'.repeat(barLen) + colors.reset;
  const label = colors.label + week + colors.reset;
  const spaces = ' '.repeat(Math.max(0, LABEL_WIDTH - label.length));
  
  // Format token count with commas
  const tokenStr = data.total.toLocaleString();
  const padding = ' '.repeat(Math.max(0, CHART_WIDTH - barLen - tokenStr.length - 3));
  
  console.log(`  ${label}  │${bar}${padding} ${colors.total}${tokenStr}${colors.reset}`);
  grandTotal += data.total;
}

// Footer
console.log(colors.label + chartLine + colors.reset);
console.log(`\n  ${colors.header}Total:${colors.reset} ${colors.total}${grandTotal.toLocaleString()}${colors.reset} tokens across ${sortedWeeks.length} weeks`);
console.log(`  ${colors.header}Average:${colors.reset} ${Math.round(grandTotal / sortedWeeks.length).toLocaleString()} tokens/week`);
console.log('\n' + colors.header + '═'.repeat(70) + colors.reset + '\n');

// Detailed breakdown by model
console.log(colors.header + '  DETAILED BREAKDOWN BY MODEL' + colors.reset);
console.log('─'.repeat(50));

// Aggregate model stats
const modelTotals = {};
for (const week of sortedWeeks) {
  for (const [model, tokens] of Object.entries(weeklyTokens[week].byModel)) {
    modelTotals[model] = (modelTotals[model] || 0) + tokens;
  }
}

for (const [model, tokens] of Object.entries(modelTotals)) {
  const pct = ((tokens / grandTotal) * 100).toFixed(1);
  console.log(`  ${model.padEnd(30)} ${tokens.toLocaleString().padStart(12)} (${pct}%)`);
}
console.log();
