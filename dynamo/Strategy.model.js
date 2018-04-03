
var dynamoose = require('dynamoose');
var Schema = dynamoose.Schema;

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
var StrategySchema = new Schema ({

    userid: { type: String,
              rangeKey: true,
              index: true
             },             // owner of strategy
    name: { type: String,
            index: {
                global: true,
                rangeKey: 'userid',
                name: 'StrategyIndex',
                project: true, // ProjectionType: ALL
                throughput: 5 // read and write are both 5
            }
          },               // name of strategy
    price: Number,         // price of the underlying
    vola: Number,          // volatility used for stragegy

    optionDescription: {

        symbol: String,     // the option symbol, like ES
        name: String,       // the full name of the options
        multiplier: Number, // the multiplier i.e. contract size
        price: Number,      // the initial price used for first time use
        strikes: [Number]   // the stikes used for the strategy
    },

    positions: [PositionSchema],

}, {
    timestamps: true
});

// StrategySchema.index ( { userid : 1, name : -1 }, { unique: true } );

module.exports = dynamoose.model ( 'Strategy', StrategySchema );
