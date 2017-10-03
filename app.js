
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var fs = require('fs');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var auth = require('passport-local-authenticate');
var mongoose = require('mongoose');
var Strategy = require('./Strategy.model');
var User = require('./User.model');

var app = express();

app.set ( 'view engine', 'jade' );

app.use ( passport.initialize() );
app.use ( passport.session() );

// connect mongodb
mongoose.Promise = global.Promise;
mongoose.connect ( 'mongodb://localhost/oc', {

    useMongoClient: true,
});

//Bind connection to error event (to get notification of connection errors)
mongoose.connection.on ( 'error', console.error.bind(console, 'MongoDB connection error:') );

app.use ( bodyParser.json() );
app.use ( bodyParser.urlencoded({ extended: true }) );

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream ( path.join(__dirname, 'access.log'), {flags: 'a'} )

// setup the logger
app.use ( morgan ( 'dev', {stream: accessLogStream}) );


//
//
//
passport.serializeUser(function(user, done) {
  done ( null, user.id );
});

//
//
//
passport.deserializeUser(function(id, done) {

    User.findById ( id, function(err,user) {
        done ( err, user );
    });  
});

//
//
//
passport.use ( new LocalStrategy ( function(username, password, done) {

    User.findOne ( { username: username }, function(err, user) {
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
// route to test if the user is logged in or not
app.get ( '/loggedin', function(req, res) {
    res.json ( req.isAuthenticated() ? req.user : '0' );
});

///////////////////////////////////////////////////////////////////////////////
// route to log in
// app.post ( '/login', function(req,res,next) {
//     passport.authenticate('local'), function(rerr, user, info) {
//         res.status ( 200 ).json ( 'OK' );
//     }
// });

app.post('/login', function(req, res, next) {

    passport.authenticate('local', function(err, user, info) {

        if ( err ) {
            return next ( err ); // will generate a 500 error
        }

        // Generate a JSON response reflecting authentication status
        if ( ! user ) {
            return res.send ( 401, { success : false, message : 'authentication failed' } );
        }

        req.login ( user, function(err) {

            if ( err ) {
                return next ( err );
            }
            return res.send ( { success : true, message : 'authentication succeeded' } );        
        });
    })(req, res, next);
});

///////////////////////////////////////////////////////////////////////////////
//
app.post ('/register', function(req,res,next) {

    var newUser = new User ( req.body );
    console.log ( 'data posted: ' + newUser );

    newUser.save(function (err) {
        if ( err ) {
            console.log ( 'error saving data: ' + err );
            res.status( 404 ).json ( err );
        } else {
            res.status ( 201 ).json ( newUser );
        }    
    });
});

///////////////////////////////////////////////////////////////////////////////
// route to log out
app.post ( '/logout', function(req, res) {
    req.logOut();
    res.status ( 200 ).send ( 'OK' );;
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

    //console.dir ( req.body[0], {depth:null, colors:true} )

    var newStrategy = new Strategy ( req.body[0] );
    console.log ( 'data posted: ' + newStrategy );

    newStrategy.save(function (err) {
        // err can come from a middleware
        if ( err ) {
            console.log ( 'error saving data: ' + err );
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
