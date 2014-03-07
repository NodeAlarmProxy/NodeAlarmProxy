var net = require('net');
var elink = require('./envisalink.js');
var config = require('./config.js');
var connections = [];

var actual = net.connect({port: config.port, host:'10.0.0.21'}, function() { //'connect' listener
	console.log('actual connected');
});

function sendcommand(addressee,command) {
	var checksum = 0;
  	for (var i = 0; i<command.length; i++) {
  		checksum += command.charCodeAt(i);
  	}
  	checksum = checksum.toString(16).slice(-2);
  	addressee.write(command+checksum+'\r\n');
}

function checkpassword(c,data) {
	if (data.substring(3,data.length-2) == config.serverpassword) {
	  	console.log('Correct Password! :)')
	  	sendcommand(c,'5051');
	} else {
		console.log('Incorrect Password :(');
		sendcommand(c,'5050');
		c.end();
	}
}

function sendforward(data) {
	console.log('sendforward:',data)
	sendcommand(actual,data)
}

var server = net.createServer(function(c) { //'connection' listener
	console.log('server connected');
	connections.push(c);

	c.on('end', function() {
		var index = connections.indexOf(c);
		if ( ~index ) connections.splice(index,1);
		console.log('server disconnected:',connections);
	});
  
	c.on('data', function(data) {
		//console.log(data.toString());
		var dataslice = data.toString().replace(/[\n\r]/g, ',').split(',')

		for (var i = 0; i<dataslice.length; i++) {
			var rec = elink.applicationcommands[dataslice[i].substring(0,3)]
			if (rec) {
				if (rec.bytes=='' || rec.bytes==0){
					console.log(rec.pre,rec.post);
				} else {
					console.log(rec.pre,dataslice[i].substring(3,dataslice[i].length-2),rec.post);
				}
				if (rec.action == 'checkpassword') {
					checkpassword(c,dataslice[i]);
				}
				console.log(rec.action);
				if (rec.action == 'forward') {
					sendforward(dataslice[i].substring(0,dataslice[i].length-2))
				}
				sendcommand(c,rec.send)
			}
		}
	})

  c.write('505300');
  c.pipe(c);
});
server.listen(4025, function() { //'listening' listener
	console.log('server bound');
});

function broadcastresponse(response) {
	for (var i = 0; i<connections.length; i++) {
		sendcommand(connections[i],response)
	}
}

function loginresponse(data) {
	if (data.substring(3,4) == '0') {
	  	console.log('Incorrect Password :(');
	}
	if (data.substring(3,4) == '1') {
	  	console.log('successfully logged in!  getting current data...');
  		sendcommand(actual,'001');
	}
	if (data.substring(3,4) == '2') {
	  	console.log('Request for Password Timed Out :(');
	}
	if (data.substring(3,4) == '3') {
	  	console.log('login requested... sending response...');
	  	sendcommand(actual,'005'+config.password);
	}
}

actual.on('data', function(data) {
  var dataslice = data.toString().replace(/[\n\r]/g, ',').split(',')
  
  for (var i = 0; i<dataslice.length; i++) {
  		if (dataslice[i] != '') {
			var tpi = elink.tpicommands[dataslice[i].substring(0,3)]
			if (tpi) {
				if (tpi.bytes=='' || tpi.bytes==0){
					console.log(tpi.pre,tpi.post);
				} else {
					console.log(tpi.pre,dataslice[i].substring(3,dataslice[i].length-2),tpi.post);
					if (tpi.action == 'loginresponse') {
						loginresponse(dataslice[i]);
					}
				}
				server.getConnections(function(err,count){
					if (err) {
						console.log('server conenction error:',err);
					}
					if (count) {
						console.log('server connections:',count);
						broadcastresponse(dataslice[i].substring(0,dataslice[i].length-2));
					}
				})
			}
		}
	}
  //actual.end();
});
actual.on('end', function() {
  console.log('actual disconnected');
});
