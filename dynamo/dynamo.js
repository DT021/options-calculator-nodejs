"use strict";

var aws = require("aws-sdk");
var dynamodb = require('dynamodb-model');
var dynamoose = require('dynamoose');

aws.config.update({
    region: "us-west-2",
    endpoint: "http://localhost:8000"
});

var dynamodb = new aws.DynamoDB();