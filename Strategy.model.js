
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var OptionDescriptionSchema = require('./OptionDescription.model').schema;

//
//
//
var PositionSchema = new Schema ({

    amt : Number,	    							// the position amount
    type : String,	    							// the position type
    strike : Number,	    						// the selected strike
    expiry: Date	    							// selected expiration
});

module.exports = mongoose.model ( 'Position', PositionSchema );

//
//
//
var StrategySchema = new Schema ({

    userid : String,	    						// the user unique id
    name : String,	    							// strategies name
    symbol : String,	       						// selected option

    positions : [PositionSchema],
    optionDescription: [OptionDescriptionSchema]

}, {
    timestamps: true
});

StrategySchema.index ( { userid : 1, name : -1 }, { unique: true } );

module.exports = mongoose.model ( 'Strategy', StrategySchema );
