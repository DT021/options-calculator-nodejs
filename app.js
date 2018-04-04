'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const favicon = require('serve-favicon');
const morgan = require('morgan');
const fs = require('fs');
const https = require('https');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const BasicStrategy = require('passport-http').BasicStrategy;
const auth = require('passport-local-authenticate');
// const MongoStore = require('mongo-connect')(express);
const debug = require('debug')('optionscalculator:server');
const http = require('http');
const mailer = require('nodemailer');
const random = require('randomstring');
const compression = require('compression');
const minifyHTML = require('express-minify-html');
const ejs = require("ejs");
// TODO: put private key in env variable !!!!
const stripe = require("stripe")("sk_test_Zq5hjqL7e3qJOCh3TaO2eFqR");

const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs'); npm install bcryptjs --save

// own stuff
const rc = require('./oc-return-codes');
const ec = require('./oc-error-codes');
const config = require('./oc-config');
const mail = require('./mail/oc-mail');

///////////////////////////////////////////////////////////////////////////////
// init log4js
const log4js = require('log4js');
log4js.configure ( {
    appenders: { server: { type: 'file',
                           filename: 'logs/server.log',
                           maxLogSize: 100000,
                           compress: true } },
    categories: { default: { appenders: ['server'], level: 'all' } }
});
const logger = log4js.getLogger('server');
logger.debug('started');
mail.setLogger (logger);

// create a write stream (in append mode)
// const accessLogStream = fs.createWriteStream ( path.join(__dirname,
//                                                'access.log'), {flags: 'a'} );
// accessLogStream.write('__dirname=' + __dirname);
// var serverLogStream = fs.createWriteStream ( path.join(__dirname,
//                                                'server.log'), {flags: 'a'} );

// setup the logger
// app.use ( morgan('dev',{stream: accessLogStream}) );
// app.use(morgan('common', { skip: function (req, res)
//    {
//        return res.statusCode < 400 }, stream: accessLogStream
//    }));

// TODO: should be populized from stripe
const subscriptionsPlans = [
    {
        id: 0,
        name: "DEMO",
        price: 0,
        period: "NEVER",
        recurring: false
    },{
        id: 1,
        name: "BASIC",
        price: 5,
        period: "MONTH",
        recurring: true
    },{
        id: 2,
        name: "STANDARD",
        price: 10,
        period: "MONTH",
        recurring: true
    },{
        id: 3,
        name: "PREMIUM",
        price: 100,
        period: "YEAR",
        recurring: false
    }
];

// used by stripe webhook
const ENDPOINT_SECRETS = "whsec_daeR1paBWMn6r9MA1XXgYm3AMmHpr66o";

// get access to express
const app = express();

// get the current enviroment
var env = app.settings.env;

// set view engine to EJS
app.set('view engine', 'ejs' );
app.set('views', config.server.docroot );

// set constants used by session
const COOKIE_SECRET = 'asdf33g4w4hghjkuil8saef345';
const COOKIE_EXPIRETION = 24 * 60 * 60 * 1000; // 24 hours

// set cookie parser middleware
app.use ( cookieParser(COOKIE_SECRET) );
app.use ( session({

    secret: COOKIE_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true, // FIXME: must ne set in production
        expires: new Date(Date.now() + COOKIE_EXPIRETION)
    },
    // store: new MongoStore( { url: config.db[env].url, collection: 'sessions' } )
 }));

 // set intialized passport
app.use ( passport.initialize() );
app.use ( passport.session() );
// ejs minifier
app.use ( minifyHTML({
    override: false,
    exception_url: false,
    htmlMinifier: {
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        minifyJS: true
    }
}));

// compress all requests
app.use ( compression() );

console.log ( "dir=" + __dirname );
console.log ( "rootdoc=" + config.server.docroot );
console.log ( "env=" + env );
console.log ( "conf=" + config.db[env].url );
console.log ( "options=" + JSON.stringify(config.db[env].options) );

// connect database
var dbConnected = false;
// const Strategy = require('./mongo/Strategy.model');
// const User = require('./mongo/User.model');
// const dbgoose = require('./mongo/mongo');
var Strategy = null;
var User = null;
const dbgoose = require('./dynamo/dynamo');
dbgoose.init(env,logger).then( params=> {
    Strategy = require('./dynamo/Strategy.model');
    User = require('./dynamo/User.model');
    logger.debug("database connection to %s established", config.db[env].url );
    console.log( "database connection established" );
    dbConnected = true;
}).catch ( err=> {
    logger.debug("database connection failed %s", JSON.stringify(err));
    console.log ( err );
});

// set body parser
app.use ( bodyParser.json() );
// app.use ( bodyParser.urlencoded({ extended: false }) );
app.use ( bodyParser.raw({ type: "*/*" }) );

//
passport.serializeUser((user,done)=> {
    done ( null, user.email );
});

//
passport.deserializeUser((id,done)=> {
    // User.findById ( id, function(err,user) {
    User.get ( id, function(err,user) {
        done ( err, user );
    });
});

