"use strict";

const config = require('./oc-config');
const mongoose = require('mongoose');

//module.exports mongoose;

module.exports.init = function(env,logger) {
    mongoose.Promise = global.Promise;
    return mongoose.connect(config.db[env].url,config.db[env].options);
}
