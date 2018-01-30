'use strict';

var express = require('express');
var session = require('express-session');
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var fs = require('fs');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var BasicStrategy = require('passport-http').BasicStrategy;
var auth = require('passport-local-authenticate');
var mongoose = require('mongoose');
// var paymill = require('paymill')('apiKey');
var debug = require('debug')('optionscalculator:server');
var http = require('http');
var mailer = require('nodemailer');
var random = require('randomstring');
var compression = require('compression');

// own stuff
var rc = require('./oc-return-codes');
var config = require('./oc-config');
var mail = require('./oc-mail');
var subscriptions = require('./oc-subscriptions');

// get models
var Strategy = require('./Strategy.model');
var User = require('./User.model');

// var log4js = require('log4js');
// init log4js
// log4js.configure ( {
//     appenders: { server: { type: 'file', filename: 'server.log' } },
//     categories: { default: { appenders: ['server'], level: 'all' } }
// });
// var logger = log4js.getLogger ( 'server' );
// logger.debug ( 'started' );

// get access to express
var app = express();

// set view engine to EJS
app.set ( 'view engine', 'ejs' );
app.set ( 'views', config.server.docroot );

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
    console.log ( 'connection established');
    dbConnected = true;
}).catch ( function(err) {
    console.log ( err );
});

//Bind connection to error event (to get notification of connection errors)
// mongoose.connection.on ( 'error', console.error.bind(console, 'MongoDB connection error:') );

// set body parser
app.use ( bodyParser.json() );
app.use ( bodyParser.urlencoded({ extended: true }) );

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream ( path.join(__dirname, 'access.log'), {flags: 'a'} );
accessLogStream.write('__dirname=' + __dirname);
// var serverLogStream = fs.createWriteStream ( path.join(__dirname, 'server.log'), {flags: 'a'} );

