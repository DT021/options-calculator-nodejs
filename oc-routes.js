
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var Strategy = require('./Strategy.model');
var User = require('./User.model');

// var router = express.Router();
// var app = express();

app.use ( passport.initialize() );
app.use ( passport.session() );

// connect mongodb
mongoose.Promise = global.Promise;
mongoose.connect ( 'mongodb://localhost/oc', {

    useMongoClient: true,
});

//Bind connection to error event (to get notification of connection errors)
mongoose.connection.on ( 'error', console.error.bind(console, 'MongoDB connection error:') );


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


///////////////////////////////////////////////////////////////////////////////
// check authentification
app.post ( '/Xlogin', passport.authenticate('local', { successRedirect: '/',
                                                      failureRedirect: '/login',
                                                      failureFlash: true })
);

// route to test if the user is logged in or not
app.get ( '/loggedin', function(req, res) {
    res.json ( req.isAuthenticated() ? req.user : '0' );
});

// route to log in
app.post ( '/login', passport.authenticate('local'), function(req, res) {
    res.status ( 200 ).json ( req.user );
});

//
app.post ('/register', function(req,res,next) {

    var newUser = new User ( req.body );
    console.log ( 'data posted: ' + newUser );

    newUser.save(function (err) {
        // err can come from a middleware
        if ( err ) {
            console.log ( 'error saving data: ' + err );
            //next ( err );
            res.status ( 400 ).json ( err );
        } else {
            //res.status ( 200 ).send ( 'OK' );
            res.json ( newUser );
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
