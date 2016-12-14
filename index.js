var net = require('net');
var elink = require('./envisalink.js');
var events = require('events');
var eventEmitter = new events.EventEmitter();
//var config = require('./config.js');
var connections = [];
var alarmdata = {
	zone:{},
	partition:{},
	user:{}
};

var actual, server, config;
var consoleWrapper = new Object();

exports.initConfig = function(initconfig) {
	consoleWrapper.log = function() {
		// default is to long unless specifically disabled
		if(initconfig.logging !== false) {
			console.log.apply(this, arguments);
		}
	}

	config = initconfig;
	if (!config.actualport) {
		config.actualport = 4025;
	}
	if (!config.proxyenable) {
		config.proxyenable = false;
	}

	actual = net.connect({port: config.actualport, host:config.actualhost}, function() {
		consoleWrapper.log('actual connected');
	});

	if (config.proxyenable) {
		if (!config.serverport) {
			config.serverport = 4025;
		}
		if (!config.serverhost) {
			config.serverhost = '0.0.0.0';
		}
		if (!config.serverpassword) {
			config.serverpassword = config.actualpassword;
		}
		var server = net.createServer(function(c) { //'connection' listener
			consoleWrapper.log('server connected');
			connections.push(c);

			c.on('error',function(e){
				consoleWrapper.log('error',e);
				connections = [];
			});

			c.on('end', function() {
				var index = connections.indexOf(c);
				if ( ~index ) connections.splice(index,1);
				consoleWrapper.log('server disconnected:',connections);
			});
		  
			c.on('data', function(data) {
				consoleWrapper.log('data',data.toString());
				var dataslice = data.toString().replace(/[\n\r]/g, ',').split(',');

				for (var i = 0; i<dataslice.length; i++) {
					var rec = elink.applicationcommands[dataslice[i].substring(0,3)];
					if (rec) {
						if (rec.bytes=='' || rec.bytes==0){
							consoleWrapper.log(rec.pre,rec.post);
						} else {
							consoleWrapper.log(rec.pre,dataslice[i].substring(3,dataslice[i].length-2),rec.post);
						}
						if (rec.action == 'checkpassword') {
							checkpassword(c,dataslice[i]);
						}
						consoleWrapper.log('rec.action',rec.action);
						if (rec.action == 'forward') {
							sendforward(dataslice[i].substring(0,dataslice[i].length-2));
						}
						sendcommand(c,rec.send);
					}
				}
			});

		  c.write('505300');
		  c.pipe(c);
		});
		server.listen(config.serverport,config.serverhost, function() { //'listening' listener
			consoleWrapper.log('server bound');
		});

		function checkpassword(c,data) {
			if (data.substring(3,data.length-2) == config.serverpassword) {
				consoleWrapper.log('Correct Password! :)');
				sendcommand(c,'5051');
			} else {
				consoleWrapper.log('Incorrect Password :(');
				sendcommand(c,'5050');
				c.end();
			}
		}

		function sendforward(data) {
			consoleWrapper.log('sendforward:',data);
			sendcommand(actual,data);
		}

		function broadcastresponse(response) {
			if (connections.length > 0) {
				for (var i = 0; i<connections.length; i++) {
					consoleWrapper.log('response',response);
					sendcommand(connections[i],response);
				}
			}
		}
	}

	function loginresponse(data) {
		if (data.substring(3,4) == '0') {
			consoleWrapper.log('Incorrect Password :(');
		}
		if (data.substring(3,4) == '1') {
			consoleWrapper.log('successfully logged in!  getting current data...');
			sendcommand(actual,'001');
		}
		if (data.substring(3,4) == '2') {
			consoleWrapper.log('Request for Password Timed Out :(');
		}
		if (data.substring(3,4) == '3') {
			consoleWrapper.log('login requested... sending response...');
			sendcommand(actual,'005'+config.password);
		}
	}

	function updatezone(tpi,data) {
		if (parseInt(data.substring(3,6)) <= config.zone) {
			alarmdata.zone[parseInt(data.substring(3,6))] = {'send':tpi.send,'name':tpi.name,'code':data};
			eventEmitter.emit('zone',{zone:parseInt(data.substring(3,6)),code:data.substring(0,3)});
			//eventEmitter.emit('data',{alarmdata:alarmdata,zone:parseInt(data.substring(3,6)),code:data.substring(0,3)});
		}
	}
	function updatepartition(tpi,data) {
		if (parseInt(data.substring(3,4)) <= config.partition) {
			alarmdata.partition[parseInt(data.substring(3,4))] = {'send':tpi.send,'name':tpi.name,'code':data};
			if (data.substring(0,3) == "652") {
				eventEmitter.emit('partition',{partition:parseInt(data.substring(3,4)),code:data.substring(0,3),mode:data.substring(4,5)});
			} else {
				eventEmitter.emit('partition',{partition:parseInt(data.substring(3,4)),code:data.substring(0,3)});
			}
			//eventEmitter.emit('data',{alarmdata:alarmdata,partition:parseInt(data.substring(3,4)),code:data.substring(0,3)});
		}
	}
	function updatepartitionuser(tpi,data) {
		if (parseInt(data.substring(3,4)) <= config.partition) {
			alarmdata.user[parseInt(data.substring(4,8))] = {'send':tpi.send,'name':tpi.name,'code':data};
			eventEmitter.emit('data',{alarmdata:alarmdata});
		}
	}
	function updatesystem(tpi,data) {
		if (parseInt(data.substring(3,4)) <= config.partition) {
			alarmdata['system'] = {'send':tpi.send,'name':tpi.name,'code':data};
			eventEmitter.emit('data',{alarmdata:alarmdata});
		}
	}

	actual.on('data', function(data) {
		var dataslice = data.toString().replace(/[\n\r]/g, ',').split(',');
		  
		for (var i = 0; i<dataslice.length; i++) {
			var datapacket = dataslice[i];
			if (datapacket != '') {
				var tpi = elink.tpicommands[datapacket.substring(0,3)];
				if (tpi) {
					if (tpi.bytes=='' || tpi.bytes==0){
						consoleWrapper.log(tpi.pre,tpi.post);
					} else {
						consoleWrapper.log(tpi.pre,datapacket.substring(3,datapacket.length-2),tpi.post);
						if (tpi.action == 'updatezone') {
							updatezone(tpi,datapacket);
						}
						if (tpi.action == 'updatepartition') {
							updatepartition(tpi,datapacket);
						}
						if (tpi.action == 'updatepartitionuser') {
							updatepartitionuser(tpi,datapacket);
						}
						if (tpi.action == 'updatesystem') {
							updatepartitionuser(tpi,datapacket);
						}
						if (tpi.action == 'loginresponse') {
							loginresponse(datapacket);
						}
					}
					if (config.proxyenable) {
						broadcastresponse(datapacket.substring(0,datapacket.length-2));
					}
				}
			}
		}
	  //actual.end();
	});
	actual.on('end', function() {
	  consoleWrapper.log('actual disconnected');
	});

	return eventEmitter;
};

function sendcommand(addressee,command,callback) {
	var checksum = 0;
	for (var i = 0; i<command.length; i++) {
		checksum += command.charCodeAt(i);
	}
	checksum = checksum.toString(16).slice(-2).toUpperCase();
	consoleWrapper.log('sendcommand',command+checksum)
	addressee.write(command+checksum+'\r\n',function(){
		if (callback) {
			callback();
		}
	});
}

exports.manualCommand = function(command,callback) {
	if (actual) {
		if (callback) {
			sendcommand(actual,command,function(){
				consoleWrapper.log('manual command callback')
				callback();
			});
		} else {
			sendcommand(actual,command);
		}
	} else {
		//not initialized
	}
};

exports.getCurrent = function(callback) {
	callback(alarmdata);
};
