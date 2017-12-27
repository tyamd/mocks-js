var express = require('express');
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var xmlparser = require('express-xml-bodyparser');
var winston = require('winston');
var app = express();
var https = require('https');
var http = require('http');
var MockService = require('./service/MockService');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(xmlparser());

/* -------------------------------*/
/*          INIT LOGGER           */
/* -------------------------------*/

var loginfo = 'combined.log';
var logerror = 'error.log';

fs.unlink(loginfo, () => {
  winston.add(winston.transports.File, { name: 'info', filename: loginfo, level: 'info', json: false });
});
fs.unlink(logerror, () => {
  winston.add(winston.transports.File, { name: 'error', filename: logerror, level: 'error', json: false });
});



/* --------------------------------*/
/* LOAD SERVICES                   */
/* --------------------------------*/
var configuration = JSON.parse(fs.readFileSync(__dirname + '/configuration.json', 'utf8'));
var dirname = configuration.folder;

var mockService = new MockService(dirname, app);

/* --------------------------------*/
/* LOAD SECURITY OPTION            */
/* --------------------------------*/
if (!configuration.secure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

/* --------------------------------*/
/* LOAD LOG SERVICES               */
/* --------------------------------*/

app.get('/', (req, res) => {
  let logfile = loginfo;
  if (req.query['file']) {
    if (req.query['file'] == 'error') {
      logfile = logerror;
    }
  }
  res.header({ "content-type": "text/plain" });
  res.status(200);
  fs.readFile(logfile, 'utf8', function (err, data) {
    res.end(data);
  });
});


/* --------------------------------*/
/* LOAD SERVER HTTP                */
/* --------------------------------*/

if (configuration.http) {
  let httpserver = http.createServer(app).listen(configuration.http.port, function () {

    let host = httpserver.address().address
    let port = httpserver.address().port

    winston.info("Mock-js app listening at http://%s:%s", host, port)

  });
}
if (configuration.https) {
  let options = {
    key: fs.readFileSync(configuration.https.private),
    cert: fs.readFileSync(configuration.https.public),
    passphrase: configuration.https.passphrase
  };
  let httpsserver = https.createServer(options, app).listen(configuration.https.port, function () {

    let host = httpsserver.address().address
    let port = httpsserver.address().port

    winston.info("Secure Mock-js app listening at https://%s:%s", host, port)

  });
}