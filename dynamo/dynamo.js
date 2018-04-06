"use strict";

const dynamoose = require('dynamoose');
const bcrypt = require('bcrypt');
const config = require('../oc-config');

const SALT_WORK_FACTOR = 10;

module.exports.init = function (env, logger) {

    let p = new Promise((resolve, reject) => {

        dynamoose.AWS.config.update({
            accessKeyId: config.db.access,
            secretAccessKey: config.db.secret,
            region: config.db.region
        });
        dynamoose.local(); // http://localhost:8000
        resolve(dynamoose);
    });
    return p;
}

module.exports.encrypt = function(user) {

    // generate a salt
    let salt = bcrypt.genSaltSync(SALT_WORK_FACTOR);

    // hash the password using our new salt
    let hash = bcrypt.hashSync(user.password, salt);

    // override the cleartext password with the hashed one
    user.password = hash;
    return hash;
}

//
//
//
module.exports.validPassword = function (candidatePassword,password) {

    return bcrypt.compareSync(candidatePassword, password);
};
