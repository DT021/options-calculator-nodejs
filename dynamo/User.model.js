"use strict";

const dynamoose = require('dynamoose');
const Schema = dynamoose.Schema;

//
// {
//   "createdAt": 1522950001149,
//   "password": "$2a$10$Kiv26IZ2RG35ZLtm3UOLg.neh3ye4vUKQ7Sdz8ETy5xOdMEPcQEkO",
//   "secretToken": "ylZ2H2QESEg1WBg1ouQE6bp4J5zuNVbx",
//   "stripe": "cus_Ccrq2aLQh6ckTb",
//   "active": true,
//   "plan": 2,
//   "email": "hanspeterhauser@yahoo.com",
//   "username": "Peter Hauser",
//   "updatedAt": 1522998918275
// }
//
var UserSchema = new Schema ({

    email: { type : String,			    // email address
             required : true,
             validate:  function(v) {
                    return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,3})?$/.test(v); }},
    backup: String,                     // backup of old email
    username: { type: String,
                required: true },       // username
    password: { type: String,
                required: true },		// password
    secretToken: String,                // secret token for email verification
    active: { type: Boolean,
              default: false },         // true when the email was verified
    plan: Number,                       // the subscription plan
    stripe: String                      // stripe customer id
}, {
    timestamps: true,
    useNativeBooleans: true
});

module.exports = dynamoose.model ( 'User', UserSchema );