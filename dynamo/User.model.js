
var dynamoose = require('dynamoose');
var Schema = dynamoose.Schema;

//
//
//
var UserSchema = new Schema ({

    email: { type : String,			    // email address
             required : true,
             validate:  function(v) {
                    return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,3})?$/.test(v);
             }
           },
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