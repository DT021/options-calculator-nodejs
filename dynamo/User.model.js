
var dynamoose = require('dynamoose');
var Schema = dynamoose.Schema;
var bcrypt = require('bcrypt');

var SALT_WORK_FACTOR = 10;

//
//
//
var UserSchema = new Schema ({

    email: { type : String,			    // email address
            //   unique : true,
             rangeKey: true,
             index: true,
             required : true,
             validate:  function(v) {
                    return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,3})?$/.test(v);
             }
           },
    username: { type: String,
                required: true },       // username
    password: { type: String,
                required: true },		// password
    secretToken: String,                // secret token for email verification
    active: { type: Boolean,
              default: false },         // true when the email was verified
    plan: Number,                       // the subscription plan
    stripe: String,                     // stripe customer id
    backup: String                      // backup of old email
}, {
    timestamps: true,
    useNativeBooleans: true
});

//
//
//
const presave = function(next) {

    var user = this;

    // only hash the password if it has been modified (or is new)
    if ( ! user.isModified('password') ) return next();

    // generate a salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {

        if (err) {
            return next(err);
        }

        // hash the password using our new salt
        bcrypt.hash(user.password, salt, function(err, hash) {

            if (err) {
                return next(err);
            }

            // override the cleartext password with the hashed one
            user.password = hash;
            next();
        });
    });
}

//
//
//
UserSchema.methods.comparePassword = function(candidatePassword, cb) {

    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {

        if ( err ) {
            return cb(err);
        }
        cb(null, isMatch);
    });
};

//
//
//
UserSchema.methods.validPassword = function(password) {

    return bcrypt.compareSync(password, this.password);
};

module.exports = dynamoose.model ( 'User', UserSchema );