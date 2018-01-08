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
var ClassSchema = new Schema({

    symbol: String,
    multiplier: Number,
    expirations: [ExpirationSchema]
    // strikes: [OptionsClassSchema]
});

module.exports = mongoose.model('OptionsClasse', ClassSchema);
