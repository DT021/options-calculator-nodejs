"use strict";

// var aws = require("aws-sdk");
// var dynamodb = require('dynamodb-model');
var dynamoose = require('dynamoose');
var bcrypt = require('bcrypt');

const SALT_WORK_FACTOR = 10;

module.exports.init = function (env, logger) {

    let p = new Promise((resolve, reject) => {

        dynamoose.AWS.config.update({
            accessKeyId: "AKID",
            secretAccessKey: "SECRET",
            region: "us-east-2"
        });
        // var dynamodb = new aws.DynamoDB();
        dynamoose.local(); // http://localhost:8000
        // var dynamodb = dynamoose.ddb();
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
