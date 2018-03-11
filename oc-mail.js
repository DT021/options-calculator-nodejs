'use strict';

var mailer = require('nodemailer');
var dns = require('dns');
var net = require('net');
var os = require('os');
var async = require('async');

var config = require('./oc-config');

///////////////////////////////////////////////////////////////////////////////
// route to log out
var mgconfig = {

    service: 'MailGun',

    auth: {
        user: "postmaster@sandboxb727e194a6e748ac8d51dd5e682de3be.mailgun.org",
        pass: "37c6e0e79a16ab458d99aa239c1b9960"
    },

    tsl: {
        rejectUnauthorized: false
    }
};

var awsconfig = {

    service: 'AWS',

    host: "email-smtp.us-east-1.amazonaws.com",
    port: 465,
    secure: true,

    auth: {
        user: "AKIAIQLTR5TRSXONO75Q",
        pass: "AqQtteZADw1khfv5ExJVBZVMMACOdZXDHQlS8G9Vibg4"
    },

    tsl: {
        rejectUnauthorized: false
    }
};

var awstest = ["success@simulator.amazonses.com",
               "bounce@simulator.amazonses.com",
               "ooto@simulator.amazonses.com",
               "complaint@simulator.amazonses.com",
               "suppressionlist@simulator.amazonses.com"];

var transporter = mailer.createTransport ( mgconfig );

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.sendMail = function sendMail(mail) {

    return new Promise((resolve,reject) => {

        // TODO: for test purpose only
        if ( isDevelop() ) {
            setTimeout(function () {
                resolve ( "OK" );
            }, 2000);
        }

        // transporter.sendMail(mail.to, (error, info) => {
        //     if (error) {
        //         console.log(error);
        //         reject(error);
        //         return;
        //     }
        //     console.log('message sent to %s', mail.to);
        //     // console.log ( 'Preview URL: %s', mailer.getTestMessageUrl(info) );
        //     resolve(info);
        // });
    });
}

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.createMail = function createMail(receiver,name,token,host) {

    // var link = config.server.host + ":" + config.server.port + "/confirm/" + token;
    var link = host + "/confirm/" + token;

    return {
        from: '"IronCondorTrader" <info@ironcondortrader.com>',
        subject: 'Please verify your IronCondorTrader© account',
        to: receiver,
        html: '<div style="font-size:1.2em;">' +
              '<p>Hello ' + name + ',</p>' +
              '<p>please click the link below in order to confirm your email address.' +
              ' In case you have not registered to IronCondorTrader© please ignore this email.</p>' +
              '<a href="' + link + '">' + link + '</a>' +
              '</div>'
    };
}

///////////////////////////////////////////////////////////////////////////////
//
module.exports.checkMail = function checkMail(email, callback, timeout, from_email) {

    // TODO: for test purpose only
    if ( isDevelop() ) {
        if ( ! awstest.includes(email) ) {
            callback ( "invalid amazon test address", false );
            return;
        }
    }

    timeout = timeout || 5000;
    from_email = from_email || email;

    /* Does it look like a valid email? */
    /* Our email regex is vulnerable to REDOS on very large input.
        *  Valid emails shouldn't be more than 300 characters anyway.
        *  https://www.rfc-editor.org/errata_search.php?eid=1690 */
    const MAX_EMAIL_LEN = 300;
    if (MAX_EMAIL_LEN < email.length) {
        callback(null, false);
        return;
    }
    if (!/^\S+@\S+$/.test(email)) {
        callback(null, false);
        return;
    }

    dns.resolveMx(email.split('@')[1], function (err, addresses) {
        if (err || addresses.length === 0) {
            callback(err, false);
            return;
        }
        addresses = addresses.sort(function (a, b) {
            return a.priority - b.priority
        })
        var res, undetermined;
        var cond = false, j = 0;
        async.doWhilst(function (done) {
            var conn = net.createConnection(25, addresses[j].exchange);
            var commands = ["helo " + addresses[j].exchange, "mail from: <" + from_email + ">", "rcpt to: <" + email + ">"];
            // console.log(commands);
            var i = 0;
            conn.setEncoding('ascii');
            conn.setTimeout(timeout);
            conn.on('error', function () {
                conn.emit('false');
            });
            conn.on('false', function () {
                res = false
                undetermined = false;
                cond = false;
                done(err, false);
                conn.removeAllListeners();
                conn.destroy();
            });
            conn.on('connect', function () {
                conn.on('prompt', function () {
                    if (i < 3) {
                        conn.write(commands[i]);
                        conn.write('\r\n');
                        i++;
                    } else {

                        res = true;
                        undetermined = false;
                        cond = false;
                        done(err, true);
                        conn.removeAllListeners();
                        conn.destroy(); //destroy socket manually
                    }
                });
                conn.on('undetermined', function () {
                    j++;
                    //in case of an unrecognisable response tell the callback we're not sure
                    cond = true;
                    res = false;
                    undetermined = true;
                    done(err, false, true);

                    conn.removeAllListeners();
                    conn.destroy(); //destroy socket manually

                });
                conn.on('timeout', function () {
                    conn.emit('undetermined');
                });
                conn.on('data', function (data) {
                    if (data.indexOf("220") == 0 ||
                        data.indexOf("250") == 0 ||
                        data.indexOf("\n220") != -1 ||
                        data.indexOf("\n250") != -1) {
                        if ( data.indexOf("Amazon SES") != -1 ) {
                            res = true;
                            undetermined = false;
                            cond = false;
                            done(err, true);
                            conn.removeAllListeners();
                            conn.destroy(); //destroy socket manually
                        } else {
                            conn.emit('prompt');
                        }
                    } else if (data.indexOf("\n550") != -1 || data.indexOf("550") == 0) {
                        err = data;
                        conn.emit('false');
                    } else {
                        err = data;
                        conn.emit('undetermined');
                    }
                });
            });
        }, function () {
            return j < addresses.length && cond
        }, function (err) {
            callback(err, res, undetermined);
        })
    });
}

///////////////////////////////////////////////////////////////////////////////
// check for development enviroment
var isDevelop = function() {
    return ( ! process.env.NODE_ENV  || process.env.NODE_ENV === "development");
}