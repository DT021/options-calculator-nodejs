'use strict';

// test mongo console login
// mongo -u hph65_mongoadmin -p ig1Eeng3vu --authenticationDatabase admin --host localhost --port 34302 oc

var dbconfig = {
    user: 'hph65_mongoadmin',
    pass: 'ig1Eeng3vu',
    host: 'localhost',
    port: 21302,
    name: 'oc'
};

module.exports = {

    // node server settings
    server: {
        port: 3000
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
    }
};