
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var Strategy = require('./Strategy.model');
var User = require('./User.model');

app.use ( passport.initialize() );
app.use ( passport.session() );

// connect mongodb
mongoose.Promise = global.Promise;
mongoose.connect ( 'mongodb://localhost/oc', {

    useMongoClient: true,
});

//Bind connection to error event (to get notification of connection errors)
mongoose.connection.on ( 'error', console.error.bind(console, 'MongoDB connection error:') );

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
}));
  
///////////////////////////////////////////////////////////////////////////////
// route to test if the user is logged in or not
app.get ( '/auth', function(req, res) {
	
	res.json ( req.isAuthenticated() ? req.user : false );
});
    
