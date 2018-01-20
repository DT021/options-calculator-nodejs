"use strict";

var pm = require("paymill-wrapper");
var config = require("./oc-config");

pm.getContext ( config.subscription.privkey );

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.createPlan = function ( planId,
                                       userId,
                                       name,
                                       amt,
                                       currency,
                                       period,
                                       start,
                                       recurring ) {
    return {
        offerId: planId,
        amount: amt,
        currency: currency,
        period: period,
        valid: String,
        clientId: userId,
        name: name,
        startDate: start,
        recurring: recurring
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

