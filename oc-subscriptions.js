"use strict";

var pm = require("paymill-wrapper");
var config = require("./oc-config");

pm.getContext ( config.subscription.privkey );

module.exports.plans = [

    {
        id: 0,
        name: "NONE",
        price: 0,
        period: "",
        recurring: false
    },

    {
        id: 1,
        name: "BASIC",
        price: 5,
        period: "1 MONTH",
        recurring: true
    },

    {
        id: 2,
        name: "STANDARD",
        price: 10,
        period: "1 MONTH",
        recurring: true
    },

    {
        id: 3,
        name: "PREMIUM",
        price: 100,
        period: "1 YEAR",
        recurring: false
    },

];

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.createPlan = function ( planId,      // the plan id [0,1,2]
                                       clientId,    // the client id of the user - optional
                                       name,        // the plan name [BASIC,STANDARD,PREMIUM]
                                       amt,         // the price of the plan
                                       currency,    // USD/EUR/etc.
                                       period,      // monthly or yearly
                                       start,       // start date
                                       recurring    // 1 MONTH, 1 YEAR, etc.
                                     ) {
    return {
        offerId: planId,
        clientId: clientId,
        name: name,
        amount: amt,
        currency: currency,
        period: period,
        startDate: start,
        valid: recurring,
    };
};

///////////////////////////////////////////////////////////////////////////////
// create a new subscription
module.exports.createSubscription = function ( plan ) {

    pm.subscriptions
        .fromParams(plan.offerId,
                    plan.amount,
                    plan.currency,
                    plan.period )
        .withClient(plan.clientId )
        .withName(plan.name )
        .withPeriodOfValidity(plan.valid )
        .withStartDate(plan.startDate )
        .create().then ( function (subscription) {
            // console.log ( "created subscription:" + subscription.id );
            return subscription;
        }, function (error) {
            // console.log ( "couldnt create subscription:" + error );
            return error;
        });
}

