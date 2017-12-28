"use strict";

var fs = require('fs');
var path = require('path');
var jsonpath = require('jsonpath');
var https = require('https');
var http = require('http');
var winston = require('winston');

class ResponseManager {

    constructor(directory, request, responses) {
        this.directory = directory;
        this.request = request;
        this.responses = responses;
        this.callback = (req, res) => {
            this.responses.find(response => {
                let isResponse = true;
                if (response.conditions) {
                    let headers = response.conditions.headers;
                    let params = response.conditions.params;
                    if (headers && headers.length > 0) {
                        isResponse = headers.reduce((accumulator, header) => {
                            let name = header.name.toLowerCase();
                            let value = header.value;
                            let currentValue = req.headers[name] && req.headers[name].match(value);
                            return accumulator && currentValue;
                        }, true);
                    }
                    if (params && params.length > 0) {
                        isResponse = isResponse && params.reduce((accumulator, param) => {
                            let value = param.value;
                            let currentValue = false;
                            switch (this.request.verb) {
                                case 'delete':
                                case 'get':
                                    let name = param.name;
                                    currentValue = req.query[name] && req.query[name].match(value);
                                    break;
                                case 'put':
                                case 'post':
                                    if (req.body) {
                                        let path = param.path;
                                        let bodyValue = jsonpath.query(req.body, path);
                                        currentValue = bodyValue && bodyValue.find(item => JSON.stringify(item).match(value));
                                    } else {
                                        currentValue = false;
                                    }
                                    break;
                                default:
                                    break;
                            }
                            return accumulator && currentValue;
                        }, true);
                    }
                }
                if (isResponse) {
                    this.manageResponse(req, res, response, request);
                }
                return isResponse;
            });
        };
        this.manageResponse = (req, res, response, request) => {
            res.header(response.headers);
            res.status(response.status);
            switch (response.type) {
                case 'file':
                    let fullPath = path.join(this.directory, response.body);
                    fs.readFile(fullPath, 'utf8', function (err, data) {
                        res.end(data);
                    });
                    break;
                case 'rp':
                    this.callReverseProxy(req, res, response, request);
                    break;
                case 'String':
                default:
                    res.end(response.body);
                    break;
            }
        }
        this.callReverseProxy = (req, res, response, request) => {
            let options = JSON.parse(JSON.stringify(response.options));
            let canal = options.protocol == 'https:' ? https : http;
            options.headers = Object.assign({}, req.headers, options.headers);
            options.headers.cookie = req.headers.cookie + ";" + options.headers.cookie;
            if (options.path === undefined) {
                options.path = req.path
            }
            const reverseReq = canal.request(options, (reverseResponse) => {
                let buffer = undefined;
                reverseResponse.on('data', (chunk) => {
                    if (buffer === undefined) {
                        buffer = new Buffer(chunk);
                    } else {
                        buffer = Buffer.concat([buffer, new Buffer(chunk)]);
                    }
                });
                reverseResponse.on('end', () => {
                    Object.assign(reverseResponse.headers, reverseResponse.headers, response.headers)
                    res.header(reverseResponse.headers);
                    res.status(reverseResponse.statusCode);
                    res.end(buffer);
                });
            });

            reverseReq.on('error', (e) => {
                winston.error(`problem with request: ${e.message}`);
            });

            // post the data
            if (req.body && JSON.stringify(req.body) != "{}") {
                if (request.contenttype.startsWith('application/json')) {
                    reverseReq.write(JSON.stringify(req.body));
                } else {
                    winston.error("Request content type '%s' not yet supported in reverse proxy mode", request.contenttype)
                }

            }
            reverseReq.end();
        }
    }

}

module.exports = ResponseManager;