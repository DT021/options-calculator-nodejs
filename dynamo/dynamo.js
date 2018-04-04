"use strict";

// var aws = require("aws-sdk");
// var dynamodb = require('dynamodb-model');
var dynamoose = require('dynamoose');

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
