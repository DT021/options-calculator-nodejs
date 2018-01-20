"use strict";

var pm = require("paymill-wrapper");
var config = require("./oc-config");

pm.getContext ( config.subscription.privkey );

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.createPlan = function ( planId,      // the plan id [0,1,2]
                                       userId,      // the email address of the user
                                       name,        // the plan name [BASIC,STANDARD,PREMIUM]
                                       amt,         // the price of the plan
                                       currency,    //
                                       period,      // monthly or yearly
                                       start,       // start date
                                       recurring    //
                                     ) {
    return {
        offerId: planId,
        amount: amt,
        currency: currency,
        period: period,
        clientId: userId,
        name: name,
        valid: recurring ? null : "1 YEAR",
        startDate: start,
    };
};

///////////////////////////////////////////////////////////////////////////////
// route to log out
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

