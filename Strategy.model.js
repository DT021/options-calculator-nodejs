
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

//
//
//
var PositionSchema = new Schema ({

	amt : Number,									// the position amount
	type : String,									// the position type
	strike : Number									// the selected strike
});

module.exports = mongoose.model ( 'Position', PositionSchema );

//
//
//
var StrategySchema = new Schema ({

	userid : String,								// the user unique id
	name : { type : String, 
			 unique : true },						// strategies name 
	symbol : String,								// selected option
	expiry : Date,									// selected expiration

	positions : [PositionSchema]
});

module.exports = mongoose.model ( 'Strategy', StrategySchema );
