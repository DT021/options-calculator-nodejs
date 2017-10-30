
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');

var SALT_WORK_FACTOR = 10;

//
//
//
var UserSchema = new Schema ({

	email : { type : String,			// email address
			  unique : true,
			  required : true,
			  validate: {
			  validator: function(v) {
				return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,3})?$/.test(v);
			  },
			  message: 'not a valid email address !' } 
            },	
	username : { type : String,
                 required : true },     // username
	password : { type : String,
				 required : true }		// password
});

//
//
//
UserSchema.pre ('save', function(next) {

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
});

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

module.exports = mongoose.model ( 'User', UserSchema );