//
// passport.use ( new LocalStrategy...
passport.use(new BasicStrategy({usernameField:'email'},(email,password,done)=> {

    // User.findOne ( { email: email }, function(err, user) {
    User.get ( email, function(err, user) {
        if ( err ) {
            logger.error("passport validation failed for %s: %s",email,
                                                                 JSON.stringify(err));
            return done ( err );
        }
        if ( ! user ) {
            return done ( { message: "user doesn't exist" }, false );
        }
        // if ( ! user.validPassword(password)) {
        if ( ! dbgoose.validPassword(password,user.password)) {
            return done ( { message: "incorrect password" }, false);
        }
        return done ( null, user );
    });
  }
));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// add latency for testing purpose
///////////////////////////////////////////////////////////////////////////////
// app.use('/', (req,res,next)=> { setTimeout(next, 1000) });
// app.use('/login', (req,res,next)=> { setTimeout(next,500) });
// app.use('/logout', (req,res,next)=> { setTimeout(next,500) });
// app.use('/register', (req,res,next)=> { setTimeout(next, 500) });
// app.use('/strategies', (req,res,next)=> { setTimeout(next, 1000) });
// app.use('/strategies/:id', (req,res,next)=> { setTimeout(next, 1000) });
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * main page when logged out
 * @return the main page - content depends on wheather the user is logged in and
 * on his subsription
 */
app.get('/', (req,res,next) => {

    if ( req.isAuthenticated() && req.user.plan < 1 ) {

        // this is set when user logged in but has not yet subscribed
        res.render('index', {

            whatif : readPartial("logout/whatif"),
            neww   : readPartial("logout/neww"),
            add    : readPartial("logout/add"),
            reverse: readPartial("logout/reverse"),
            save   : readPartial("logout/save"),
            saveas : readPartial("logout/saveas"),
            remove : readPartial("logout/remove"),
            select : readPartial("logout/select"),
            auth   : readPartial("login/auth")
        });

    } else if (req.isAuthenticated() ) {

        // this is set when user logged in
        res.render('index', {

            whatif : readPartial("login/whatif"),
            neww   : readPartial("login/neww"),
            add    : readPartial("login/add"),
            reverse: readPartial("login/reverse"),
            save   : readPartial("login/save"),
            saveas : readPartial("login/saveas"),
            remove : readPartial("login/remove"),
            select : readPartial("login/select"),
            auth   : readPartial("login/auth")
        });

    } else {

        // this is set when user is logged out
        res.render ( 'index', {

            whatif : readPartial("logout/whatif"),
            neww   : readPartial("logout/neww"),
            add    : readPartial("logout/add"),
            reverse: readPartial("logout/reverse"),
            save   : readPartial("logout/save"),
            saveas : readPartial("logout/saveas"),
            remove : readPartial("logout/remove"),
            select : readPartial("logout/select"),
            auth   : readPartial("logout/auth")
        });
    }
});

/**
 * route to test if the user is logged in or not
 * @return the logged in user and his subscribed plan
 */
app.get('/auth', (req,res,next) => {

    if ( ! checkAuthenticaton(req,res) ) { return; }

    res.status(rc.Success.OK).send({success: true,
                                    user: req.user,
                                    plan: subscriptionsPlans[req.user.plan]});
});

/**
 * stripe webhook
 */
app.get('/webhook', (req,res,next) => {

    var sig = req.headers["stripe-signature"];
    try {
        var event = stripe.webhooks.constructEvent(req.body,
                                                   sig,
                                                   ENDPOINT_SECRETS);
        logger.info ( "webhook received %s", event );
    }
    catch ( err ) {
        logger.error ("webhook error: %s", err );
    }
    res.status(rc.Success.OK).send(apiSuccess());
});

/**
 * route return available subscription plans
 * @return the subscriptions plans
 */
app.get('/plans', (req,res,next) => {

    // TODO: testing purpose only
    // stripe.plans.list().then ( plans => {
    //     for ( var i in plans.data ) {
    //         subscriptionsPlans[i].name = plans.data[i].nickname;
    //         subscriptionsPlans[i].price = plans.data[i].amount/100;
    //         subscriptionsPlans[i].period = plans.data[i].interval.toUpperCase();
    //         // subscriptionsPlans[i].created = plans.data[i].created
    //         // subscriptionsPlans[i].currency = plans.data[i].currency
    //         // subscriptionsPlans[i].id = plans.data[i].id
    //         // subscriptionsPlans[i].interval_count = plans.data[i].interval_count
    //         // subscriptionsPlans[i].livemode = plans.data[i].livemode
    //         // subscriptionsPlans[i].metadata = plans.data[i].metadata
    //         // subscriptionsPlans[i].object = plans.data[i].object
    //         // subscriptionsPlans[i].product = plans.data[i].product
    //         // subscriptionsPlans[i].trial_period_days = plans.data[i].trial_period_days
    //     }
        res.status ( rc.Success.OK ).send ( { "plans" : subscriptionsPlans } );
    // }).catch ( err => {
    //     res.status(rc.Client.REQUEST_FAILED).send({ "plans": subscriptionsPlans } );
    // });
});

