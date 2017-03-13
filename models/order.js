var mongoose = require("mongoose");

var Schema = mongoose.Schema;

var schema = new Schema({
	user: {type: Schema.Types.ObjectId, ref: "User"}, // Basically here we are storing an Id which refers to the "User" collection
	cart: {type: Object, required: true},
	address: {type: String, required: true},
	name: {type: String, required: true},
	paymentId: {type: String, required: true}
});

module.exports = mongoose.model("Order", schema);