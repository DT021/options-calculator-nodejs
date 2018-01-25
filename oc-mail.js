'use strict';

var mailer = require('nodemailer');
var config = require('./oc-config');

///////////////////////////////////////////////////////////////////////////////
// route to log out
var transporter = mailer.createTransport ({

    service: 'MailGun',

    auth: {
        user: config.mail.user, // mail user
        pass: config.mail.pass  // mail password
    },

    tsl: {
        rejectUnauthorized: false
    }

});

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
        subject: 'Please verify your IronCondorTrader account',
        to: receiver,
        html: '<div style="font-size:1.2em;">' +
              '<p>Hello ' + name + ',</p>' +
              '<p>please click the link below in order to confirm your email address.</p>' +
              '<a href="' + link + '">' + link + '</a>' +
              '</div>'
    };
}