/**
 * verify passed password
 * @param { email, password }
 * @return { success: true }
 */
app.post('/verify', (req,res,next) => {

    var email = req.body.credentials.email;
    var password = req.body.credentials.password;

    logger.info ( "verification of account %s requested", email );
    // User.findOne({ email: email }, function(err,user) {
    User.get(email, function(err,user) {
        if (err) {
            logger.error("verification of %s failed: %s", email, err);
            dbError(res,err);
            return;
        } else if (!user) {
            logger.error("verification of %s failed: user doesn't exist", email,
                                                                          err);
            res.status(rc.Client.UNAUTHORIZED).send(apiError(ec.Account.USER_NOT_FOUND));
            return;
        // } else if (!user.validPassword(password)) {
        } else if (!dbgoose.validPassword(password)) {
            logger.error("verification of %s failed: incorrect password", email,
                                                                          err);
            res.status(rc.Client.UNAUTHORIZED).send(apiError(ec.Account.NOT_AUTHORIZED));
            return;
        } else {
            logger.info("verification of account %s succeeded", email);
            res.status(rc.Success.OK).send(apiSuccess());
        }
    });
});

/**
 * change password
 * @param { email, passowrd, newpassword }
 * @return { success: true }
 */
app.post('/chgpass', (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    var email = req.body.credentials.email;
    var password = req.body.credentials.password;
    var newpassword = req.body.credentials.newpassword;

    logger.info( "password change for account %s requested", email) ;
    // User.findOne({ email: email }, function(err,user) {
    User.get(email, function(err,user) {
        if (err) {
            logger.error("password change of user %s failed: %s", email, err);
            dbError(res,err);
        } else if (!user) {
            logger.error("user %s doesn't exist", email);
            res.status(rc.Client.NOT_FOUND).send(apiError(ec.Account.USER_NOT_FOUND));
        // } else if (user.validPassword(password)) {
        } else if (dbgoose.validPassword(password)) {
            user.password = newpassword;
            user.save(function (err) {
                if (err) {
                    logger.error("password change of account %s failed: %s",
                                                                    email, err);
                    dbError(res,err);
                    return;
                };
                logger.info("password change of account %s succeeded", email);
                sendNotificationMail(user, "you have successfully changed your password.");
                res.status(rc.Success.OK).send(apiSuccess());
            });
        } else {
            logger.error("password change of account %s failed: unauthorized",
                                                                    email, err);
            res.status(rc.Client.UNAUTHORIZED).send(apiError(ec.Account.VERIFICATION_FAILED));
        }
    });
});

/**
 * send an email
 * @param { type[recover], receiver, ip }
 * @return { success: true }
 */
app.post('/sendmail', (req,res,next) => {

    var mail = req.body.mail;
    var host = req.headers.origin;
    logger.info("attempt to send %s mail to %s requested by [%s]",  mail.type,
                                                                    mail.receiver,
                                                                    mail.ip);

    // find user in oder to save token
    // User.findOne({ email: mail.receiver }, (err, user) => {
    User.get(mail.receiver, (err, user) => {
        if (err) {
            logger.error("sending %s mail failed: user %s doesn't exist in database",
                                                                    mail.type,
                                                                    mail.receiver);
            switch (mail.type) {
                case "recover": {
                    // NOTE: even if the account doesn't exist we do
                    // respond success in order to prevent potential data abuse
                    res.status(rc.Success.OK).send(apiSuccess());
                    return;
                }
                default: {
                    dbError(res,err);
                    return;
                }
            }
        } else if ( user ) {
            switch (mail.type) {
                // send password reset mail
                case "recover": {
                    var token = random.generate();
                    user.secretToken = token;
                    user.save(function (err) {
                        if (err) {
                            logger.error("saving token of customer %s failed: %s",
                                                                newUser.email,
                                                                JSON.stringify(err));
                            dbError(res,err);
                        } else {
                            logger.info("token of account %s updated in database",
                                                                mail.receiver);
                            sendRecoveryMail(mail.receiver,
                                             token,
                                             mail.ip,
                                             function (err, info) {
                                if (err) {
                                    logger.error("sending %s mail to %s failed: %s",
                                                                mail.type,
                                                                mail.receiver,
                                                                JSON.stringify(err));
                                    res.status(rc.Server.INTERNAL_ERROR).
                                        send(apiError(ec.Mail.SENDING_FAILURE));
                                } else {
                                    logger.info("sending %s mail to %s succeeded",
                                                                mail.type,
                                                                mail.receiver);
                                    res.status(rc.Success.OK).send(apiSuccess());
                                }
                            });
                        }
                    });
                    break;
                }
                // send/resend account confirmation mail
                case "confirm": {
                    sendConfirmationMail(user,
                                         mail.ip,
                                         function (err, info) {
                        if (err) {
                            logger.error("resending confirmation mail to %s failed",
                                                                userid,
                                                                JSON.stringify(err));
                            res.status(rc.Server.INTERNAL_ERROR).send(apiError(ec.Mail.SENDING_FAILURE));
                        } else {
                            logger.info("resending confirmation mail to %s succeeded",
                                                                mail.receiver);
                            res.status(rc.Success.OK).send(apiSuccess());
                        }
                    });
                }
            }
        } else {
            logger.info("sending %s mail to %s failed: user doesn't exist",
                                                                    mail.type,
                                                                    mail.receiver);
            // NOTE: even if the email address doesn't exist we do
            // respond success in order to prevent potential data abuse
            res.status(rc.Success.OK).send(apiSuccess());
        }
    });
});

