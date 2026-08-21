#!/usr/bin/env node
/**
 * Performance Verification Script
 * Checks build size, gzip compression, and validates optimizations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('📊 Performance Verification Script');
console.log('='.repeat(50));

// Colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function checkThreshold(actual, threshold, name, isLower = true) {
  const pass = isLower ? actual <= threshold : actual >= threshold;
  const symbol = pass ? '✅' : '⚠️';
  const color = pass ? colors.green : colors.yellow;
  console.log(`${color}${symbol} ${name}: ${formatBytes(actual)}${colors.reset}`);
  return pass;
}

// Check dist folder
if (!fs.existsSync(distDir)) {
  console.error(`${colors.red}❌ dist/ folder not found. Run 'npm run build' first.${colors.reset}`);
  process.exit(1);
}

console.log(`\n${colors.blue}📁 Build Artifacts:${colors.reset}`);

// Check index.html
const indexPath = path.join(distDir, 'index.html');
const indexSize = getFileSize(indexPath);
checkThreshold(indexSize, 2000, 'index.html', true);

// Check main bundle
const assets = fs.readdirSync(path.join(distDir, 'assets'));
const jsFiles = assets.filter(f => f.endsWith('.js'));
const cssFiles = assets.filter(f => f.endsWith('.css'));

console.log(`\n${colors.blue}📦 JavaScript Bundle:${colors.reset}`);
let totalJsSize = 0;
jsFiles.forEach(file => {
  const filePath = path.join(distDir, 'assets', file);
  const size = getFileSize(filePath);
  totalJsSize += size;
  checkThreshold(size, 600 * 1024, file, true);
});

console.log(`\n${colors.blue}🎨 CSS Bundle:${colors.reset}`);
let totalCssSize = 0;
cssFiles.forEach(file => {
  const filePath = path.join(distDir, 'assets', file);
  const size = getFileSize(filePath);
  totalCssSize += size;
  checkThreshold(size, 200 * 1024, file, true);
});

console.log(`\n${colors.blue}📊 Summary:${colors.reset}`);
console.log(`Total JavaScript: ${formatBytes(totalJsSize)}`);
console.log(`Total CSS: ${formatBytes(totalCssSize)}`);
console.log(`Total Assets: ${formatBytes(totalJsSize + totalCssSize)}`);

// Check for optimization indicators
console.log(`\n${colors.blue}✨ Optimization Checks:${colors.reset}`);

// Check font imports
const stylesPath = path.join(rootDir, 'src/styles.css');
try {
  const stylesContent = fs.readFileSync(stylesPath, 'utf-8');

  const hasVariableFont = stylesContent.includes('@fontsource-variable/manrope');
  const hasMultipleWeights = stylesContent.includes('@fontsource/manrope/latin-');

  if (hasVariableFont && !hasMultipleWeights) {
    console.log(`${colors.green}✅ Using @fontsource-variable/manrope${colors.reset}`);
  } else if (hasMultipleWeights) {
    console.log(`${colors.yellow}⚠️ Still using multiple font weight imports${colors.reset}`);
  }
} catch (err) {
  console.log(`${colors.yellow}⚠️ Could not check font optimization${colors.reset}`);
}

// Check for React.memo usage
const appPath = path.join(rootDir, 'src/App.jsx');
try {
  const appContent = fs.readFileSync(appPath, 'utf-8');
  const memoMatches = appContent.match(/memo\(/g) || [];

  if (memoMatches.length >= 3) {
    console.log(`${colors.green}✅ Found ${memoMatches.length} memoized components${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️ Only ${memoMatches.length} memoized components found${colors.reset}`);
  }

  const lazyMatches = appContent.match(/lazy\(/g) || [];
  if (lazyMatches.length > 0) {
    console.log(`${colors.green}✅ Lazy loading detected (${lazyMatches.length} lazy components)${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️ No lazy loading found${colors.reset}`);
  }
} catch (err) {
  console.log(`${colors.yellow}⚠️ Could not check App.jsx optimizations${colors.reset}`);
}

// Check webresource
const webresourcePath = path.join(distDir, 'webresource.html');
if (fs.existsSync(webresourcePath)) {
  const webresourceSize = getFileSize(webresourcePath);
  console.log(`\n${colors.blue}🌐 Power Platform Web Resource:${colors.reset}`);
  checkThreshold(webresourceSize, 1024 * 1024, 'webresource.html (inline)', true);
}

console.log(`\n${colors.green}✅ Performance check completed${colors.reset}`);
console.log('='.repeat(50));
