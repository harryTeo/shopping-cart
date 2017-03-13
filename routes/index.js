var express = require('express');
var router = express.Router();
var csrf = require("csurf");
var passport = require("passport");

var Cart = require("../models/cart");
var Product = require("../models/product");
var Order = require("../models/order");

/* GET home page. */
router.get('/', function(req, res, next) {
	var successMsg = req.flash("success")[0];
	Product.find({}, function(err, docs){
		res.render('index', { title: 'Shopping Cart', products: docs, successMsg: successMsg, noMsg: !successMsg });
	});
});

router.get("/add-to-cart/:id", function(req, res, next) {
	var productId = req.params.id;
	var cart = new Cart(req.session.cart ? req.session.cart : {});
	Product.findById(productId, function(err, product) {
		if (err) {
			return res.redirect("/");
		}
		cart.add(product, product.id);
		req.session.cart = cart;
		res.redirect("/");
	});
});

router.get("/reduce/:id", function(req, res, next) {
	var productId = req.params.id;
	var cart = new Cart(req.session.cart ? req.session.cart : {});

	cart.reduceByOne(productId);
	req.session.cart = cart;
	res.redirect("/shopping-cart");
});

router.get("/remove/:id", function(req, res, next) {
	var productId = req.params.id;
	var cart = new Cart(req.session.cart ? req.session.cart : {});

	cart.removeItem(productId);
	req.session.cart = cart;
	res.redirect("/shopping-cart");
});

router.get("/shopping-cart", function(req, res, next) {
	if (!req.session.cart) {
		return res.render("shopping-cart", {products: null});
	}
	var cart = new Cart(req.session.cart);
	res.render("shopping-cart", {products: cart.generateArray(), totalPrice: cart.totalPrice});
});

router.get("/checkout", isLoggedInForCheckout, function(req, res, next) {
	if (!req.session.cart) {
		return res.redirect("/shopping-cart");
	}	
	var cart = new Cart(req.session.cart);
	var errMsg = req.flash("error")[0];
	res.render("checkout", {totalPrice: cart.totalPrice, errMsg: errMsg, noErrors: !errMsg});
});

router.post("/checkout", isLoggedInForCheckout, function(req, res, next) {
	if (!req.session.cart) {
		return res.redirect("/shopping-cart");
	}		
	var cart = new Cart(req.session.cart);
	var stripe = require("stripe")("sk_test_UsyLx1OhRQmfrXBvDiYZ8Tc9");
	stripe.charges.create({
	  amount: cart.totalPrice * 100, // Note: the amount is in cents, eg. 2000 <=> $20
	  currency: "usd",
	  source: req.body.stripeToken, // obtained with Stripe.js
	  description: "Charge for " + req.user.email
	}, function(err, charge) {
	  if(err) {
	  	req.flash("error", err.message);
	  	return res.redirect("/checkout");
	  }
	  var order = new Order({
	  	user: req.user, // Note: i can access "user" via the request object because of the "passport" package
	  	cart: cart,
	  	address: req.body.address,
	  	name: req.body.name,
	  	paymentId: charge.id
	  });
	  order.save(function(err, result){
	  	if(err) { 
	  		console.log(err);
	  		return res.redirect("checkout"); 
	  	} // In a real-world application I should better handle the error case...
		  req.flash("success", "Succesfully bought product!");
		  req.session.cart = null;
		  res.redirect("/");
	  });
	});	
});

var csrfProtection = csrf();
router.use(csrfProtection);

router.get("/user/profile", isLoggedIn, function(req, res, next) { 
	Order.find({user: req.user}, function(err, orders){ // req.user available due to "passport" package -> Obviously, req.user could be more than just an Id, however, "mongoose" can figure this out...
		if(err) {
			return res.write("Error!");
		}
		var cart;
		orders.forEach(function(order) {
			cart = new Cart(order.cart);
			order.items = cart.generateArray();
		});
		res.render("user/profile", {orders: orders});
	}); 
});

router.get("/user/logout", isLoggedIn, function(req, res, next) {
	req.logout(); // We get this functionality from "passport" package
	res.redirect("/");
});

router.use("/", notLoggedIn, function(req, res, next){ // So, if user is not Logged-in he will be able to access the following routes
	next();
});

router.get("/user/signup", function(req, res, next) {
	var messages = req.flash("error");
	res.render("user/signup", {csrfToken: req.csrfToken(), messages: messages, hasErrors: messages.length>0});
});

router.get("/user/signin", function(req, res, next) {
	var messages = req.flash("error");
	res.render("user/signin", {csrfToken: req.csrfToken(), messages: messages, hasErrors: messages.length>0});
});

router.post("/user/signup", passport.authenticate("local.signup", { // If this second argument is executed <=> failure of authentication, the third argument(function) will not be executed
	// successRedirect: "/user/profile",
	failureRedirect: "/user/signup",
	failureFlash: true // This makes available the error message...
}), function(req, res, next){
	if (req.session.oldUrl) {
		var oldUrl = req.session.oldUrl;
		req.session.oldUrl = null;
		res.redirect(oldUrl);
	}
	else {
		res.redirect("/user/profile");
	}
});

router.post("/user/signin", passport.authenticate("local.signin", { 
	failureRedirect: "/user/signin",
	failureFlash: true
}), function(req, res, next){
	if (req.session.oldUrl) {
		var oldUrl = req.session.oldUrl;
		req.session.oldUrl = null;
		res.redirect(oldUrl);
	}
	else {
		res.redirect("/user/profile");
	}
});

module.exports = router;

function isLoggedIn(req, res, next) { // We will use this "middleware" function to all the routes we want to protect!
	if (req.isAuthenticated()) { // The "isAuthenticated" method is provided by the "passport" package
		return next();
	}
	res.redirect("/");
}

function notLoggedIn(req, res, next) {
	if (!req.isAuthenticated()) {
		return next();
	}
	res.redirect("/");
}

function isLoggedInForCheckout(req, res, next) { 
	if (req.isAuthenticated()) { 
		return next();
	}
	req.session.oldUrl = req.url;
	res.redirect("/user/signin");
}