/**
 * route to log in
 * @param BASIC authentication
 * @return { success: true } and an access token
 */
app.post('/login', (req,res,next) => {

    if ( ! dbConnected ) {
        // return next("no database connection");
        res.status(rc.Server.INTERNAL_ERROR).send(apiError(ec.Db.NOT_CONNECTED));
    }

    passport.authenticate('basic',(err,user,info)=> {
        if ( err || ! user ) {
            // return next ( "invalid username and password combination" );
            res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Account.INVALID_CRED));
            return;
        } else if ( ! user.active ) {
            // user is registered but has not yet confirmed his account
            // return next ( "account not yet confirmed" );
            res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Account.NOT_CONFIRMED));
            return;
        }

        req.login ( user, err => {
            if ( err ) {
                // return next ( err );
                res.status(rc.Server.INTERNAL_ERROR).send(apiError(ec.Cookie.SET_FAILED));
                return;
            }
        });

        // TODO: enable webtoken
        // create a token
        var token = jwt.sign ( { id: user.id }, config.webtoken.secret, {
            expiresIn: 86400 // expires in 24 hours
        });
        res.status ( rc.Success.OK ).send ( apiSuccess({ success: true,
                                                         token: token }) );

    })(req,res,next);
});

/**
 * route to log out
 * @return redirect to root
 */
app.post('/logout', (req,res,next) => {

    if ( ! checkAuthenticaton(req,res) ) { return; }

    req.logOut();
    res.redirect ('/' );
});

/**
 * subscribe to a plan
 * @param { token, subscription }
 * @return { stripeID: customerID }
 */
app.post('/subscribe', async (req,res,next) => {

    let token = req.body.token;
    let subscription = req.body.subscription;
    let customerID = subscription.stripeID;
    let subscriptionID = null;
    let itemID = null;
    let newPlanName = subscriptionsPlans[subscription.planid].name;

    logger.info("subscription of account %s to plan %s requested", subscription.email,
                                                                   newPlanName );

    // check if customer exists
    if ( ! customerID ) {
        try {
            let customers = await stripe.customers.list({ email: subscription.email } );
            if ( customers && customers.data.length ) {
                customerID = customers.data[0].id;
                logger.info("%s has already a stripe account", subscription.email);
            }
        } catch ( err ) {
            logger.error("access to stripe failed for %s: %s", subscription.email,
                                                            JSON.stringify(err) );
            res.status ( rc.Client.REQUEST_FAILED ).send ( apiError(ec.Stripe.ACCESS_ERROR) );
            return;
        }
    }

    try {
        // get subscripton id if customer already exists
        if ( customerID ) {
            let subscriptions = await stripe.subscriptions.list({ customer: customerID });
            if (subscriptions && subscriptions.data.length) {
                subscriptionID = subscriptions.data[0].id;
                logger.info("%s already subscribed to %s", subscription.email,
                                            subscriptions.data[0].plan.nickname);
            }
        // create new customer
        } else {
            let customer = await stripe.customers.create ( { email: token.email,
                                                            source: token.id } );
            if ( customer ) {
                customerID = customer.id;
                logger.info("stripe account for %s created", subscription.email);
            }
        }
    } catch ( err ) {
        logger.error("access to stripe for %s failed: %s", subscription.email, err);
        res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Stripe.ACCESS_ERROR));
        return;
    }

    // create new subscription
    if ( ! subscriptionID ) {
        stripe.subscriptions.create({customer: customerID,
                                     tems:[{plan:subscription.planid}]
        }).then ( subscription => {
            // customer charged automatically
            logger.info("subscription of %s succeeded", subscription.email);
            res.status(rc.Success.OK).send(apiSuccess({ stripeID: customerID }));
            // res.redirect  ( "/" );
        }).catch(err => {
            logger.error("subscription of %s failed: %s", subscription.email,
                                                            err);
            res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Stripe.ACCESS_ERROR));
            return;
        });
    // change exsisting subscription
    } else {
        let items = await stripe.subscriptionItems.list ( { subscription:
                                                            subscriptionID } );
        if ( items && items.data.length ) {
            itemID = items.data[0].id;
        }

        // update subscription plan
        stripe.subscriptionItems.update(itemID,{plan:subscription.planid
        }).then ( transfer => {
            logger.info("subscription change to %s of %s succeeded",
                                                            newPlanName,
                                                            subscription.email);
            res.status(rc.Success.OK).send(apiSuccess({ stripeID: customerID }));
        }).catch ( err => {
            logger.error("subscription change to %s of %s failed: %s",
                                                            newPlanName,
                                                            subscription.email, err);
            res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Stripe.ACCESS_ERROR));
            return;
        });
    }
});

