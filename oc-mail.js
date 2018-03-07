'use strict';

var mailer = require('nodemailer');
var config = require('./oc-config');
var verifier = require('email-verify');

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

        verifier.verify ( mail.to, function (err,info) {

            if ( err ) {

                console.log ( err );
                reject ( err );

            } else if ( info.success ) {

                console.log ( "Success (T/F): " + info.success );
                console.log ( "Info: " + info.info );
                // transporter.sendMail(mail, (error, info) => {
                //     if (error) {
                //         console.log(error);
                //         reject(error);
                //         return;
                //     }
                //     console.log('message sent to %s', mail.to);
                //     // console.log ( 'Preview URL: %s', mailer.getTestMessageUrl(info) );
                //     resolve(info);
                // });
                resolve ( "Ok" );

            } else {

                reject ( info.info );

            }
        });
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
// validate email address
var checkMail = function (receiver ) {

    return new Promise((resolve, reject) => {

        verifier.verify ( receiver, function (err, info) {

            if (err) {
                console.log ( err );
                reject ( err );
            } else {
                console.log ( "Success (T/F): " + info.success );
                console.log ( "Info: " + info.info );

                var infoCodes = verifier.infoCodes;
                //Info object returns a code which representing a state of validation:

                //Connected to SMTP server and finished email verification
                // console.log(info.code === infoCodes.finishedVerification);

                //Domain not found
                // console.log(info.code === infoCodes.domainNotFound);

                //Email is not valid
                // console.log(info.code === infoCodes.invalidEmailStructure);

                //No MX record in domain name
                // console.log(info.code === infoCodes.noMxRecords);

                //SMTP connection timeout
                // console.log(info.code === infoCodes.SMTPConnectionTimeout);

                //SMTP connection error
                // console.log(info.code === infoCodes.SMTPConnectionError)
                resolve ( info );
            }
        });
    });
}
