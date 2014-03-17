Initial Commit...  Currently App.js will connect to the envisalink server, provide the password, connect and get a status update.  Whenever the security system has changes they will get broadcast to this node app.

##Setup##

`npm install nodealarmproxy

the `nap-example.js` shows a setup configuration.  Replace the init parameters with your own.

Available commands:

`initConfig(Object)` will create the server and a proxy for other things to connect to (Envisalink only allows one connection... this allows for multiple connections via proxy).

`getCurrent()` will tell the nodealarmproxy to transmit the last known values.

`manualCommand()` will send a command to the Envisalink 3 (do not include the checksum)