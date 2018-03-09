'use strict';

var mailer = require('nodemailer');
// var verifier = require('email-verify');
var emailExistence = require('email-existence');
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

var transporter = mailer.createTransport ( mgconfig );

///////////////////////////////////////////////////////////////////////////////
// route to log out
module.exports.sendMail = function sendMail(mail) {

    return new Promise((resolve,reject) => {

        // TODO: for test purpose only
        setTimeout(function () {
            resolve ( "OK" );
        }, 2000);

        // checkMail ( mail.to, function(err,response) {
        //     if ( err ) {
        //         // console.log('emailExistence: ' + err );
        //         reject ( err );
        //     }
        //     else if ( ! response ) {
        //         // console.log ( 'emailExistence: ' + response );
        //         reject ( "invalid address" );
        //     } else {
        //         resolve ( "OK" );
        //     }
        // });

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


        // verifier.verify ( mail.to, function (err,info) {
        //     if ( err ) {
        //         console.log ( err );
        //         reject ( err );
        //     } else if ( info.success ) {
        //     } else {
        //         // switch ( info.code ) {
        //         //     //Connected to SMTP server and finished email verification
        //         //     case verifier.infoCodes.finishedVerification): {}
        //         //     //Domain not found
        //         //     case verifier.infoCodes.domainNotFound): {}
        //         //     //Email is not valid
        //         //     case verifier.infoCodes.invalidEmailStructure): {}
        //         //     //No MX record in domain name
        //         //     case verifier.infoCodes.noMxRecords): {}
        //         //     //SMTP connection timeout
        //         //     case verifier.infoCodes.SMTPConnectionTimeout): {}
        //         //     //SMTP connection error
        //         //     case verifier.infoCodes.SMTPConnectionError): {}
        //         // }
        //         console.log ( "Info: %s", info.info );
        //         reject ( info.info );
        //     }
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
module.exports.checkMail = function checkMail(receiver,callback) {

    emailExistence.check ( receiver, callback );
}
