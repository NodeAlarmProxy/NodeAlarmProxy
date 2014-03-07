var elink = require('./envisalink.js');
var config = require('./config.js');

var net = require('net');
var client = net.connect({port: config.port, host:config.host},
    function() { //'connect' listener
  console.log('client connected');
});

function sendcommand(addressee,command) {
	var checksum = 0;
  	for (var i = 0; i<command.length; i++) {
  		checksum += command.charCodeAt(i);
  	}
  	checksum = checksum.toString(16).slice(-2);
  	addressee.write(command+checksum+'\r\n');
}

function loginresponse(data) {
	if (data.substring(3,4) == '0') {
	  	console.log('Incorrect Password :(');
	}
	if (data.substring(3,4) == '1') {
	  	console.log('successfully logged in!  getting current data...');
  		sendcommand(client,'001');
	}
	if (data.substring(3,4) == '2') {
	  	console.log('Request for Password Timed Out :(');
	}
	if (data.substring(3,4) == '3') {
	  	console.log('login requested... sending response...');
	  	sendcommand(client,'005'+config.password);
	}
}

client.on('data', function(data) {
  var dataslice = data.toString().replace(/[\n\r]/g, ',').split(',')
  
  for (var i = 0; i<dataslice.length; i++) {
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
		}
	}
  //client.end();
});
client.on('end', function() {
  console.log('client disconnected');
});