'use strict';

var mailer = require('nodemailer');
var config = require('./os-config');

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

    new Promise((resolve,reject) => {

        transporter.sendMail(mail, (error,info) => {
            if (error) {
                console.log(error);
                reject(err);
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
    return {
        from: '"IronCondorTrader" <info@ironcondortrader.com>', // sender address
        subject: 'Please verify your IronCondorTrader account', // Subject line
        to: receiver, // list of receivers
        html: 'Hello ' + name + ',<br><br>' +
            'please click the link below in order to verify your email address.<br><br>' +
            '<a href="localhost:3000/confirm/' + token + '">click here</a>' // html body
    };
}
