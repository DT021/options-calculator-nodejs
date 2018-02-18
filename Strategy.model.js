
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
// var OptionDescriptionSchema = require('./OptionDescription.model').schema;

//
//
//
var PositionSchema = new Schema ({

    amt: Number,            // the position amount (positive=long, negative=short)
    type: String,           // the position type (put/call)
    strike: Number,         // the selected strike
    expiry: Date            // selected expiration date
});

//
//
//
var OptionDescriptionSchema = new Schema({

    symbol: String,         // the option symbol, like ES
    name: String,           // the full name of the options
    multiplier: Number,     // the multiplier i.e. contract size
    price: Number,          // the initial price used for first time use
    strikes: [Number]       // the stikes used for the strategy
});

//
//
//
var StrategySchema = new Schema ({

    userid : String,        // owner of strategy
    name : String,          // name of strategy
    price : Number,         // price of the underlying
    vola : Number,          // volatility used for stragegy

    positions : [PositionSchema],
    optionDescription: OptionDescriptionSchema

}, {
    timestamps: true
});

StrategySchema.index ( { userid : 1, name : -1 }, { unique: true } );

module.exports = mongoose.model ( 'Strategy', StrategySchema );
