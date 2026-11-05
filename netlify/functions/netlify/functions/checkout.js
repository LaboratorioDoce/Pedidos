const adaptar = require('../lib/adaptador');
exports.handler = adaptar(require('../../api/checkout.js'));
