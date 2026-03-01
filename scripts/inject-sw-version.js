const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate an 8-character hex hash based on current time
const buildHash = crypto.randomBytes(4).toString('hex');
const newCacheName = `novira-cache-${buildHash}`;

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace the cache name definition specifically, preserving the rest of the file
const updatedContent = swContent.replace(
    /const CACHE_NAME = 'novira-[^']+';/, 
    `const CACHE_NAME = '${newCacheName}';`
).replace(
    /const CACHE_NAME = 'novira-v[0-9\.]+';/,
    `const CACHE_NAME = '${newCacheName}';`
);

if (swContent === updatedContent) {
    console.warn(`WARNING: Could not find CACHE_NAME in sw.js to replace. Injection failed.`);
    process.exit(1);
}

fs.writeFileSync(swPath, updatedContent);
console.log(`Successfully injected new cache name: ${newCacheName} into public/sw.js`);
