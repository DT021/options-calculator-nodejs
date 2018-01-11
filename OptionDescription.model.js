
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

//
//
//
var ExpirationSchema = new Schema({

    expiry: String,
    strikes: [Number]
});

//
//
//
var OptionDescriptionSchema = new Schema({

    symbol: String,
    name: String,
    multiplier: Number,
    price: Number,
    expirations: [ExpirationSchema]
});

module.exports = mongoose.model ( 'OptionDescription', OptionDescriptionSchema );
