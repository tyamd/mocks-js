var express = require('express');
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var xmlparser = require('express-xml-bodyparser');
var winston = require('winston');
var http = require('http');
var https = require('https');
var MockService = require('./service/MockService');

/* -------------------------------*/
/*       INIT EXPRESS             */
/* -------------------------------*/
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(xmlparser());


/* -------------------------------*/
/*       INIT CONFIGURATION       */
/* -------------------------------*/
var configuration = JSON.parse(fs.readFileSync(__dirname + '/configuration.json', 'utf8'));

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
winston.level = configuration.loglevel ? configuration.loglevel : 'info';

/* --------------------------------*/
/* LOAD SERVICES                   */
/* --------------------------------*/

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
  let httpServer = http.createServer(app).listen(configuration.http.port, function () {
  
    let host = httpServer.address().address
    let port = httpServer.address().port
  
    winston.info("Mock-js app listening at http://%s:%s", host, port)
  
  });
}

/* --------------------------------*/
/* LOAD SERVER HTTPS               */
/* --------------------------------*/
if (configuration.https) {
  let options = {};
  if (configuration.https.pfx) {
    options = {
      pfx: fs.readFileSync(configuration.https.pfx),
      passphrase: fs.readFileSync(configuration.https.passphrase)
    }
  } else {
    options = {
      key: fs.readFileSync(configuration.https.privatekey),
      cert: fs.readFileSync(configuration.https.publickey)
    }
  }
  let httpsServer = https.createServer(options, app).listen(configuration.https.port, function () {
  
    let host = httpsServer.address().address
    let port = httpsServer.address().port
  
    winston.info("Secure Mock-js app listening at http://%s:%s", host, port)
  
  });
}