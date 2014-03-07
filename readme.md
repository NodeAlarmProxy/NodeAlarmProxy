Initial Commit...  Currently App.js will connect to the envisalink server, provide the password, connect and get a status update.  Whenever the security system has changes they will get broadcast to this node app.

##Setup##

Make a `config.js` file with the following:

    exports.password = '';
    exports.serverpassword='';
    exports.host = 'x.x.x.x';
    exports.port = 4025;

then run `node app`

##Future##

Eventually "servertest.js" will get the bugs worked out and replace app.js

Then I'll convert everything to a npm package.