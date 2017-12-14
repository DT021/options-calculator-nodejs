'use strict';

var dbconfig = {
    user: 'hph65_mongoadmin',
    pass: 'ig1Eeng3vu',
    host: 'localhost',
    port: 21302,
    name: 'oc',
};

module.exports = {
    db: {
        production: {
            url: "mongodb://" + dbconfig.user + ":" +
                                dbconfig.pass + "@" +
                                dbconfig.host + ":" +
                                dbconfig.port + "/" +
                                dbconfig.name,
            options: {
                auth: { authdb: "admin" },
                useMongoClient: true
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
                auth: { authdb: "admin" },
                useMongoClient: true
            }
        }
    }
};