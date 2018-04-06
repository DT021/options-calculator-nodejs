"use strict";

const dynamoose = require('dynamoose');
const Schema = dynamoose.Schema;

//
// {
//   "positions": [{ "amt":1,
//                   "type":"call",
//                   "strike":2585,
//                   "expiry":"Apr 20 18" }],
// }
//
var PositionSchema = new Schema ({

    amt: Number,                    // position amount (pos.=long, neg.=short)
    type: String,                   // position type (put/call)
    strike: Number,                 // selected strike price
    expiry: Date                    // selected expiration date
});

//
// {
//   "createdAt": 1522999721957,
//   "price": 2585,
//   "name": "ES",
//   "vola": 15,
//   "positions": [...],
//   "optionsContract": { "symbol":"ES",
//                        "name":"S&P 500 E-Mini",
//                        "multiplier":50,
//                        "strikes":[3300,3275,3260, ... 3250,1890,1880] },
//   "userid": "cus_Ccrq2aLQh6ckTb",
//   "updatedAt": 1522999721957
// }
//
var StrategySchema = new Schema ({

    userid: { type: String,         // stripe customer ID
              rangeKey: true,
              index: true },
    name: { type: String,           // strategy name
            index: {
                global: true,
                rangeKey: 'userid',
                name: 'StrategyIndex',
                project: true,      // ProjectionType: ALL
                throughput: 5 }},   // read and write are both 5
    price: Number,                  // price of the underlying
    vola: Number,                   // volatility used for stragegy

    optionsContract: {

        symbol: String,             // option symbol, as ES
        name: String,               // full name of the options
        multiplier: Number,         // multiplier i.e. contract size
        price: Number,              // initial price used for first time use
        strikes: [Number]           // stikes used for the strategy
    },

    positions: [PositionSchema],

}, {
    timestamps: true
});

module.exports = dynamoose.model ( 'Strategy', StrategySchema );
