"use strict";

var pm = require("paymill-wrapper");

pm.getContext ( config.subscription.privkey );

///////////////////////////////////////////////////////////////////////////////
// create a new subscription
module.exports.createClient = function ( userId, name ) {

    pm.clients.create ( userId, name ).then(function (client) {
        return client;
    }, function (error) {
        return error;
    });
}