// setup the logger
app.use ( morgan('dev',{stream: accessLogStream}) );
// app.use(morgan('common', { skip: function (req, res) { return res.statusCode < 400 }, stream: accessLogStream}));

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
// main page when logged out
app.get ( '/', function(req, res) {

    if ( req.isAuthenticated() ) {

        // this is set when user logged in
        res.render ( 'index', {

            open   : readPartial("login/open.ejs"),
            neww   : readPartial("login/neww.ejs"),
            add    : readPartial("login/add.ejs"),
            reverse: readPartial("login/reverse.ejs"),
            save   : readPartial("login/save.ejs"),
            saveas : readPartial("login/saveas.ejs"),
            remove : readPartial("login/remove.ejs"),
            select : readPartial("login/select.ejs"),
            auth   : readPartial("login/auth.ejs"),
            strikes: readPartial("login/strikes.ejs")
        });

    } else {

        // this is set when user is logged out
        res.render ( 'index', {

            open   : readPartial("logout/open.ejs"),
            neww   : readPartial("logout/neww.ejs"),
            add    : readPartial("logout/add.ejs"),
            reverse: readPartial("logout/reverse.ejs"),
            save   : readPartial("logout/save.ejs"),
            saveas : readPartial("logout/saveas.ejs"),
            remove : readPartial("logout/remove.ejs"),
            select : readPartial("logout/select.ejs"),
            auth   : readPartial("logout/auth.ejs"),
            strikes: readPartial("logout/strikes.ejs")
        });
    }
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// add latency for testing purpose
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// app.use ( '/', function (req, res, next) { setTimeout(next, 1000) });
// app.use('/login', function (req, res, next) { setTimeout(next,500) });
// app.use('/register', function (req, res, next) { setTimeout(next, 500) });
// app.use('/strategies', function (req, res, next) { setTimeout(next, 500) });
// app.use('/strategies/:id', function (req, res, next) { setTimeout(next, 500) });
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////
// route to test if the user is logged in or not
app.get ( '/auth', function(req, res) {

    res.status ( rc.Success.OK ).json ( req.isAuthenticated() ? { 'user': req.user,
                                                                  'plan': subscriptions.plans[req.user.plan]}
                                                              : { 'user': null } );
});

///////////////////////////////////////////////////////////////////////////////
// route to log in
app.post ( '/login', function(req, res, next) {

    if ( dbConnected === false ) {
        // user does not exist
        return res.status ( rc.Server.INTERNAL_ERROR ).send ( {
            success: false,
            message : "failed !",
            error: "no database connection"
        } );
    }

    // var user = req.body;
    // passport.authenticate('local', function(err, user, info) {
    passport.authenticate('basic', function(err, user, info) {

        if ( err ) {
            return next ( err ); // will generate a 500 error
        }

        // Generate a JSON response reflecting authentication status
        if ( ! user ) {

            // user does not exist
            return res.status ( rc.Client.NOT_FOUND ).send ( {
                success : false,
                message : 'login failed !'
            });
        } else if ( user.active === false ) {

            // user is registered but has not yet confirmed his account
            return res.status ( rc.Client.UNAUTHORIZED ).send ( {
                success : false,
                message : 'not yet confirmed !',
                user    : user
            });
        }

        req.login ( user, function(err) {

            if ( err ) {
                return next ( err );
            }
        });

        res.redirect ( '/' );

    })(req, res, next);
});

///////////////////////////////////////////////////////////////////////////////
// route to log out
app.post ( '/logout', function(req, res) {

    req.logOut();
    res.redirect ( '/' );
});

///////////////////////////////////////////////////////////////////////////////
// add a user to the database and send an confirmation mail
app.post ('/register', function(req,res,next) {

    if ( dbConnected === false ) {
        // user does not exist
        return res.status ( rc.Server.INTERNAL_ERROR ).send ({
            success: false,
            message: "failed !",
            error: "no database connection"
        });
    }

    var newUser = new User ( req.body );

    // TODO: test purpose only !!!!!
    if (  newUser && newUser.username === "xoxman123" ) {
        console.error ( "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" );
        console.error ( "!! WARNING -- TEST USER xoxman123 USED !!!!!!" );
        console.error ( "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" );
        setTimeout ( function() {
            res.status(rc.Success.CREATED).send ( { user: newUser, plan : subscriptions.plans[newUser.plan] } );
        }, 1000 );
        return;
    }

    newUser.secretToken = random.generate();
    newUser.active = false;
    newUser.save(function (err) {
        if ( err ) {
            res.status( rc.Server.INTERNAL_ERROR ).json ( err );
        } else {
            sendConfirmationMail( newUser, res );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// confirm an account via email address
app.get ( '/confirm/:token', function (req, res, next) {

    User.findOne ( { secretToken: req.params.token }, (err, user) => {

        if (err) {
            res.status ( rc.Server.INTERNAL_ERROR ).send(err);
        } else if ( user ) {

            user.active = true;
            user.secretToken = '';

            user.save((err, user) => {
                if (err) {
                    res.status ( rc.Server.INTERNAL_ERROR ).send(err);
                } else {
                    res.status ( rc.Success.OK ).send ( 'Thank you, your account is confirmed and you can now login.' );
                }
            });
        } else {
            res.status (rc.Client.NOT_FOUND ).send ( 'This token does\'t exist or the associated account is already confirmed.' );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// re-send confirmation mail
app.post ( '/resend/:userid', function (req, res, next) {

    User.findOne({ email: req.params.userid }, (err, user) => {

        if (err) {
            res.status ( rc.Server.INTERNAL_ERROR ).send(err);
        } else if (user) {
            sendConfirmationMail(user, res);
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all users
app.get ('/users', function(req,res) {

    if ( ! req.isAuthenticated() ) {
        res.status ( rc.Client.UNAUTHORIZED ).send ( "unauthorized request" );
        return;
    }
    User.find().then ( function(users) {
        res.status ( rc.Success.OK ).json ( users );
    }).catch ( function(err) {
        res.status ( rc.Server.INTERNAL_ERROR ).json ( err );
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all data
app.get ('/strategies', function(req,res) {

    if ( ! req.isAuthenticated() ) {
        res.status ( rc.Client.UNAUTHORIZED ).send ( "unauthorized request" );
        return;
    }
    Strategy.find().sort('name').exec(function (err, strategy) {
        if (err) {
            res.status ( rc.Server.INTERNAL_ERROR ).json(err);
        } else {
            res.status ( rc.Success.OK ).json(strategy);
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all data associated to one user
app.get ('/strategies/:id', function(req,res) {

    if (!req.isAuthenticated()) {
        res.status(rc.Client.UNAUTHORIZED).send("unauthorized request");
        return;
    }
    Strategy.find ( { userid: req.params.id }).sort('name').exec( function(err,strategy) {
        if ( err ) {
            res.status ( rc.Server.INTERNAL_ERROR ).json(err);
        } else {
            res.status ( rc.Success.OK ).json(strategy);
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// save as (new)
app.post ('/strategies', function(req,res,next) {

    var newStrategy = new Strategy ( req.body );
    newStrategy.save(function (err) {
        if (err) {
            res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
        } else {
            res.status ( rc.Success.OK ).json ( newStrategy );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// save (update))
app.post ( '/strategies/:name', function (req,res,next) {

    Strategy.findOne ( { name : req.params.name}, (err,strategy) => {

        if ( err ) {
            res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
        } else {

            strategy.expiry = req.body.expiry;
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
// delete strategy
app.delete('/strategies/:name', function (req, res, next) {

    if (!req.isAuthenticated()) {
        res.status(rc.Client.UNAUTHORIZED).send("unauthorized request");
        return;
    }
    Strategy.findOne({ name: req.params.name }, (err, strategy) => {

        if (err) {
            res.status(rc.Server.INTERNAL_ERROR).send(err);
        } else {

            strategy.remove((err, strategy) => {
                if (err) {
                    res.status ( rc.Server.INTERNAL_ERROR ).send ( err );
                } else {
                    res.status ( rc.Success.OK ).send ( strategy );
                }
            });
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// delete user
var deleteUser = function (req, res, next) {

    if (!req.isAuthenticated()) {
        res.status(rc.Client.UNAUTHORIZED).send("unauthorized request");
        return;
    }
    User.findOne({ email: req.params.email }, (err, user) => {

        if (err) {
            res.status(rc.Server.INTERNAL_ERROR).send(err);
        } else {

            user.remove((err, user) => {
                if (err) {
                    res.status(rc.Server.INTERNAL_ERROR).send(err);
                } else {
                    res.status(rc.Success.OK).send(user);
                }
            });
        }
    });
};
app.delete('/users/:name', deleteUser );

///////////////////////////////////////////////////////////////////////////////
// simple route loging - prints all defined routes
require ( 'express-route-log' )(app);

///////////////////////////////////////////////////////////////////////////////
// set static page route
app.use ( express.static(path.join(__dirname,config.server.docroot)) );

// catch 404 and forward to error handler
app.use ( function(req, res, next) {
    var err = new Error('Not Found');
    err.status = rc.Client.NOT_FOUND;
    next ( err );
});

// error handler
app.use ( function(err, req, res, next) {

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status ( err.statusCode || rc.Server.INTERNAL_ERROR ).json ( err );
});

///////////////////////////////////////////////////////////////////////////////
// setup server
// var port = normalizePort ( process.env.PORT || config.server.port );
var port = config.server.port;
app.set ( 'port', port );
var server = http.createServer ( app );
server.listen ( port );

///////////////////////////////////////////////////////////////////////////////
// Event listener for HTTP server "error" event.
server.on ( 'error', function(error) {
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
server.on ( 'listening', function() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    console.log ('listening on ' + bind );
});

///////////////////////////////////////////////////////////////////////////////
// local functions
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

function sendConfirmationMail (user, res) {

    mail.sendMail(mail.createMail(user.email,
        user.username,
        user.secretToken)).then(function (users) {
            res.status(rc.Success.CREATED).send({
                user: user,
                plan: subscriptions.plans[user.plan]
            });
        }).catch(function (err) {
            res.status(rc.Server.INTERNAL_ERROR).send(err.response);
        });;
}

var sleep = function (what, time) {
    setTimeout(function () {
        what();
    }, 4000);
};

function readPartial(file) {

    return fs.readFileSync(__dirname + "/partials/" + file, 'utf8');
}

module.exports = app;
