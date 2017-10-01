
var express = require('express');
var path = require('path');
//var favicon = require('serve-favicon');
var morgan = require('morgan');
var fs = require('fs');
var validator = require("email-validator");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var Strategy = require('./Strategy.model');
var User = require('./User.model');

var app = express();
var db = 'mongodb://localhost/oc';

app.set ( 'view engine', 'jade' );

app.use ( passport.initialize() );
app.use ( passport.session() );

// connect mongodb
mongoose.Promise = global.Promise;
mongoose.connect ( db, {

    useMongoClient: true,
});

//Bind connection to error event (to get notification of connection errors)
mongoose.connection.on ( 'error', console.error.bind(console, 'MongoDB connection error:') );

app.use ( bodyParser.json() );
app.use ( bodyParser.urlencoded({ extended: true }) );


passport.use ( new LocalStrategy ( function(username, password, done) {

    User.findOne ( { username: username }, function(err, user) {
        if ( err ) { 
            return done(err); 
        }
        if ( ! user ) {
            return done(null, false, { message: 'Incorrect username.' });
        }
        if ( ! user.validPassword(password)) {
        // if ( ! user.password == password ) {
            return done ( null, false, { message: 'Incorrect password.' });
        }
        return done ( null, user );
    });
  }
));

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream ( path.join(__dirname, 'access.log'), {flags: 'a'} )

// setup the logger
app.use ( morgan ( 'dev', {stream: accessLogStream}) );

///////////////////////////////////////////////////////////////////////////////
// check authentification
app.post ( '/Xlogin', passport.authenticate('local', { successRedirect: '/',
                                                      failureRedirect: '/login',
                                                      failureFlash: true })
);

// route to test if the user is logged in or not
app.get ( '/loggedin', function(req, res) {
    res.send ( req.isAuthenticated() ? req.user : '0' );
});

// route to log in
app.post ( '/login', passport.authenticate('local'), function(req, res) {
    res.status ( 200 ).send ( req.user );
});

//
app.post ('/register', function(req,res,next) {

    var newUser = new User ( req.body );
    console.log ( 'data posted: ' + newUser );

    newUser.save(function (err) {
        // err can come from a middleware
        if ( err ) {
            console.log ( 'error saving data: ' + err );
            next ( err );
        } else {
            res.status ( 200 ).send ( 'OK' );
        }    
    });
});

// route to log out
app.post ( '/logout', function(req, res) {
    req.logOut();
    res.send ( 200 ).send ( 'OK' );;
});

///////////////////////////////////////////////////////////////////////////////
// return all data 
app.get ('/strategies', function(req,res) {

    console.log ( 'data requested...' );
    Strategy.find().then ( function(strategies) {
        res.json ( strategies );
    }).catch ( function(err) {
        res.status ( 500 ).send ( err );
    });
});

///////////////////////////////////////////////////////////////////////////////
// return single data
app.get ('/strategies/:name', function(req,res) {

    console.log ( 'single data requested ' + req.params.name );
    Strategy.find ( { name: req.params.name }).then ( function(strategy) {
        res.json ( strategy );
    }).catch ( function(err) {
        res.status ( 500 ).send ( err );
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
            res.status ( 500 ).send ( err );
        } else {
            res.status ( 200 ).send ( 'OK' );
        }    
    });
});

///////////////////////////////////////////////////////////////////////////////
// set middleware layers
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//app.use ( logger('dev') );
//app.use ( cookieParser() );
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

    // render the error page
    // res.status(err.status || 500);
    // res.render('error');

    res.status(err.statusCode || 500).json(err);
});

module.exports = app;
