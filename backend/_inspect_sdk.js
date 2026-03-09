const j = require('./node_modules/sarvamai/dist/cjs/api/resources/documentIntelligence/DocumentIntelligenceJob.js');
const src = j.DocumentIntelligenceJob.prototype.uploadFile.toString();
console.log(src.slice(0, 3000));
