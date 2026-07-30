const fs = require('fs');
const styles = fs.readFileSync('css/styles.css', 'utf-8');
const script = fs.readFileSync('js/script.js', 'utf-8');
const hero = fs.readFileSync('sections/hero.html', 'utf-8');

console.log("AUDIT REPORT:");
console.log("1. Does curtain animation exist in CSS?");
console.log(styles.includes('curtainLeft') ? "YES" : "NO");

console.log("2. Does script.js delay playEntranceSequence on first visit?");
console.log(script.includes("document.addEventListener('intro:finished', playEntranceSequence);") ? "YES" : "NO");

console.log("3. Does playEntranceSequence use setTimeout?");
console.log(script.includes("setTimeout(() => {") ? "YES" : "NO");

console.log("4. Are there media queries disabling transitions?");
const reducedMotion = styles.match(/prefers-reduced-motion[\s\S]*?\}/g);
console.log(reducedMotion ? "YES, reduced motion found" : "NO");
