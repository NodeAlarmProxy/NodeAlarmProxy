var nap = require('./servertest.js');
var config = require('./config.js'); //comment this out

var alarm = nap.initConfig({ password:config.password, //replace config.* with appropriate items
	serverpassword:config.serverpassword,
	actualhost:config.host,
	actualport:config.port,
	serverhost:'0.0.0.0',
	serverport:config.port,
	zone:7,
	partition:1
});

alarm.on('data', function(data) {
	console.log('npmtest data:',data)
})

exports.alarm=alarm;
exports.nap = nap;