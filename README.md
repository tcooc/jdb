# jdb
simple json database, for testing/prototyping

This library is not designed to work with multiple clients writing to the same database,
and the watch feature is for ease of debugging and developer modifications to the database.

## Usage:
```
var Database = require('jdb');
var db = new Database();
Reading from database:
db.get().then((data) => {
	console.log(data.foo);
});
```
###Writing to database:
```
db.update((data) => {
	data.foo = 1;
});
```
The update function automatically saves after returning. Promises can also be returned:

```
db.update((data) => {
	return request(url).then((response) => {
		data.foo = response.foo;
	});
});
```
All methods return promises.

More detailed documentation can be found in `jdb.js`.
