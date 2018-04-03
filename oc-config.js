"use strict";

// test mongo console login
// mongo -u hph65_mongoadmin -p ig1Eeng3vu --authenticationDatabase admin --host localhost --port 34302 oc
//
// add port routing:    sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000
// remove port routing: sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000

var dbconfig = {
    user: "hph65_mongoadmin",
    pass: "ig1Eeng3vu",
    host: "localhost",
    port: 21302,
    name: "oc",
    endp: "mongodb://"
};

module.exports = {

    // node server settings
    server: {
        host: "http://localhost",
        port: 3000,
        docroot: "./public"
    },

    // db url
    db: {

        production: {
            url: dbconfig.endp + dbconfig.user + ":" +
                                 dbconfig.pass + "@" +
                                 dbconfig.host + ":" +
                                 dbconfig.port + "/" +
                                 dbconfig.name,
            options: {
                auth: { authdb: "admin" }
            }
        },

        development: {
            url: dbconfig.endp + dbconfig.host + "/" +
                                 dbconfig.name,
            options: {
                useMongoClient: true
            }
        },

        test: {
            url: dbconfig.endp + dbconfig.user + ":" +
                                 dbconfig.pass + "@" +
                                 dbconfig.host + ":" +
                                 dbconfig.port + "/" +
                                 dbconfig.name,
            options: {
                auth: { authdb: "admin" }
            }
        }
    },

    // subscription service provider
    subscription: {
        name: "Stripe",
        privkey: ""
    },

    // webtoken
    webtoken: {
        secret: "somying"
    }
};