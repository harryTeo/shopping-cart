var passport = require("passport"); // Note that by requiring "passport" here, after defining it to app.js, we are not creating 2 different instances and hence the configuration applies
var User = require("../models/user");
var LocalStrategy = require("passport-local").Strategy; // Note that if e.g. we wanted facebook authentication, we could also use the "passport-facebook" package

passport.serializeUser(function(user, done) { // This will basically tell the "passport" how to store the user in the session
	done(null, user.id);
});

passport.deserializeUser(function(id, done) {
	User.findById(id, function(err, user) {
		done(err, user);
	});
});

passport.use("local.signup", new LocalStrategy({
	usernameField: "email",
	passwordField: "password",
	passReqToCallback: true
}, function(req, email, password, done) {
	req.checkBody("email", "Invalid email").notEmpty().isEmail(); // We get this functionality from the "express-validator" package
	req.checkBody("password", "Invalid password").notEmpty().isLength({min:4}); // We get this functionality from the "express-validator" package
	var errors = req.validationErrors(); // We get this functionality from the "express-validator" package
	if (errors) {
		var messages = [];
		errors.forEach(function(error) {
			messages.push(error.msg);
		});
		return done(null, false, req.flash("error", messages));
	}
	User.findOne({"email": email}, function(err, user) {
		if(err) {
			return done(err);
		}
		if(user) {
			return done(null, false, {message: "Email is already in use."}); // By using the "false" argument, we are saying although no error occured we are not succesful since the email already exists
		}
		var newUser = new User();
		newUser.email = email;
		newUser.password = newUser.encryptPassword(password); // Note: the "encryptPassword" method was implemented in "user.js"
		newUser.save(function(err, result) {
			if(err) {
				return done(err);
			}
			return done(null, newUser);
		});
	});
}));

passport.use("local.signin", new LocalStrategy({
	usernameField: "email",
	passwordField: "password",
	passReqToCallback: true	
}, function(req, email, password, done) {
	req.checkBody("email", "Invalid email").notEmpty().isEmail(); // We get this functionality from the "express-validator" package
	req.checkBody("password", "Invalid password").notEmpty(); // We get this functionality from the "express-validator" package
	var errors = req.validationErrors(); // We get this functionality from the "express-validator" package
	if (errors) {
		var messages = [];
		errors.forEach(function(error) {
			messages.push(error.msg);
		});
		return done(null, false, req.flash("error", messages));
	}	
	User.findOne({"email": email}, function(err, user) {
		if(err) {
			return done(err);
		}
		if(!user) {
			return done(null, false, {message: "No user found."}); // By using the "false" argument, we are saying although no error occured we are not succesful since the email already exists
		}
		if(!user.validPassword(password)) { // The "validPassword" function was defined in "user.js"
			return done(null, false, {message: "Wrong password."});
		}
		return done(null, user);
	});	
}));