/**
 * checkout payment
 * @param { token, checkout }
 * @return { success: true }
 */
app.post('/checkout', (req,res,next) => {

    var token = req.body.token;
    var checkout = req.body.checkout;

    // create customer
    stripe.customers.create({ email: token.email,
                              source: token.id
        }).then ( customer => {
            // charge customer
            stripe.charges.create({ amount: checkout.price,
                                    description: checkout.description,
                                    currency: checkout.currency,
                                    customer: customer.id })
        }) .then ( charge => {
            res.status ( rc.Success.ACCEPTED ).send ( apiSuccess() );
        }).catch ( err => {
            res.status(rc.Client.REQUEST_FAILED).
                                    send(apiError(ec.Stripe.CHECKOUT_FAILURE));
        });
});

/**
 * add a user to the database and send an confirmation mail
 * @param { user-object }
 * return newly created user object and the associated subscription plan
 */
app.post('/register', (req,res,next) => {

    logger.info("registering for account %s requested", req.body.email);

    var newUser = new User ( req.body );
    mail.checkMail ( newUser.email, function (err,response) {
        if ( err || ! response )
        {
            logger.error("registering of customer %s failed: %s",newUser.email,
                                                                 JSON.stringify(err) );
            res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Mail.INVALID_ADDRESS));
            return;
        }

        newUser.secretToken = random.generate();
        newUser.active = false;
        dbgoose.encrypt(newUser);
        newUser.save(function (err) {
            if ( err ) {
                logger.error("registering of customer %s failed: %s",newUser.email,
                                                                     JSON.stringify(err));
                dbError(res,err);
            } else {
                logger.info("registering of customer %s succeeded", newUser.email);
                sendConfirmationMail(newUser,
                                     req.body.ip,
                                     function(err,info) {
                    if ( err ) {
                        logger.error("confirmation mail couldn't be sent to %s: %s",
                                             newUser.email, JSON.stringify(err));

                        let error = null;
                        switch ( err.code ) {
                            case 11000: {
                                error = ec.Account.USER_ALREADY_EXISTS;
                                break;
                            }
                            case "ENOTFOUND":
                            case "ENODATA": {
                                error = ec.Mail.INVALID_ADDRESS;
                                break;
                            }
                            case "ECONNREFUSED":
                            case "EENVELOPE":
                            default: {
                                error = ec.Mail.UNKNOWN_ERROR;
                            }
                        }
                        res.status(rc.Server.INTERNAL_ERROR).send(apiError(error));

                        // res.status(rc.Server.INTERNAL_ERROR).send(apiError({
                        //     code: err.code,
                        //     message: err.message
                        // }));
                    } else {
                        logger.info("confirmation mail successfully sent to %s",
                                                                newUser.email);
                        res.status(rc.Success.CREATED).send({
                            user: newUser,
                            plan: subscriptionsPlans[newUser.plan]
                        });
                    }
                });
            }
        });
    });
});

/**
 * recover a password via token
 * @param { token }
 * query { password }
 * @return { success: true }
 */
app.get('/recover/:token', (req,res,next) => {

    logger.info("attempt to change password via token %s", req.params.token);
    // User.findOne({ secretToken: req.params.token }, (err, user) => {
    User.scan({ secretToken: {eq: req.params.token} }, (err, user) => {

        if (err) {
            logger.error("attempt to change password via token %s failed: %s",
                req.params.token,
                JSON.stringify(err));
            dbError(res, err);
        } else if (user) {
            // check if customer has send new password
            if (req.query.password) {
                logger.info("customer sent new password via token %s", req.params.token);
                user.password = req.query.password;
                user.secretToken = "";
                user.save((err, user) => {
                    if (err) {
                        logger.error("database update of account %s failed: %s",
                            user.email,
                            JSON.stringify(err));
                        dbError(res, err);
                    } else {
                        logger.info("database update of account %s successfully",
                            user.email);
                        var msg = "you have successfully changed your password.";
                        sendNotificationMail(user, msg, function (err, info) {
                            // in case the email coundn't be sent we just log the error but
                            // do not return it
                            if (err) {
                                logger.error("notification couldn't be sent to %s: %s",
                                    user.email,
                                    JSON.stringify(err));
                            } else {
                                logger.info("notification successfully sent to %s",
                                    user.email);
                            }
                        });
                        res.status(rc.Success.OK).send(apiSuccess());
                    }
                    // return;
                });
            } else {
                logger.info("sending password page of account %s", user.email);
                res.render("pages/chgpass", { token: req.params.token });
            }
        } else {
            logger.error("attempt to change password failed: token %s doesn't exist",
                req.params.token);
            res.render("pages/error", {
                error: "Token doesn\'t exist or expired",
                advise: "Please try again. Thanks"
            });
        }
    });
});

