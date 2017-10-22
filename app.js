
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
var auth = require('passport-local-authenticate');
var mongoose = require('mongoose');

// get models
var Strategy = require('./Strategy.model');
var User = require('./User.model');

// get access to express
var app = express();

// set view engine to EJS
app.set ( 'view engine', 'ejs' );

// set constants used by session
const cookieSecret = 'asdf33g4w4hghjkuil8saef345';
const cookieExpirationDate = new Date();
const cookieExpirationDays = 365;
cookieExpirationDate.setDate ( cookieExpirationDate.getDate() + cookieExpirationDays );

// set cookie parser middleware
app.use ( cookieParser(cookieSecret) ); 
app.use ( session({

	secret: cookieSecret, 
	resave: true,
	saveUninitialized: true,
	cookie: {
	    httpOnly: true,
	    expires: cookieExpirationDate // use expires instead of maxAge
        // store: new MongoStore( { url: config.urlMongo, collection: 'sessions' } )
	}
 }));

 // iset nitialized passport
app.use ( passport.initialize() );
app.use ( passport.session() );

// connect database
mongoose.Promise = global.Promise;
mongoose.connect ( 'mongodb://localhost/oc', {

    useMongoClient: true,
});

//Bind connection to error event (to get notification of connection errors)
mongoose.connection.on ( 'error', console.error.bind(console, 'MongoDB connection error:') );

// set body parser
app.use ( bodyParser.json() );
app.use ( bodyParser.urlencoded({ extended: true }) );

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream ( path.join(__dirname, 'access.log'), {flags: 'a'} )

// setup the logger
app.use ( morgan ( 'dev', {stream: accessLogStream}) );

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
passport.use ( new LocalStrategy ( {usernameField: 'email'}, function(email, password, done) {

    User.findOne ( { email: email }, function(err, user) {
        if ( err ) { 
            return done(err); 
        }
        if ( ! user ) {
            return done(null, false, { message: 'email address does not exist' });
        }
        if ( ! user.validPassword(password)) {
            return done ( null, false, { message: 'incorrect password' });
        }
        return done ( null, user );
    });
  }
));

///////////////////////////////////////////////////////////////////////////////
// main page when logged out
app.get ( '/', function(req, res) {

    if ( req.isAuthenticated() ) {

        res.render ( 'index', {
        
            addnew : '<button class="btn btn-sm" ng-disabled="general.logged || ! (positions.length < 4)" ng-click="doAdd(1,11500,\'call\')">add new</button>',
            save : '<button class="btn btn-sm" ng-disabled="general.logged || status.saving" ng-click="doSave()">save</button>', 
            auth : '<button class="btn btn-sm pull-right oc-login" ng-click="doLogout()">log out</button>' +
                   '<span class="oc-welcome pull-right">welcome, you\'re logged in</span>'
        });
    } else {

        res.render ( 'index', {
        
            addnew : '', 
            save : '', 
            auth : '<button class="btn btn-sm pull-right oc-login" ng-disabled="general.logged||general.register" ng-click="general.register=true">sign up</button>' +
                    '<button class="btn btn-sm pull-right oc-login" ng-disabled="general.logged||account.password==0||account.email==0" ng-click="doLogin()">log in</button>' +
                    '</span><input tabindex=2 class="oc-login-input pull-right" ng-enter="doLogin()" ng-disabled="general.logged||general.register" type="password" placeholder="password" ng-model="account.password"' +
                            'ng-focus="account.error.login=0"/>' +
                    '<input tabindex=1 class="oc-login-input pull-right" ng-disabled="general.logged||general.register" type="text" placeholder="email/name" ng-model="account.email"' +
                            'ng-focus="account.error.login=0" >' +
                    '</input><span class="oc-login-error pull-right" ng-show="account.error.login"><i class="oc-login-error-icon fa fa-warning"></i>{{ account.error.login }}</span>' 
        });
    }
});
    
///////////////////////////////////////////////////////////////////////////////
// route to test if the user is logged in or not
app.get ( '/auth', function(req, res) {

    res.json ( req.isAuthenticated() ? req.user : false );
});

///////////////////////////////////////////////////////////////////////////////
// route to log in
app.post ( '/login', function(req, res, next) {

    // var user = req.body;
    passport.authenticate('local', function(err, user, info) {

        if ( err ) {
            return next ( err ); // will generate a 500 error
        }

        // Generate a JSON response reflecting authentication status
        if ( ! user ) {
            return res.status(401).send ( { success : false, message : 'authentication failed' } );
        }

        req.login ( user, function(err) {

            if ( err ) {
                return next ( err );
            }
            res.redirect ( '/' );
        });
    })(req, res, next);
});

///////////////////////////////////////////////////////////////////////////////
// route to log out
app.post ( '/logout', function(req, res) {
    
    req.logOut();
    res.redirect ( '/' );  
});

///////////////////////////////////////////////////////////////////////////////
//
app.post ('/register', function(req,res,next) {

    var newUser = new User ( req.body );
    newUser.save(function (err) {
        if ( err ) {
            res.status( 404 ).json ( err );
        } else {
            res.status ( 201 ).json ( newUser );
        }    
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all users 
app.get ('/users', function(req,res) {

    User.find().then ( function(users) {
        res.status( 200 ).json ( users );
    }).catch ( function(err) {
        res.status ( 404 ).json ( err );
    });
});

///////////////////////////////////////////////////////////////////////////////
// return all data 
app.get ('/strategies', function(req,res) {

    Strategy.find().then ( function(strategies) {
        res.status( 200 ).json ( strategies );
    }).catch ( function(err) {
        res.status ( 404 ).json ( err );
    });
});

///////////////////////////////////////////////////////////////////////////////
// return single data
app.get ('/strategies/:name', function(req,res) {

    Strategy.find ( { name: req.params.name }).then ( function(strategy) {
        res.status( 200 ).json ( strategy );
    }).catch ( function(err) {
        res.status ( 404 ).json ( err );
    });
});

///////////////////////////////////////////////////////////////////////////////
// save data 
app.post ('/strategies', function(req,res,next) {

    var newStrategy = new Strategy ( req.body[0] );
    newStrategy.save(function (err) {
        if ( err ) {
            res.status ( 409 ).json ( err );
        } else {
            res.status ( 200 ).json ( newStrategy );
        }    
    });
});

///////////////////////////////////////////////////////////////////////////////
// set static page route
app.use ( express.static(path.join(__dirname, 'public')) );

// catch 404 and forward to error handler
app.use ( function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next ( err );
});

// error handler
app.use ( function(err, req, res, next) {

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.statusCode || 500).json ( err );
});

module.exports = app;
