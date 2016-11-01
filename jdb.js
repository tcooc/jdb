var fs = require('fs');
var Promise = require('bluebird');
var _ = require('underscore');

var writeFile = Promise.promisify(fs.writeFile);
var readFile = Promise.promisify(fs.readFile);
var stat = Promise.promisify(fs.stat);
var rename = Promise.promisify(fs.rename);

/*
 * options:
 * file - file to use as database (default "./jdb.json")
 * tempfile - file to use for safe/atomic writing (default file + ".tmp")
 * watch - watch for file changes and reload the database if file was changed (default true)
 * logErrors - log errors to console (default true)
 */
function Database(options) {
	options = _.extend({
		file: './jdb.json',
		tempfile: null,
		watch: true,
		logErrors: true
	}, options);
	_.extend(this, {
		_file: options.file,
		_tempfile: options.tempfile || (options.file + '.tmp'),
		_watch: options.watch,
		_logErrors: options.logErrors,
		_data: null,
		_lastSave: null
	});
	this._ready = stat(this._file).catch((err) => {
		if(err.code !== 'ENOENT') {
			throw err;
		}
		this._data = {};
		return this._save();
	});
	this.load();
	if(this._watch) {
		this._watchListener = watchListener.bind(this);
		this._ready.then(() => {
			fs.watchFile(options.file, this._watchListener);
		});
	}
}

// read from database, doesn't save
Database.prototype.get = function() {
	return this._ready.then(() => {
		return this._data;
	});
};

// helper function for updating the server and saving
Database.prototype.update = function(handler) {
	var promise = this._ready.then(() => {
		return handler(this._data);
	});
	this._ready = promise.then(this._save.bind(this), logError('database update error, aborting save').bind(this));
	return promise;
};

// save after current operations are complete
Database.prototype.save = function() {
	var promise = this._ready.then(this._save.bind(this));
	this._ready = promise.catch(logError('database save error').bind(this));
	return promise;
};

// forces save to file, no safety checks
Database.prototype._save = function() {
	return writeFile(this._tempfile, JSON.stringify(this._data, null, 4)).then(() => {
		return rename(this._tempfile, this._file);
	}).then(() => {
		this._lastSave = new Date();
	});
};

// load after current operations are complete
Database.prototype.load = function() {
	var promise = this._ready.then(this._load.bind(this));
	this._ready = promise.catch(logError('database load error').bind(this));
	return promise;
};

// forces load from file, no safety checks
Database.prototype._load = function() {
	return readFile(this._file).then((data) => {
		this._data = JSON.parse(data);
	});
};

// TODO instead of process.exit or w/e, close the server process by unbinding all listeners!!!
// releases resources taken up by this instance.
Database.prototype.release = function() {
	this._ready = this._ready.then(() => {
		if(this._watch) {
			fs.unwatchFile(this._file, this._watchListener);
		}
		this._ready = null;
	});
	return this._ready;
};

function watchListener(current, previous) {
	if(current.mtime !== previous.mtime && current.mtime > this._lastSave) {
		this.load();
	}
}

function logError(message) {
	return function(err) {
		if(this._logErrors) {
			console.error.call(this, message, err);
		}
	};
}

module.exports = Database;