/**
 * confirm an account via token
 * @param { token }
 * @return a success page
 */
app.get('/confirm/:token', (req,res,next) => {

    logger.info("attempt to confirm account via token %s", req.params.token );
    // User.findOne ( { secretToken: req.params.token }, (err, user) => {
    User.scan({ secretToken: {eq: req.params.token} }, (err, users) => {

        if (err) {
            logger.error("account confirmation via token %s failed: %s",
                                                                req.params.token,
                                                                JSON.stringify(err));
            dbError(res,err);
        } else if ( users ) {

            let user = users[0];
            user.active = true;
            user.secretToken = '';

            user.save((err,user) => {
                if (err) {
                    logger.error("updating database of %s failed: %s",
                                                                user.email,
                                                                JSON.stringify(err));
                    dbError(res,err);
                } else {
                    logger.info("account confirmation for %s succeeded",
                                                                user.email);
                    res.render("pages/confirm", {
                        header: "Welcome to IronCondorTrader©",
                        message: "Thank you " + user.username +
                                 ", your account is now active and you can " +
                                 " login to IronCondorTrader©",
                        reminder: "Don't forget to SUBSCRIBE !"
                    });
                }
            });
        } else {
            logger.error("account confirmation via token %s failed: token " +
                         "doesn't exist", req.params.token);
            res.render("pages/error", { error: "Token doesn\'t exist or expired",
                                        advise: "Please register again and confirm"+
                                                "your account within 24h. Thanks" });
        }
    });
});

/**
 * return all data associated to one user
 * @param { name }
 * @return the strategy object identified by name
 */
app.get('/strategies/:name', (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    Strategy.find({userid:req.params.name}).sort('name').exec((err,strategies)=> {
        if ( err ) {
            logger.error("finding strategy <%s> failed",req.params.name);
            dbError(res,err);
        } else {
            res.status(rc.Success.OK).send(strategies);
        }
    });
});

/**
 * save as (new)
 * @param { strategy-object }
 * @return the saved strategy object
 */
app.post('/strategies', (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    var newStrategy = new Strategy ( req.body );
    newStrategy.save(function (err) {
        if (err) {
            logger.error("saving strategy <%s> failed", newStrategy.name);
            dbError(res,err);
        } else {
            res.status ( rc.Success.OK ).send ( newStrategy );
        }
    });
});

/**
 * save (update))
 * @param { name }
 * @param { strategy-object }
 * @return the updated strategy object
 */
app.post('/strategies/:name', (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    // Strategy.findOne ( { name : req.params.name}, (err,strategy) => {
    Strategy.scan({ name : {eq: req.params.name} }, (err,strategy) => {

        if ( err ) {
            logger.error("finding strategy <%s> failed", req.params.name);
            dbError(res,err);
        } else {

            strategy.price = req.body.price;
            strategy.vola = req.body.vola;
            for (var i = 0; i < req.body.positions.length; i++) {
                strategy.positions[i] = {
                    amt: req.body.positions[i].amt,
                    type: req.body.positions[i].type,
                    strike: req.body.positions[i].strike,
                    expiry: req.body.positions[i].expiry
                }
            }
            strategy.optionsContract = {
                symbol: req.body.optionsContract.symbol,
                name: req.body.optionsContract.name,
                multiplier: req.body.optionsContract.multiplier,
                price: req.body.optionsContract.price,
                strikes: []
            }
            for (var i = 0; i < req.body.optionsContract.strikes.length; i++) {
                strategy.optionsContract.strikes[i] =
                                            req.body.optionsContract.strikes[i];
            }

            strategy.save((err,strategy) => {
                if ( err ) {
                    logger.error("saving strategy as <%s> failed", strategy.name);
                    dbError(res,err);
                } else {
                    res.status ( rc.Success.OK ).send ( strategy );
                }
            });
        }
    });
});

/**
 * delete strategies
 * @param { userid }
 * @return { success: true }
 */
app.delete('/strategies/:userid', (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    Strategy.remove({ userid: req.params.userid }, (err) => {
        if (err) {
            logger.error("deleting strategies of %s failed", req.params.userid);
            dbError(res,err);
        } else {
            res.status(rc.Success.OK).send(apiSuccess());
        }
    });
});

/**
 * delete a single strategy
 * @param { name }
 * @return { success: true }
 */
app.delete('/strategy/:name', (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    Strategy.remove({ name: req.params.name }, (err) => {
        if (err) {
            logger.error("deleting strategy <%s> failed", req.params.name);
            dbError(res,err);
        } else {
            res.status(rc.Success.OK).send(apiSuccess());
        }
    });
});

