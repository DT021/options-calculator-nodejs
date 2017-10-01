
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

//
//
//
var UserSchema = new Schema ({

	username : { type : String,
			 	 unique : true,
				 required : true,
				 validate: {
	            	validator: function(v) {
	                	return /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/.test(v);
	             	},
	             	message: 'not a valid email address !'
	          	 } 
	          	},						// user name --> email address
	password : { type : String,
				 required : true }		// user password
});

UserSchema.methods.validPassword = function(password) {
    
    return bcrypt.compareSync(password, this.password);
};

module.exports = mongoose.model ( 'User', UserSchema );