var streamDeck   = require('elgato-stream-deck');
var express = require('express');
var app = express();
var http   = require('http');
var socket_io     = require('socket.io');
var EventEmitter = require('events').EventEmitter;
var util         = require('util');

var server = new http.Server(app);
var io     = new socket_io(server);

var keys = {};

app.use(express.static(__dirname + '/public', {
	dotfiles: 'ignore',
	etag: true,

	extensions: [
		'htm',
		'html'
	],

	index: 'index.html',
	maxAge: 60,
	redirect: false
}));

app.use(function (req, res, next) {
	res.set('X-Created-By', 'Bitfocus AS');
	next();
});

server.listen(8180, "0.0.0.0", function () {
	console.log("Listening on port 8180");
});

var driver = function () {
	var self = this;

	EventEmitter.call(self);

	try {
		this.streamdeck = new streamDeck(arguments[0]);
		this.streamdeck.on('error', function () {
			var args = [].slice.call(arguments);
			args.unshift('error');
			self.emit.apply(self, args);
		});
		this.streamdeck.on('up', function () {
			var args = [].slice.call(arguments);
			args.unshift('up');
			self.emit.apply(self, args);
		});
		this.streamdeck.on('down', function () {
			var args = [].slice.call(arguments);
			args.unshift('down');
			self.emit.apply(self, args);
		});
	} catch (e) {
		console.log("Streamdeck err: ", e);
	}

	io.on('connect', function (socket) {
		socket.on('startup', function () {
			for (var key in keys) {
				socket.emit('fillImage', key, keys[key]);
			}
		});

		socket.on('down', function (keyIndex) {
			self.emit('down', keyIndex);
		});

		socket.on('up', function (keyIndex) {
			self.emit('up', keyIndex);
		});
	});
};
util.inherits(driver, EventEmitter);

driver.prototype.fillImage = function (keyIndex, imageBuffer) {
	var self = this;

	if (imageBuffer.length !== 15552) {
		throw new RangeError(`Expected image buffer of length 15552, got length ${imageBuffer.length}`);
	}

	keys[keyIndex] = imageBuffer;

	io.emit('fillImage', keyIndex, imageBuffer);

	setImmediate(function () {
		if (self.streamdeck) {
			self.streamdeck.fillImage(keyIndex, imageBuffer);
		}
	});
};

driver.prototype.clearKey = function(keyIndex) {
	var self = this;

	if (self.streamdeck) {
		self.streamdeck.clearKey(keyIndex);
	}

	keys[keyIndex] = Buffer.alloc(15552);

	io.emit('clearKey', keyIndex);
};

driver.prototype.setBrightness = function(value) {
	var self = this;

	if (self.streamdeck) {
		self.streamdeck.setBrightness(value);
	}
};

exports = module.exports = driver;