/**
 * update stripe
 * @param { user-object }
 * @return { success: true }
 */
app.post('/updstrip/:id', async (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    // User.findOne({ stripe: req.params.id }, (err, user) => {
    User.scan({ stripe: {eq: req.params.id} }, (err, user) => {
        if (err) {
            logger.error("update of stripe account failed: %s doesn't exist",
                                                                req.params.id);
            dbError(res,err);
        } else if (user && user.stripe ) {
            // update email in stripe account
            let data = { email: user.email };
            stripe.customers.update(user.stripe,data).then(customer => {
                logger.info("update of stripe account %s succeeded", req.params.id);
                res.status(rc.Success.OK).send(apiSuccess());
            }).catch(err => {
                logger.error("update of stripe account %s failed.", req.params.id );
                res.status(rc.Server.INTERNAL_ERROR).send(apiError(ec.Stripe.UPDATE_FAILED));
            });
        }
    });
});

/**
 * update account
 * @param { params.id }
 * @param { body.password, body.planid, body.stripeID, body.name, body.newmail }
 * @return user object
 */
app.post('/updacc/:id', async (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    logger.info("attempt to update account %s", req.params.id);

    // User.findOne({ email: req.params.id }, (err, user) => {
    User.get(req.params.id, (err, user) => {
        if (err) {
            logger.error("update of local account %s failed", req.params.id);
            dbError(res,err);
        } else if (user) {
            // check password if passed for vefification
            // if ( req.body.password && !user.validPassword(req.body.password)) {
            if ( req.body.password && !dbgoose.validPassword(req.body.password)) {
                logger.error("verification of %s failed", req.params.id );
                res.status(rc.Client.UNAUTHORIZED).send(apiError(ec.Account.VERIFICATION_FAILED));
                return;
            }

            let item = "";
            // update subscription
            if (req.body.planid && (req.body.planid != user.plan) ) {
                item = "subscription from " + subscriptionsPlans[user.plan].name +
                " to " + subscriptionsPlans[parseInt(req.body.planid)].name;
                user.plan = parseInt(req.body.planid);
                // first time a subscription plan gets updated a stripe
                // id is provided as well
                if (req.body.stripeID ) {
                    user.stripe = req.body.stripeID;
                }
            }
            // update username
            if (req.body.name && (req.body.name != user.username)) {
                item = "username from " + user.username + " to " + req.body.name;
                user.username = req.body.name;
            }
            // update email
            if ( req.body.newemail && (req.body.newemail != user.email) ) {
                user.backup = user.email;
                user.email = req.body.newemail;
                item = "email from " + user.backup + " to " + user.email;
            }
            // update database
            user.save((err,user) => {
                if (err) {
                    if ( err.code == 11000 ){
                        logger.error("update account %s failed: email already exists",
                                                                req.params.id);
                        res.status(rc.Client.REQUEST_FAILED).send(
                                        apiError(ec.Account.USER_ALREADY_EXISTS));
                        return;
                    }
                    logger.error("update of local account %s failed: %s",item,
                                                                req.params.id,
                                                                JSON.stringify(err));
                    dbError(res,err);
                } else {
                    logger.info("update of local account %s succeeded [%s]",item,
                                                                req.params.id);
                    // send notification mail to customer
                    let msg = "you've successfully changed your " + item;
                    sendNotificationMail(user, msg);
                    // if mail has change also send a notification to the old one
                    if ( req.body.newemail ) {
                        sendNotificationMail(user, msg, user.backup);
                    }
                    res.status(rc.Success.OK).send(user);
                }
            });
        } else {
            logger.error("account update of %s failed: user doesn't exist",
                                                                req.params.id);
            res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Account.USER_NOT_FOUND));
        }
    });
});

/**
 * delete account
 * @param { params.id, query.name }
 * @return { success: true }
 */
