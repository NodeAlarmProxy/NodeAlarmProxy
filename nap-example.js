var nap = require('./nodealarmproxy.js');
var config = require('./config.js'); //comment this out

var alarm = nap.initConfig({ password:config.password, //replace config.* with appropriate items
	serverpassword:config.serverpassword,
	actualhost:config.host,
	actualport:config.port,
	serverhost:'0.0.0.0',
	serverport:config.port,
	zone:7,
	partition:1,
	proxyenable:true,
	atomicEvents:false
});

alarm.on('data', function(data) {
	console.log('npmtest data:',data);
});

alarm.on('zoneupdate', function(data) {
	console.log('npmtest zoneupdate:',data);
});

alarm.on('partitionupdate', function(data) {
	console.log('npmtest partitionupdate:',data);
});

alarm.on('partitionuserupdate', function(data) {
	console.log('npmtest partitionuserupdate:',data);
});

alarm.on('systemupdate', function(data) {
	console.log('npmtest systemupdate:',data);
});