
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
// var OptionDescriptionSchema = require('./OptionDescription.model').schema;

//
//
//
var PositionSchema = new Schema ({

    amt : Number,           // the position amount
    type : String,          // the position type
    strike : Number,        // the selected strike
    expiry: Date            // selected expiration
});

//
//
//
var OptionDescriptionSchema = new Schema({

    symbol: String,         // the option symbol, like ES
    name: String,           // the full name of the options
    multiplier: Number,     // the multiplier i.e. contract size
    price: Number,          // the price of the underlying used for the strategy
    strikes: [Number]       // the stikes used for the strategy
});

//
//
//
var StrategySchema = new Schema ({

    userid : String,        // the user unique id
    name : String,          // strategies name
    symbol : String,        // selected option

    positions : [PositionSchema],
    optionDescription: OptionDescriptionSchema

}, {
    timestamps: true
});

StrategySchema.index ( { userid : 1, name : -1 }, { unique: true } );

module.exports = mongoose.model ( 'Strategy', StrategySchema );
