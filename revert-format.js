const fs = require('fs');
const path = require('path');

function findRecursively(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(f => {
    let full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(findRecursively(full));
    } else if (f.endsWith('.jsx')) {
      results.push(full);
    }
  });
  return results;
}

const allFiles = findRecursively('stocklab-frontend/src');
let modified = 0;
allFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content.replace(/'en-US'/g, "'vi-VN'");
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      modified++;
    }
});
console.log('Fixed format back to vi-VN in ' + modified + ' files.');
