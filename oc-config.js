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
    name: "oc"
};

module.exports = {

    // node server settings
    server: {
        host: "http://localhost",
        port: 3000,
        docroot: "./public"
    },

    // mail settings from mailgun.com
    mail: {
        user: "postmaster@sandboxb727e194a6e748ac8d51dd5e682de3be.mailgun.org",
        pass: "37c6e0e79a16ab458d99aa239c1b9960"
    },

    // mongodb settings
    db: {

        production: {
            url: "mongodb://" + dbconfig.user + ":" +
                                dbconfig.pass + "@" +
                                dbconfig.host + ":" +
                                dbconfig.port + "/" +
                                dbconfig.name,
            options: {
                auth: { authdb: "admin" },
            }
        },

        development: {
            url: "mongodb://" + dbconfig.host + "/" +
                                dbconfig.name,
            options: {
                useMongoClient: true
            }
        },

        test: {
            url: "mongodb://" + dbconfig.user + ":" +
                                dbconfig.pass + "@" +
                                dbconfig.host + ":" +
                                dbconfig.port + "/" +
                                dbconfig.name,
            options: {
                auth: {
                    authdb: "admin"
                },
            }
        }
    },

    // subscription service provider
    subscription: {
        name: "Paymill",
        endpoint: "https://api.paymill.com/v2.1/",
        privkey: ""
        // plans: {
        //     basic:    plan ( "0", "BASIC",    5,   "1",  true ), // monthly $5, recurring
        //     standard: plan ( "1", "STANDARD", 10,  "1",  true ), // monthly $10, recurring
        //     premium:  plan ( "2", "PREMIUM",  100, "12", false ) // yearly $100, non-recurring
        // }
    }
};