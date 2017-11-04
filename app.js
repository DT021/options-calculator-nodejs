
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

		// this is set when user logged in successfully
		res.render ( 'index', {
		
			addnew : '<button class="btn btn-sm" ng-disabled="general.logged || ! (positions.length < 4)" ng-click="doAdd(1,11500,\'call\')">add new</button>',
			save   : '<button class="btn btn-sm" ng-disabled="general.logged || ! strategy.changed" ng-click="doSave()">save</button>', 
			saveas : '<button class="btn btn-sm" ng-disabled="general.logged" ng-click="doOpenDialog()">save as</button>', 
			remove : '<button class="btn btn-sm" ng-disabled="general.logged" ng-click="doDeleteStrategy()">delete</button>', 
			select : '<select class="oc-dropdown oc-strat-dropdown" ng-options="strat as strat.name for strat in strategies"' +
					 'ng-disabled="general.logged" ng-change="doUpdate()" ng-model="strategy"></select>',
			load   : '<button class="btn btn-sm" ng-disabled="general.logged" ng-click="doLoad()">load</button>', 
			auth   : '<button class="btn btn-sm pull-right oc-login" ng-click="doLogout()">log out</button>' +
					 '<span class="oc-welcome pull-right">welcome <b>' + req.user.username + '</b>, you\'re logged in</span>'
		});

	} else {

		// this is set when user is not logged in
		res.render ( 'index', {
		
			addnew : '<button class="btn btn-sm" ng-disabled="general.logged || ! (positions.length < 4)" ng-click="doRegisterFirst()">add new</button>',
			save   : '<button class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">save</button>', 
			saveas : '<button class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">save as</button>', 
			remove : '<button class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">delete</button>', 
			select : '<span style="margin-left:10px; font-size:130%;vertical-align:middle;">{{ strategy.name }}</span>',
			load   : '<button class="btn btn-sm" ng-disabled="general.logged" ng-click="doRegisterFirst()">load</button>', 
			auth   : '<button class="btn btn-sm pull-right oc-register" ng-disabled="general.logged||general.register" ng-click="doRegisterFirst()">sign up</button>' +
					 '<button class="btn btn-sm pull-right oc-login" ng-disabled="general.logged" ng-click="doLogin()">log in</button>' +
					 '</span><input tabindex=2 class="oc-login-input pull-right" ng-enter="doLogin()" ng-disabled="general.logged||general.register" type="password" placeholder="password" ng-model="account.password"' +
							'ng-focus="account.error.login=0"/>' +
					 '<input tabindex=1 class="oc-login-input pull-right" ng-disabled="general.logged||general.register" type="text" placeholder="email/name" ng-model="account.email"' +
							'ng-focus="account.error.login=0" >' +
					 '</input><span class="oc-login-error pull-right" ng-show="account.error.login"><i class="oc-login-error-icon fa fa-warning"></i>{{ account.error.login }}</span>' 
		});
	}
});
	
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// add latency for testing purpose
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.use ( '/strategies/:id', function (req, res, next) { setTimeout(next,1000) });
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// 
var sleep = function(what, time) {
	setTimeout ( function () {
		what();
	}, 4000 );
}
///////////////////////////////////////////////////////////////////////////////
// route to test if the user is logged in or not
app.get ( '/auth', function(req, res) {

	// console.log('authenticated:' + (req.isAuthenticated() ? req.user.email : 'false') );
	res.status ( 200 ).json ( req.isAuthenticated() ? { 'user': req.user } : { 'user': null } );
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
			// return res.status(401).send ( { success : false, message : 'authentication failed' } );
			return res.status(401).send ( { success : false, message : info.message } );
		}

		req.login ( user, function(err) {

			if ( err ) {
				return next ( err );
			}
			// res.redirect ( '/' );
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
//
app.post ('/register', function(req,res,next) {

	var newUser = new User ( req.body );
	newUser.save(function (err) {
		if ( err ) {
			res.status( 500 ).json ( err );
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
		res.status ( 500 ).json ( err );
	});
});

///////////////////////////////////////////////////////////////////////////////
// return all data 
app.get ('/strategies', function(req,res) {

	Strategy.find().sort('name').exec(function (err, strategy) {
		if (err) {
			res.status(500).json(err);
		} else {
			res.status(200).json(strategy);
		}
	});
});

///////////////////////////////////////////////////////////////////////////////
// return all data associated to one user
app.get ('/strategies/:id', function(req,res) {

	Strategy.find ( { userid: req.params.id }).sort('name').exec( function(err,strategy) {
		if ( err ) {
			res.status(500).json(err);
		} else {
			res.status(200).json(strategy);
		}
	});
});

///////////////////////////////////////////////////////////////////////////////
// save as (new) 
app.post ('/strategies', function(req,res,next) {

	var newStrategy = new Strategy ( req.body );
	newStrategy.save(function (err) {
		if (err) {
			res.status ( 500 ).json ( err );
		} else {
			res.status ( 200 ).json ( newStrategy );
		}
	});
});

///////////////////////////////////////////////////////////////////////////////
// save (update)) 
app.delete ( '/strategies/:name', function (req, res, next) {

	Strategy.findOne ( { name: req.params.name }, (err, strategy) => {

		if (err) {
			res.status(500).send(err);
		} else {

			strategy.remove((err, strategy) => {
				if (err) {
					res.status(500).send(err);
				} else {
					res.status(200).send(strategy);
				}
			});
		}
	});
});

///////////////////////////////////////////////////////////////////////////////
// save (update)) 
app.post ( '/strategies/:name', function (req,res,next) {
	
	Strategy.findOne ( { name : req.params.name}, (err,strategy) => {
		
		if ( err ) {
			res.status ( 500 ).send ( err );
		} else {

			strategy.symbol = req.body.symbol;
			strategy.expiry = req.body.expiry;
			for (var i = 0; i < req.body.positions.length; i++) {
				strategy.positions[i] = {
					amt: req.body.positions[i].amt,
					type: req.body.positions[i].type,
					strike: req.body.positions[i].strike
				}
			}

			strategy.save((err,strategy) => {
				if ( err ) {
					res.status ( 500 ).send ( err );
				} else {
					res.status ( 200 ).send ( strategy );
				}
			});
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
