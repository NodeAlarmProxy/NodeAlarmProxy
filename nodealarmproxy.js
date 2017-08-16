var net = require('net');
var elink = require('./envisalink.js');
var events = require('events');
var eventEmitter = new events.EventEmitter();
//var config = require('./config.js');
var connections = [];
var alarmdata = {
	zone: {},
	partition: {},
	user: {}
};

var actual, server, config;
var consoleWrapper = new Object();
var commandCallback = undefined;

exports.initConfig = function (initconfig) {
	consoleWrapper.log = function () {
		// default is to log unless specifically disabled
		if (initconfig.logging !== false) {
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

	actual = net.connect({ port: config.actualport, host: config.actualhost }, function () {
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
		var server = net.createServer(function (c) { //'connection' listener
			consoleWrapper.log('server connected');
			connections.push(c);

			c.on('error', function (e) {
				consoleWrapper.log('error', e);
				connections = [];
			});

			c.on('end', function () {
				var index = connections.indexOf(c);
				if (~index) connections.splice(index, 1);
				consoleWrapper.log('server disconnected:', connections);
			});

			c.on('data', function (data) {
				consoleWrapper.log('data', data.toString());
				var dataslice = data.toString().replace(/[\n\r]/g, ',').split(',');

				for (var i = 0; i < dataslice.length; i++) {
					var rec = elink.applicationcommands[dataslice[i].substring(0, 3)];
					if (rec) {
						if (rec.bytes === '' || rec.bytes === 0) {
							consoleWrapper.log(rec.pre, rec.post);
						} else {
							consoleWrapper.log(rec.pre, dataslice[i].substring(3, dataslice[i].length - 2), rec.post);
						}
						if (rec.action === 'checkpassword') {
							checkpassword(c, dataslice[i]);
						}
						consoleWrapper.log('rec.action', rec.action);
						if (rec.action === 'forward') {
							sendforward(dataslice[i].substring(0, dataslice[i].length - 2));
						}
						sendcommand(c, rec.send);
					}
				}
			});

			c.write('505300');
			c.pipe(c);
		});
		server.listen(config.serverport, config.serverhost, function () { //'listening' listener
			consoleWrapper.log('server bound');
		});

		function checkpassword(c, data) {
			if (data.substring(3, data.length - 2) == config.serverpassword) {
				consoleWrapper.log('Correct Password! :)');
				sendcommand(c, '5051');
			} else {
				consoleWrapper.log('Incorrect Password :(');
				sendcommand(c, '5050');
				c.end();
			}
		}

		function sendforward(data) {
			consoleWrapper.log('sendforward:', data);
			sendcommand(actual, data);
		}

		function broadcastresponse(response) {
			if (connections.length > 0) {
				for (var i = 0; i < connections.length; i++) {
					consoleWrapper.log('response', response);
					sendcommand(connections[i], response);
				}
			}
		}
	}

	function loginresponse(data) {
		var loginStatus = data.substring(3, 4);
		if (loginStatus === '0') {
			consoleWrapper.log('Incorrect Password :(');
		}
		if (loginStatus === '1') {
			consoleWrapper.log('successfully logged in!  getting current data...');
			sendcommand(actual, '001');
		}
		if (loginStatus === '2') {
			consoleWrapper.log('Request for Password Timed Out :(');
		}
		if (loginStatus === '3') {
			consoleWrapper.log('login requested... sending response...');
			sendcommand(actual, '005' + config.password);
		}
	}

	function updatezone(tpi, data) {
		var zone = parseInt(data.substring(3, 6));
		var initialUpdate = alarmdata.zone[zone] === undefined;
		if (zone <= config.zone) {
			alarmdata.zone[zone] = { 'send': tpi.send, 'name': tpi.name, 'code': data };
			if (config.atomicEvents && !(initialUpdate && config.suppressInitialUpdate))  {
				//eventEmitter.emit('zoneupdate', [zone, alarmdata.zone[zone]]);
				var zoneId = parseInt(data.substring(3, 6));
				var evtData = { zone: zoneId, code: data.substring(0, 3), evtName: tpi.send };
				if( config.zoneInfo && config.zoneInfo[zoneId] && config.zoneInfo[zoneId].label)
					evtData.zoneLabel = config.zoneInfo[zoneId].label;
				else
					evtData.zoneLabel = "Zone-" + zoneId;
				eventEmitter.emit('zoneupdate', evtData);
			} else {
				eventEmitter.emit('data', alarmdata);
			}
		}
	}
	function updatepartition(tpi, data) {
		var partition = parseInt(data.substring(3, 4));
		var initialUpdate = alarmdata.partition[partition] === undefined;
		if (partition <= config.partition) {
			alarmdata.partition[partition] = { 'send': tpi.send, 'name': tpi.name, 'code': data };
			if (config.atomicEvents && !(initialUpdate && config.suppressInitialUpdate)) {
				//eventEmitter.emit('partitionupdate', [partition, alarmdata.partition[partition]]);
				if (data.substring(0, 3) == "652") {
					eventEmitter.emit('partitionupdate', { partition: parseInt(data.substring(3, 4)), code: data.substring(0, 3), mode: data.substring(4, 5), evtName: tpi.send });
				} else {
					eventEmitter.emit('partitionupdate', { partition: parseInt(data.substring(3, 4)), code: data.substring(0, 3), evtName: tpi.send });
				}
			} else {
				eventEmitter.emit('data', alarmdata);
			}
		}
	}
	function updatepartitionuser(tpi, data) {
		var partition = parseInt(data.substring(3, 4));
		var user = parseInt(data.substring(4, 8));
		var initialUpdate = alarmdata.user[user] === undefined;
		if (partition <= config.partition) {
			alarmdata.user[user] = { 'send': tpi.send, 'name': tpi.name, 'code': data };
			if (config.atomicEvents && !initialUpdate) {
				eventEmitter.emit('partitionuserupdate', [user, alarmdata.user[user]]);
			} else {
				eventEmitter.emit('data', alarmdata);
			}
		}
	}
	function updatesystem(tpi, data) {
		var partition = parseInt(data.substring(3, 4));
		var initialUpdate = alarmdata.system === undefined;
		if (partition <= config.partition) {
			alarmdata.system = { 'send': tpi.send, 'name': tpi.name, 'code': data };
			if (config.atomicEvents && !initialUpdate) {
				eventEmitter.emit('systemupdate', alarmdata.system);
			} else {
				eventEmitter.emit('data', alarmdata);
			}
		}
	}

	actual.on('data', function (data) {
		var dataslice = data.toString().replace(/[\n\r]/g, ',').split(',');

		for (var i = 0; i < dataslice.length; i++) {
			var datapacket = dataslice[i];
			if (datapacket !== '') {
				var tpi = elink.tpicommands[datapacket.substring(0, 3)];
				if (tpi) {
					if (tpi.bytes === '' || tpi.bytes === 0) {
						consoleWrapper.log(tpi.pre, tpi.post);
					} else {
						consoleWrapper.log(tpi.pre, datapacket.substring(3, datapacket.length - 2), tpi.post);
						if (tpi.action === 'updatezone') {
							updatezone(tpi, datapacket);
						}
						else if (tpi.action === 'updatepartition') {
							updatepartition(tpi, datapacket);
						}
						else if (tpi.action === 'updatepartitionuser') {
							updatepartitionuser(tpi, datapacket);
						}
						else if (tpi.action === 'updatesystem') {
							updatepartitionuser(tpi, datapacket);
						}
						else if (tpi.action === 'loginresponse') {
							loginresponse(datapacket);
						}
                                                else if (tpi.action === 'command-completed') {
                                                  if (commandCallback) {
                                                     commandCallback();
                                                  }
                                                }
                                                else if (tpi.action === 'command-error') {
                                                  if (commandCallback) {
                                                     commandCallback(datapacket.substring(3, datapacket.length - 2));
                                                  }
						}
					}
					if (config.proxyenable) {
						broadcastresponse(datapacket.substring(0, datapacket.length - 2));
					}
				}
			}
		}
		//actual.end();
	});
	actual.on('end', function () {
		consoleWrapper.log('actual disconnected');
	});

	return eventEmitter;
};

function sendcommand(addressee, command) {
	var checksum = 0;
	for (var i = 0; i < command.length; i++) {
		checksum += command.charCodeAt(i);
	}
	checksum = checksum.toString(16).slice(-2).toUpperCase();
	consoleWrapper.log('sendcommand', command + checksum)
	addressee.write(command + checksum + '\r\n');
}

exports.manualCommand = function (command, callback) {
	if (actual) {
		if (callback) {
                        commandCallback = callback;
		} else {
                        commandCallback = undefined;
		}
		sendcommand(actual, command);
	} else {
		//not initialized
	}
};

exports.getCurrent = function () {
	eventEmitter.emit('data', alarmdata);
};
