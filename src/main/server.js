var express = require('express');
var fs = require('fs');
var path = require('path');
var MockService = require('./service/MockService');
var bodyParser = require('body-parser');
var xmlparser = require('express-xml-bodyparser');

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(xmlparser());

var dirname = './mocks';

var mockService = new MockService(dirname, app);

var server = app.listen(8081, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("Example app listening at http://%s:%s", host, port)

});