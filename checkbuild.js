const fs = require('fs');
const d = fs.readFileSync('C:/Users/ronel/OneDrive/Desktop/Excel-to-Annex-C_CAR_Management_System/build.out.txt', 'utf8');
const lines = d.split(/\r?\n/);
console.log(lines.length);
const start = Math.max(0, lines.length - 30);
for (let i = start; i < lines.length; i++) {
  console.log(lines[i]);
}