app.delete('/delacc/:id', async (req,res,next) => {

    if (!checkAuthenticaton(req, res)) { return; }

    let customerID = null;
    let email = req.params.id;
    let username = req.query.name;

    logger.info("attempt to delete account %s", email);

    // find customer
    try {
        var customers = await stripe.customers.list({ email: email });
        if (customers && customers.data.length) {
            customerID = customers.data[0].id;
        }
    } catch (err) {
        logger.error("attempt to delete account %s failed: %s", email,
                                                                JSON.stringify(err));
        res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Stripe.FIND_FAILED));
        return;
    }

    // delete stripe customer if exist
    if ( customerID ) {
        try {
            await stripe.customers.del ( customerID );
            logger.info("deletion of stripe account %s in stripe succeeded",
                                                                    email);
        } catch (err) {
            logger.error("deletion of stripe account %s in stripe failed: %s",
                                                                    email,
                                                                    JSON.stringify(err));
            res.status(rc.Client.REQUEST_FAILED).send(apiError(ec.Stripe.DELETE_FAILED));
            return;
        }
    }

    // delete local user
    User.remove ( { email: email }, (err) => {
        if (err) {
            logger.error("deletion of local account %s failed: %s",
                                                                email,
                                                                JSON.stringify(err));
            dbError(ers,err);
        } else {
            logger.info("deletion of local account %s succeeded", email);
            // send notification mail to customer
            let msg = "we just saw that you have deleted your account. " +
                      "We hope you've been satisfied with " +
                      "our service. Please feel free to contact " +
                      "us anytime in case there's something we should improve. " +
                      "We're looking forward to hear from you.";
            let user = {
                email: email,
                username: username
            };
            sendNotificationMail(user, msg);
            res.status(rc.Success.OK).send(apiSuccess());
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// simple route loging - prints all defined routes
require('express-route-log')(app);

///////////////////////////////////////////////////////////////////////////////
// set static page route
app.use ( express.static(path.join(__dirname,config.server.docroot)) );

// catch 404 and forward to error handler
app.use ( function(req,res,next) {
    var err = new Error('Not Found');
    err.status = rc.Client.NOT_FOUND;
    next ( err );
});

// error handler
app.use ( function(err,req,res,next) {

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status ( err.statusCode || rc.Server.INTERNAL_ERROR ).send ( err );
});

// force https
app.use ( function (req,res,next) {
    if ( ! req.secure && req.get('X-Forwarded-Proto') !== 'https' ) {
        res.redirect  ('https://' + req.get('Host') + req.url );
    }
    else {
        next();
    }
});

///////////////////////////////////////////////////////////////////////////////
// retrieve subscription plans from stripe
// subscriptions.getSubscriptionPlans ( subscriptions.plans );

// const httpsOptions = {
//     key: fs.readFileSync('.ssl/key.pem'),
//     cert: fs.readFileSync('.ssl/cert.pem'),
//     requestCert: false,
//     rejectUnauthorized: false
// }

///////////////////////////////////////////////////////////////////////////////
// setup server
// var port = normalizePort ( process.env.PORT || config.server.port );
var port = config.server.port;
app.set('port', port );
var server = http.createServer ( app );
// var server = https.createServer ( httpsOptions, app );
server.listen ( port );

///////////////////////////////////////////////////////////////////////////////
// Event listener for HTTP server "error" event.
server.on('error', function(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
});

///////////////////////////////////////////////////////////////////////////////
// Event listener for HTTP server "listening" event.
server.on('listening', function() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    console.log ('listening on ' + bind );
});

///////////////////////////////////////////////////////////////////////////////
// local functions
function wait(time) {
    let p = new Promise( (resolve,reject) => {
        setTimeout ( function() {
            resolve("OK");
            // reject("ERROR");
        }, time );
    });
    return p;
}

function checkAuthenticaton (req, res) {

    // parse login and password from headers
    // const b64auth = ( req.headers.authorization || '' ).split(' ')[1] || '';
    // const [login, password] = new Buffer ( b64auth, 'base64' ).toString().split(':');

    // var token = req.headers['Bearer'];
    // if  ( ! token ) {
    //     return false;
    // }
    // jwt.verify ( token, config.webtoken.secret, function (err,decoded) {
    //     if ( err ) {
    //         return false;
    //     }
    // });

    if ( ! req.isAuthenticated()) {
        res.status(rc.Client.UNAUTHORIZED).send(apiError(ec.Account.NOT_AUTHORIZED));
        return false;
    }
    return true;
}

function normalizePort ( val ) {
    var port = parseInt ( val, 10 );
    if ( isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }
    return false;
}

function sendNotificationMail(user,message,oldemail) {

    mail.sendMail(mail.createNotificationMail(oldemail || user.email,
                                              user.username,
                                              message),
                                              (err, info) => {
        // in case the email coundn't be sent we just log the error but
        // do not return it
        if (err) {
            // TODO: log error into an error queue
            logger.error("notification couldn't be sent to %s: %s", user.email,
                                                                    JSON.stringify(err));
        } else {
            logger.info("notification successfully sent to %s", user.email);
        }
    });
}

function sendConfirmationMail (user,ip,callback) {

    mail.sendMail(mail.createConfirmationMail(user.email,
                                              user.username,
                                              user.secretToken,
                                              ip),callback);
}

function sendRecoveryMail(receiver,token,ip,callback) {

    mail.sendMail(mail.createRecoveryMail(receiver,
                                          token,
                                          ip),callback);
}

function sleep (what,time) {
    setTimeout(function () {
        what();
    }, 4000);
};

function readPartial (file) {

    return fs.readFileSync(__dirname + "/partials/" + file + ".ejs", 'utf8');
}

function apiError(err) {
    return { success: false,
             code: err.code,
             message: err.message };
}

function dbError(res,err) {
    res.status(rc.Server.INTERNAL_ERROR).send(apiError(ec.Db.ACCESS_ERROR));
}

function apiSuccess(res) {
    if ( res ) {
        return res;
    }
    return { success: true };
}
