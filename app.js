'use strict';

var express = require('express');
var session = require('express-session');
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var fs = require('fs');
var https = require('https');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var BasicStrategy = require('passport-http').BasicStrategy;
var auth = require('passport-local-authenticate');
var mongoose = require('mongoose');
var debug = require('debug')('optionscalculator:server');
var http = require('http');
var mailer = require('nodemailer');
var random = require('randomstring');
var compression = require('compression');
var minifyHTML = require('express-minify-html');
var ejs = require("ejs");
// TODO: put private key in env variable !!!!
var stripe = require("stripe")("sk_test_Zq5hjqL7e3qJOCh3TaO2eFqR");

var jwt = require('jsonwebtoken');
// var bcrypt = require('bcryptjs'); npm install bcryptjs --save

// own stuff
var rc = require('./oc-return-codes');
var config = require('./oc-config');
var mail = require('./oc-mail');

// get models
var Strategy = require('./Strategy.model');
var User = require('./User.model');

///////////////////////////////////////////////////////////////////////////////
// init log4js
var log4js = require('log4js');
log4js.configure ( {
    appenders: { server: { type: 'file', filename: 'server.log' } },
    categories: { default: { appenders: ['server'], level: 'all' } }
});
var logger = log4js.getLogger('server');
logger.debug('started');
mail.setLogger (logger);

// create a write stream (in append mode)
// var accessLogStream = fs.createWriteStream ( path.join(__dirname, 'access.log'), {flags: 'a'} );
// accessLogStream.write('__dirname=' + __dirname);
// var serverLogStream = fs.createWriteStream ( path.join(__dirname, 'server.log'), {flags: 'a'} );

// setup the logger
// app.use ( morgan('dev',{stream: accessLogStream}) );
// app.use(morgan('common', { skip: function (req, res) { return res.statusCode < 400 }, stream: accessLogStream}));

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

const ENDPOINT_SECRETS = "whsec_daeR1paBWMn6r9MA1XXgYm3AMmHpr66o";

// get access to express
var app = express();

// set view engine to EJS
app.set('view engine', 'ejs' );
app.set('views', config.server.docroot );

// set constants used by session
const COOKIE_SECRET = 'asdf33g4w4hghjkuil8saef345';
const COOKIE_EXPIRETION_DATE = new Date();
const COOKIE_EXPIRETION_DAY = 365;
COOKIE_EXPIRETION_DATE.setDate ( COOKIE_EXPIRETION_DATE.getDate() + COOKIE_EXPIRETION_DAY );

