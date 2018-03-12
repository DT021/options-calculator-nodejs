"use strict";

var pm = require("paymill-wrapper");
var stripe = require("stripe")("sk_test_Zq5hjqL7e3qJOCh3TaO2eFqR");
var config = require("./oc-config");

pm.getContext ( config.subscription.privkey );

module.exports.plans = [

    {
        id: 0,
        name: "NONE",
        price: 0,
        period: "NEVER",
        recurring: false
    },

    {
        id: 1,
        name: "BASIC",
        price: 5,
        period: "MONTH",
        recurring: true
    },

    {
        id: 2,
        name: "STANDARD",
        price: 10,
        period: "MONTH",
        recurring: true
    },

    {
        id: 3,
        name: "PREMIUM",
        price: 100,
        period: "YEAR",
        recurring: false
    },

];
// module.exports.plans;

///////////////////////////////////////////////////////////////////////////////
// retrieve plans from stripe
module.exports.getSubscriptionPlans = function (plans) {

    stripe.plans.list ( function (err,splans) {

        if ( splans ) {
            for ( var i in splans.data ) {
                var plan = splans.data[i];

                plans[plan.id].price = plan.amount / 100;
                plans[plan.id].period = plan.interval_count + " " +
                                        plan.interval.toUpperCase();
            }
        }

        for ( var id in plans ) {
            console.log("%s %d %s", plans[id].id,
                                    plans[id].price,
                                    plans[id].period );
        }
    });
}

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

