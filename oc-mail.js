'use strict';

var fs = require('fs');
var ejs = require("ejs");
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

    host: "smtp.mailgun.com",

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

var logger = null;

///////////////////////////////////////////////////////////////////////////////
// set logger
module.exports.setLogger = function(log) {
    logger = log;
}

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.sendMail = function(mail,callback) {

    transporter.sendMail ( mail, callback );
}

///////////////////////////////////////////////////////////////////////////////
// create account confirmation mail
module.exports.createConfirmationMail = function(receiver,name,token,ip) {

    var link = "https://ironcondortrader.com/confirm/" + token;
    var html = readMailPartial ( 'confirmation', { link : link,
                                                   name : name,
                                                   ip : ip } );
    return {
        from: '"IronCondorTrader©" <info@ironcondortrader.com>',
        subject: 'Account Verification Request',
        to: receiver,
        html: html
    };
}

///////////////////////////////////////////////////////////////////////////////
// create recovery  mail
module.exports.createRecoveryMail = function(receiver,token,ip) {

    var link = "https://ironcondortrader.com/recover/" + token;
    var html = readMailPartial ( 'recover', { link: link, ip: ip } );
    return {
        from: '"IronCondorTrader©" <info@ironcondortrader.com>',
        subject: 'Password Reset Request',
        to: receiver,
        html: html
    };
}

///////////////////////////////////////////////////////////////////////////////
// create notification  mail
module.exports.createNotificationMail = function(receiver,name,message) {

    var html = readMailPartial('notification', { name: name, message: message });
    return {
        from: '"IronCondorTrader©" <info@ironcondortrader.com>',
        subject: 'Account Update Notification',
        to: receiver,
        html: html
    };
}

///////////////////////////////////////////////////////////////////////////////
//
module.exports.checkMail = function(email, callback, timeout, from_email) {

    // TODO: for test purpose only
    // if ( isDevelop() && ! awstest.includes(email) ) {
    //     callback ( "invalid amazon test address", false );
    //     return;
    // }

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
                        if ( data.indexOf("Amazon SES Mailbox Simulator" ) != -1 ) {
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

///////////////////////////////////////////////////////////////////////////////
// read the partial file and replaces ejs placeholders
function readMailPartial(file,tags) {
    var f = fs.readFileSync(__dirname + "/partials/mails/" + file + ".ejs", 'utf8');
    return ejs.render(f,tags);
}