// set cookie parser middleware
app.use ( cookieParser(COOKIE_SECRET) );
app.use ( session({

    secret: COOKIE_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: COOKIE_EXPIRETION_DATE // use expires instead of maxAge
        // store: new MongoStore( { url: config.urlMongo, collection: 'sessions' } )
    }
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

var env = app.settings.env;
console.log ( "dir=" + __dirname );
console.log ( "rootdoc=" + config.server.docroot );
console.log ( "env=" + env );
console.log ( "conf=" + config.db[env].url );
console.log ( "options=" + JSON.stringify(config.db[env].options) );

// connect database
var dbConnected = false;
mongoose.Promise = global.Promise;
mongoose.connect ( config.db[env].url, config.db[env].options ).then ( function(params) {
    logger.debug("database connection to %s established", config.db[env].url );
    console.log ( "connection established" );
    dbConnected = true;
}).catch ( function(err) {
    logger.debug("database connection failed %s", JSON.stringify(err));
    console.log ( err );
});

//Bind connection to error event (to get notification of connection errors)
// mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:') );

// set body parser
app.use ( bodyParser.json() );
app.use ( bodyParser.urlencoded({ extended: false }) );

//
passport.serializeUser(function(user, done) {
    done ( null, user.id );
});

//
passport.deserializeUser(function(id, done) {
    User.findById ( id, function(err,user) {
        done ( err, user );
    });
});

//
// passport.use ( new LocalStrategy ( {usernameField: 'email'}, function(email, password, done) {
passport.use ( new BasicStrategy ( {usernameField: 'email'}, function(email, password, done) {

    User.findOne ( { email: email }, function(err, user) {
        if ( err ) {
            return done ( err );
        }
        if ( ! user ) {
            return done ( { message: "user doesn't exist" }, false );
        }
        if ( ! user.validPassword(password)) {
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
// app.use('/', function (req,res,next) { setTimeout(next, 1000) });
// app.use('/login', function (req,res,next) { setTimeout(next,500) });
// app.use('/register', function (req,res,next) { setTimeout(next, 500) });
// app.use('/strategies', function (req,res,next) { setTimeout(next, 500) });
// app.use('/strategies/:id', function (req,res,next) { setTimeout(next, 500) });
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// main page when logged out
app.get('/', function(req, res) {

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
            auth   : readPartial("login/auth"),
            strikes: readPartial("logout/strikes")
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
            auth   : readPartial("login/auth"),
            strikes: readPartial("login/strikes")
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
            auth   : readPartial("logout/auth"),
            strikes: readPartial("logout/strikes")
        });
    }
});

///////////////////////////////////////////////////////////////////////////////
// route to test if the user is logged in or not
app.get('/auth', function(req,res) {

    if ( ! checkAuthenticaton(req,res) ) { return; }

    res.status ( rc.Success.OK ).send( { 'user': req.user,
                                         'plan': subscriptionsPlans[req.user.plan] } );
});

///////////////////////////////////////////////////////////////////////////////
// stripe webhook
app.get('/webhook', function (req,res) {

    var sig = req.headers["stripe-signature"];

    try {
        var event = stripe.webhooks.constructEvent ( req.body, sig, ENDPOINT_SECRETS );
        console.log  ( "webhook received: " + event );
    }
    catch ( err ) {
        res.status ( rc.Client.BAD_REQUEST ).end();
    }

    res.status ( rc.Success.OK ).send ( "OK" );
});

///////////////////////////////////////////////////////////////////////////////
// route return available subscription plans
app.get('/plans', function (req,res) {

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

///////////////////////////////////////////////////////////////////////////////
// verify passed password
app.post('/verify', function(req,res) {

    var email = req.body.credentials.email;
    var password = req.body.credentials.password;

    logger.info ( "password verification for account %s requested", email );
    User.findOne({ email: email }, function(err,user) {
        if ( err ) {
            logger.error("password verification for %s failed: %s", email,err);
            res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
            return;
        } else if ( ! user ) {
            logger.error("password verification for %s failed: user doesn't exist", email, err);
            res.status ( rc.Client.UNAUTHORIZED ).send ( "user doesn't exist" );
            return;
        } else if ( ! user.validPassword(password) ) {
            logger.error("password verification for %s failed: incorrect password", email, err);
            res.status ( rc.Client.UNAUTHORIZED ).send ( "incorrect password" );
            return;
        } else {
            logger.info("password verification for account %s succeeded", email);
            res.status ( rc.Success.OK ).send ( "OK" );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// change password
app.post('/chgpass', function (req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    var email = req.body.credentials.email;
    var password = req.body.credentials.password;
    var newpassword = req.body.credentials.newpassword;

    logger.info( "password change for account %s requested", email) ;
    User.findOne({ email: email }, function(err,user) {
        if (err) {
            logger.error("password change for user %s failed: %s", email,err);
            res.status(rc.Server.INTERNAL_ERROR).send(err);
        } else if (!user) {
            logger.error("user %s doesn't exist", email);
            res.status(rc.Client.NOT_FOUND).send("user doesn't exist");
        } else if ( user.validPassword(password)) {
            user.password = newpassword;
            user.save(function (err) {
                if ( err ) {
                    logger.error("password change for account %s failed: %s" , email, err );
                    res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
                    return;
                };
                logger.info("password change for account %s succeeded", email);
                res.status ( rc.Success.OK ).send ( "OK" );
            });
        } else {
            logger.error("password change for account %s failed: unauthorized", email, err);
            res.status(rc.Client.UNAUTHORIZED).send(err);
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// route to log in
app.post('/login', function(req,res,next) {

    if ( dbConnected === false ) {
        // user does not exist
        return res.status ( rc.Server.INTERNAL_ERROR ).send ( { success: false,
                                                                message : "failed !",
                                                                error: "no database connection" } );
    }

    passport.authenticate('basic', function(err,user,info) {

        if ( err ) {
            return next ( "invalid username and password combination" ); // will generate a 500 error
        } else if ( user.active === false) {
            // user is registered but has not yet confirmed his account
            return next ( "account not yet confirmed" );
        }

        req.login ( user, function(err) {
            if ( err ) {
                return next ( err );
            }
        });

        // TODO: enable webtoken
        // create a token
        var token = jwt.sign ( { id: user.id }, config.webtoken.secret, {
            expiresIn: 86400 // expires in 24 hours
        });
        res.status ( rc.Success.CREATED ).send ( { success: true, token: token } );

    })(req,res,next);
});

///////////////////////////////////////////////////////////////////////////////
// route to log out
app.post('/logout', function(req,res) {

    if ( ! checkAuthenticaton(req,res) ) { return; }

    req.logOut();
    res.redirect ('/' );
});

///////////////////////////////////////////////////////////////////////////////
// subscribe to a plan
app.post('/subscribe', async function (req,res) {

    var token = req.body.token;
    var subscription = req.body.subscription;
    var customerID = null;
    var subscriptionID = null;
    var itemID = null;

    logger.info("subscription for account %s requested", subscription.email);

    // check if customer exists
    try {
        var customers = await stripe.customers.list({ email: subscription.email } );
        if ( customers && customers.data.length ) {
            customerID = customers.data[0].id;
            logger.info("customer %s  has already a stripe account", subscription.email);
        }
    } catch ( err ) {
        logger.error("access to stripe failed for customer %s: %s", subscription.email, err );
        res.status ( rc.Client.REQUEST_FAILED ).send ( err );
        return;
    }

    try {
        // get subscripton id if customer already exists
        if ( customerID ) {
            var subscriptions = await stripe.subscriptions.list({ customer: customerID });
            if (subscriptions && subscriptions.data.length) {
                subscriptionID = subscriptions.data[0].id;
                logger.info("customer %s has already a subscription id %d", subscription.email, subscriptionID);
            }
        // create new customer
        } else {
            var customer = await stripe.customers.create ( { email: token.email,
                                                            source: token.id } );
            if ( customer ) {
                customerID = customer.id;
                logger.info("stripe account for customer %s created", subscription.email);
            }
        }
    } catch ( err ) {
        logger.error("access to stripe failed for customer %s failed: %s", subscription.email, err);
        res.status ( rc.Client.REQUEST_FAILED ).send ( err );
        return;
    }

    try {
        // create new subscription
        if ( ! subscriptionID ) {
            stripe.subscriptions.create ( { customer: customerID,
                                            items: [{ plan: subscription.planid }] } ).then ( subscription => {
                    // customer charged automatically
                    logger.info("subscription for customer %s succeeded", subscription.email);
                    res.redirect  ( "/" );
                }).catch(err => {
                    logger.error("subscription for customer %s failed: %s", subscription.email, err);
                    res.status ( rc.Client.REQUEST_FAILED ).send ( err );
                    return;
                });
        // change exsisting subscription
        } else {
            var items = await stripe.subscriptionItems.list ( { subscription: subscriptionID } );
            if ( items && items.data.length ) {
                itemID = items.data[0].id;
            }

            // update subscription plan
            stripe.subscriptionItems.update ( itemID, { plan: subscription.planid } ).then ( transfer => {
                logger.info("subscription change for customer %s succeeded", subscription.email);
                res.redirect ( "/" );
            }).catch ( err => {
                logger.error("subscription change for customer %s failed: %s", subscription.email, err);
                res.status ( rc.Client.REQUEST_FAILED ).send ( err );
                return;
            });
        }
    } catch ( err ) {
        logger.error("subscription for customer %s failed: %s", subscription.email, err);
        res.status ( rc.Client.REQUEST_FAILED ).send ( err );
    }
});

///////////////////////////////////////////////////////////////////////////////
// checkout payment
app.post('/checkout', function (req,res) {

    var token = req.body.token;
    var checkout = req.body.checkout;

    // create customer
    stripe.customers.create ( { email: token.email,
                                source: token.id }).then ( customer =>
        // charge customer
        stripe.charges.create ( { amount: checkout.price,
                                  description: checkout.description,
                                  currency: checkout.currency,
                                  customer: customer.id
        }).then ( charge => {
            res.status ( rc.Success.ACCEPTED ).send ( { charge : charge } );
        })).catch(err => {
            res.status ( rc.Client.REQUEST_FAILED ).send ( err );
        });
});

///////////////////////////////////////////////////////////////////////////////
// add a user to the database and send an confirmation mail
app.post('/register', function(req,res) {

    if ( dbConnected === false ) {
        // user does not exist
        return res.status ( rc.Server.INTERNAL_ERROR ).send ( { success: false,
                                                                message: "failed !",
                                                                error: "no database connection" });
    }

    logger.info("registering for account %s requested", req.body.email);

    var newUser = new User ( req.body );
    mail.checkMail ( newUser.email, function (err,response) {
        if ( err || ! response )
        {
            logger.error("registering for customer %s failed: %s", newUser.email,JSON.stringify(err) );
            res.status ( rc.Client.REQUEST_FAILED ).send ( err || "invalid mail address" );
            return;
        }

        newUser.secretToken = random.generate();
        newUser.active = false;
        newUser.save(function (err) {
            if ( err ) {
                logger.error("registering for customer %s failed: %s", newUser.email, JSON.stringify(err));
                res.status( rc.Server.INTERNAL_ERROR ).send ( err );
            } else {
                logger.info("registering for customer %s succeeded", newUser.email);
                sendConfirmationMail(newUser,
                                     req.headers.origin,
                                     req.body.ip,
                                     function(err,info) {
                    if ( err ) {
                        logger.error("confirmtion mail couldn't be sent to %s: %s", newUser.email, JSON.stringify(err));
                        res.status(rc.Server.INTERNAL_ERROR).send ( { code : err.code,
                                                                      message : err.message } );
                    } else {
                        logger.info("confirmtion mail successfully sent to %s", newUser.email);
                        res.status(rc.Success.CREATED).send ( { user: newUser,
                                                                plan : subscriptionsPlans[newUser.plan] } );
                    }
                });
            }
        });
    });
});

///////////////////////////////////////////////////////////////////////////////
// re-send confirmation mail
app.post('/resend/:userid', function (req,res) {

    var userid = req.params.userid;
    logger.info("resend confirmation mail to %s requested", userid);
    User.findOne({ email: req.params.userid }, (err, user) => {
        if (err) {
            logger.info("resend confirmation mail to %s failed: %s", userid,err);
            res.status(rc.Server.INTERNAL_ERROR).send(err);
        } else if (user) {
            sendConfirmationMail(user,
                                 req.headers.origin,
                                 req.body.ip,
                                 function (err, info) {
                if (err) {
                    logger.error("resending confirmation mail to %s failed", userid, JSON.stringify(err) );
                    res.status(rc.Server.INTERNAL_ERROR).send({
                        code: err.code,
                        message: err.message
                    });
                } else {
                    logger.info("resending confirmation mail to %s succeeded", userid);
                    res.status(rc.Success.CREATED).send ( { success: true } );
                }
            });
        } else {
            logger.error("resend confirmation mail to %s failed: user doesn't exist", userid );
            res.status(rc.Client.NOT_FOUND).send('The user <' + userid + '> doesn\'t exist.');
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// send an email
app.post('/mail', function (req, res) {

    var mail = req.body.mail;
    var host = req.headers.origin;
    logger.info("attempt to send %s mail to %s requested by [%s]", mail.type,
                                                                   mail.receiver,
                                                                   mail.ip );
    User.findOne({ email: mail.receiver }, (err, user) => {
        if (err) {
            logger.error("sending %s mail failed: user %s doesn't exist in database", mail.type,
                                                                                      mail.receiver );
            // NOTE: even if the account doesn't exist we nevertheless response success to prevent misusage
            res.status(rc.Success.OK).send("OK");
        } else {
            switch (mail.type) {
                case "recovery": {
                    var token = random.generate();
                    user.secretToken = token;
                    user.save(function (err) {
                        if (err) {
                            logger.error("registering for customer %s failed: %s", newUser.email, JSON.stringify(err));
                            res.status(rc.Server.INTERNAL_ERROR).send(err);
                        } else {
                            logger.info("token of account %s updated in database", mail.receiver);
                            sendRecoveryMail(mail.receiver,token,host,mail.ip,function (err,info) {
                                if (err) {
                                    logger.error("sending %s mail to %s failed: %s", mail.type,
                                                                                     mail.receiver,
                                                                                     JSON.stringify(err));
                                    res.status(rc.Server.INTERNAL_ERROR).send(err);
                                } else {
                                    logger.info("sending %s mail to %s succeeded",mail.type,
                                                                                  mail.receiver);
                                    res.status(rc.Success.OK).send("OK");
                                }
                            });
                        }
                    });
                    break;
                }
            }
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// confirm an account via token
app.get('/confirm/:token', function (req,res) {

    logger.info("attempt to confirm account via token %s", req.params.token );
    User.findOne ( { secretToken: req.params.token }, (err, user) => {

        if (err) {
            logger.error("account confirmation via token %s failed: %s", req.params.token, 
                                                                         JSON.stringify(err));
            res.status ( rc.Server.INTERNAL_ERROR ).send(err);
        } else if ( user ) {

            user.active = true;
            user.secretToken = '';

            user.save((err,user) => {
                if (err) {
                    logger.error("updating database of %s failed: %s", user.email, 
                                                                       JSON.stringify(err));
                    res.status ( rc.Server.INTERNAL_ERROR ).send(err);
                } else {
                    logger.info("account confirmation for %s succeeded", user.email);
                    res.render("pages/confirm", { user: user.name });
                }
            });
        } else {
            logger.error("account confirmation via token %s failed: token doesn't exist", req.params.token);
            res.render("pages/error", { error: "Token doesn\'t exist or expired",
                                        advise: "Please register again and confirm\
                                                   your account within 24h. Thanks" });
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// recover a password via token
app.get('/recover/:token', function (req,res) {

    logger.info("attempt to change password via token %s", req.params.token);
    User.findOne({ secretToken: req.params.token }, (err, user) => {

        if (err) {
            logger.error("attempt to change password via token %s failed: %s", req.params.token,
                                                                               JSON.stringify(err));
            res.status(rc.Server.INTERNAL_ERROR).send(err);
        } else if (user) {
            logger.info("sending password page for account %s", user.email);
            // TODO: set proper link
            res.render("pages/chgpass", { link: "https://ironcondortrader.com/setpass/"+req.params.token } );
        } else {
            logger.error("attempt to change password via token %s failed: token doesn't exist", req.params.token);
            res.render("pages/error", { error: "Token doesn\'t exist or expired",
                                        advise: "Please try again. Thanks" });
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all data associated to one user
app.get('/strategies/:name', function(req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    Strategy.find ( { userid: req.params.name }).sort('name').exec( function(err,strategy) {
        if ( err ) {
            res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
        } else {
            res.status ( rc.Success.OK ).send ( strategy );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// save as (new)
app.post('/strategies', function(req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    var newStrategy = new Strategy ( req.body );
    newStrategy.save(function (err) {
        if (err) {
            res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
        } else {
            res.status ( rc.Success.OK ).send ( newStrategy );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// save (update))
app.post('/strategies/:name', function (req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    Strategy.findOne ( { name : req.params.name}, (err,strategy) => {

        if ( err ) {
            res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
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
            strategy.optionDescription = {
                symbol: req.body.optionDescription.symbol,
                name: req.body.optionDescription.name,
                multiplier: req.body.optionDescription.multiplier,
                price: req.body.optionDescription.price,
                strikes: []
            }
            for (var i = 0; i < req.body.optionDescription.strikes.length; i++) {
                strategy.optionDescription.strikes[i] = req.body.optionDescription.strikes[i];
            }

            strategy.save((err,strategy) => {
                if ( err ) {
                    res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
                } else {
                    res.status ( rc.Success.OK ).send ( strategy );
                }
            });
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// delete strategies
app.delete('/strategies/:userid', function (req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    Strategy.remove({ userid: req.params.userid }, (err) => {
        if (err) {
            res.status(rc.Server.INTERNAL_ERROR).send(err);
        } else {
            res.status(rc.Success.OK).send ( { success : true } );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// delete a single strategy
app.delete('/strategy/:name', function(req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    Strategy.remove({ name: req.params.name }, (err) => {
        if (err) {
            res.status(rc.Server.INTERNAL_ERROR).send(err);
        } else {
            res.status(rc.Success.OK).send({ success: true });
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// update account
app.post('/account/:id', function (req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    logger.info("attempt to update subscription plan of account %s", req.params.id);
    User.findOne ( { email: req.params.id }, (err, user) => {

        if (err) {
            logger.error("update of subscription plan of account %s failed: user doesn't exist", req.params.id);
            res.status(rc.Client.NOT_FOUND).send(err);
        } else {

            user.plan = parseInt ( req.body.plan );
            user.save((err, user) => {
                if (err) {
                    logger.error("update of subscription plan of account %s failed: %s", req.params.id, JSON.stringify(err));
                    res.status(rc.Server.INTERNAL_ERROR).send(err);
                } else {
                    logger.info("update of subscription plan of account %s succeeded", req.params.id);
                    res.status(rc.Success.OK).send(user);
                }
            });
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// delete account
app.delete('/account/:id', async function (req,res) {

    if (!checkAuthenticaton(req, res)) { return; }

    var customerID = null;

    logger.info("attempt to delete account %s", req.params.id);

    // find customer
    try {
        var customers = await stripe.customers.list({ email: req.params.id });
        if (customers && customers.data.length) {
            customerID = customers.data[0].id;
        }
    } catch (err) {
        logger.error("attempt to delete account %s failed: %s", req.params.id, JSON.stringify(err));
        res.status(rc.Client.REQUEST_FAILED).send(err);
        return;
    }

    // delete customer
    try {
        await stripe.customers.del ( customerID );
        logger.info("deletion of account %s in stripe succeeded", req.params.id);
    } catch (err) {
        logger.error("deletion of account %s in stripe failed: %s", req.params.id, JSON.stringify(err));
        res.status(rc.Client.REQUEST_FAILED).send(err);
        return;
    }

    // delete user
    User.remove ( { email: req.params.id }, (err) => {
        if (err) {
            logger.error("deletion of account %s failed: %s", req.params.id, JSON.stringify(err));
            res.status(rc.Client.NOT_FOUND).send(err);
        } else {
            logger.info("deletion of account %s succeeded", req.params.id);
            res.status(rc.Success.OK).send({ success: true });
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
function checkAuthenticaton (req, res) {

    // parse login and password from headers
    const b64auth = ( req.headers.authorization || '' ).split(' ')[1] || '';
    const [login, password] = new Buffer ( b64auth, 'base64' ).toString().split(':');

    // var token = req.headers['x-access-token'];
    // if  ( ! token ) {
    //     return false;
    // }
    // jwt.verify ( token, config.webtoken.secret, function (err,decoded) {
    //     if ( err ) {
    //         return false;
    //     }
    // });

    if ( ! req.isAuthenticated()) {
        res.status ( rc.Client.UNAUTHORIZED ).send ( "unauthorized request" );
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

function sendConfirmationMail (user,host,ip,callback) {

    mail.sendMail(mail.createConfirmationMail(user.email,
                                              user.username,
                                              user.secretToken,
                                              ip,
                                              host),callback);
}

function sendRecoveryMail(receiver,token,host,ip,callback) {

    mail.sendMail(mail.createRecoveryMail(receiver,
                                          token,
                                          host,
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
