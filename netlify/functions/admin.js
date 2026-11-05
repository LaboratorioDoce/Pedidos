const adaptar = require('../lib/adaptador');
exports.handler = adaptar(require('../../api/admin.js'));
