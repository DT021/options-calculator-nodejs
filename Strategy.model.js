
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
	name : String,									// strategies name 
	symbol : String,								// selected option
	expiry : Date,									// selected expiration
	created : { type: Date,
				default: Date.now },					// creation date
	updated : { type: Date,
				default: Date.now },					// update date

	positions : [PositionSchema]
});

StrategySchema.index ( { userid : 1, name : -1 }, { unique: true } );

module.exports = mongoose.model ( 'Strategy', StrategySchema );
