'use strict';

var mailer = require('nodemailer');
var config = require('./oc-config');

///////////////////////////////////////////////////////////////////////////////
// route to log out
var mgconfig = {

    service: 'MailGun',

    auth: {
        // user: config.mail.user, // mail user
        // pass: config.mail.pass  // mail password
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

var transporter = mailer.createTransport ( awsconfig );

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.sendMail = function sendMail(mail) {

    return new Promise((resolve,reject) => {

        transporter.sendMail(mail, (error,info) => {
            if (error) {
                console.log(error);
                reject(error);
                return;
            }
            console.log('message sent to %s', mail.to);
            // console.log ( 'Preview URL: %s', mailer.getTestMessageUrl(info) );
            resolve(info);
        });
    });
}

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.createMail = function createMail(receiver,name,token) {

    var link = config.server.host + ":" + config.server.port + "/confirm/" + token;

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
