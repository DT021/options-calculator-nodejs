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
var paymill = require('paymill')('apiKey');
var debug = require('debug')('optionscalculator:server');
var http = require('http');
var mailer = require('nodemailer');
var random = require('randomstring');
var compression = require('compression');

// own stuff
var rc = require('./oc-return-codes');
var config = require('./oc-config');
var mail = require('./oc-mail');

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

        // this is set when user logged in successfully
        res.render ( 'index', {

            open   : '<button Xtooltips tooltip-template="{{tooltip.open}}" class="btn btn-sm oc-buy" ng-disabled="strategies.length<1 || positions.length<1" ng-hide="general.logged" ng-click="doBuy()">open positions</button>' +
                     '<button Xtooltips tooltip-template="{{tooltip.close}}" class="btn btn-sm oc-sell" ng-disabled="strategies.length<1" ng-show="general.logged" ng-click="doSell()">close positions</button>',
            neww   : '<button class="btn btn-sm oc-wide-button" ng-disabled="general.logged" ng-click="doNew()">new strategy</button>',
            add    : '<button Xtooltips tooltip-template="{{tooltip.add}}" class="btn btn-sm oc-wide-button" ng-disabled="general.logged || !status.strikes || ! (positions.length<4)" ng-click="doOpenAddDialog()">add position</button>',
            reverse: '<button Xtooltips tooltip-template="{{tooltip.reverse}}" class="btn btn-sm" ng-disabled="general.logged || positions.length<1" ng-click="doReverse()">reverse</button>',
            save   : '<button Xtooltips tooltip-template="{{tooltip.save}}" class="btn btn-sm" ng-disabled="general.logged || ! strategy.changed" ng-click="doSave()">save</button>',
            saveas : '<button Xtooltips tooltip-template="{{tooltip.saveAs}}" class="btn btn-sm" ng-disabled="general.logged || positions.length<1" ng-click="doOpenSaveAsDialog()">save as</button>',
            remove : '<button Xtooltips tooltip-template="{{tooltip.remove}}" class="btn btn-sm" ng-disabled="general.logged || ! strategy.name" ng-click="doOpenDeleteDialog()">delete</button>',
            select : '<span ng-class="{ \'oc-select-wrapper\': ! general.logged }" ng-disabled="general.logged">' +
                     '<select class="oc-dropdown oc-strat-dropdown" ng-options="strat.name group by strat.optionDescription.symbol for strat in strategies track by strat.name"' +
                     'ng-disabled="general.logged" ng-change="doUpdatePositions()" ng-model="strategy"></select></span>',
            auth   : '<button class="btn btn-sm pull-right oc-logout" ng-click="doLogout()">log out</button>' +
                     '<span class="oc-welcome pull-right">welcome <b>' + req.user.username + '</b>, you\'re logged in</span>',
            strikes: '<label for="strike-selection" class="btn btn-sm" ng-disabled="general.logged||status.strikes" Xtooltips tooltip-template="{{ tooltip.selectedStrikes }}">select</label>' +
                     '<input type="file" class="btn" id="strike-selection" accept=".json" ng-file-select="onFileSelect($files)"></input>'
        });

    } else {

        // this is set when user is not logged in
        res.render ( 'index', {

            open   : '<button Xtooltips tooltip-template="{{tooltip.open}}" class="btn btn-sm oc-buy" ng-disabled="general.logged" ng-click="doRegisterFirst()">open positions</button>',
            neww   : '<button class="btn btn-sm oc-wide-button" ng-disabled="general.logged" ng-click="doRegisterFirst()">new strategy</button>',
            add    : '<button Xtooltips tooltip-template="{{tooltip.add}}" class="btn btn-sm oc-wide-button" ng-disabled="general.logged || ! (positions.length < 4)" ng-click="doRegisterFirst()">add position</button>',
            reverse: '<button Xtooltips tooltip-template="{{tooltip.reverse}}" class="btn btn-sm" ng-disabled="general.logged || positions.length<1" ng-click="doReverse()">reverse</button>',
            save   : '<button Xtooltips tooltip-template="{{tooltip.save}}" class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">save</button>',
            saveas : '<button Xtooltips tooltip-template="{{tooltip.saveAs}}" class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">save as</button>',
            remove : '<button Xtooltips tooltip-template="{{tooltip.remove}}" class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">delete</button>',
            select : '<span style="margin-right:10px;letter-spacing:1px;vertical-align:middle;">{{ strategy.name }}</span>',
            auth   : '<button class="btn btn-sm pull-right oc-register" ng-disabled="general.logged||general.register" ng-click="doRegisterFirst()">sign up</button>' +
                     '<button class="btn btn-sm pull-right oc-login" ng-disabled="general.logged" ng-click="doLogin()">sign in</button>' +
                     '<input tabindex=2 class="oc-login-input pull-right" ng-enter="doLogin()" ng-disabled="general.logged" name="password" type="password" placeholder="password" ng-model="account.password"' +
                            'ng-focus="account.error.login=0"/>' +
                     '<input tabindex=1 select-on-focus class="oc-login-input pull-right" ng-enter="doLogin()" ng-disabled="general.logged" type="text" name="username" placeholder="email" ng-model="account.email"' +
                            'ng-focus="account.error.login=0"/>' +
                     '<span class="oc-login-error select-on-focus pull-right" ng-show="account.error.login">' +
                     '<i class="oc-login-error-icon fa fa-warning"></i>{{ account.error.login }}<button ng-click="account.error.login=false" class="oc-login-error-close">X</button></span>',
            strikes: '<button Xtooltips tooltip-template="{{tooltip.selectedStrikes}}" class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">select</button>'
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

//
var sleep = function(what, time) {
    setTimeout ( function () {
        what();
    }, 4000 );
};

///////////////////////////////////////////////////////////////////////////////
// route to test if the user is logged in or not
app.get ( '/auth', function(req, res) {

    res.status ( rc.Success.OK ).json ( req.isAuthenticated() ? { 'user': req.user } : { 'user': null } );
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
    newUser.secretToken = random.generate();
    newUser.active = false;
    newUser.save(function (err) {
        if ( err ) {
            res.status( rc.Server.INTERNAL_ERROR ).json ( err );
        } else {
            mail.sendMail ( mail.createMail(newUser.email,
                                            newUser.username,
                                            newUser.secretToken) );
            res.status ( rc.Success.CREATED ).json ( newUser );
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
            mail.sendMail(mail.createMail(user.email,
                                          user.username,
                                          user.secretToken));
            res.status ( rc.Success.OK ).send ( 'OK' );
        } else {
            res.status ( rc.Client.NOT_FOUND ).send ( user.email );
        }
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all users
app.get ('/users', function(req,res) {

    User.find().then ( function(users) {
        res.status ( rc.Success.OK ).json ( users );
    }).catch ( function(err) {
        res.status ( rc.Server.INTERNAL_ERROR ).json ( err );
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all data
app.get ('/strategies', function(req,res) {

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
// delete
app.delete('/strategies/:name', function (req, res, next) {

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
//
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

module.exports = app;
