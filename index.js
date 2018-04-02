var cluster = require('cluster');
var util=require("util");
var async=require("async");
var fs=require("fs");
var _=require("underscore");
var log={
    info:util.debug
};

var setting = {};
// worker threads will check master thread and kill its process if master thread does not exist
setting.checkMaster = true;
// how frequent should master thread broadcast its pid to all worker threads
setting.masterPidUpdatePeriod = 10000;
// how frequent should worker thread check master thread status
setting.checkMasterAlivePeriod = 30000;

setting.ioport=18200;

setting.nowport=18220;

setting.threads=16;

var oneWeek = 657450000;

var oneDay = 24 * 3600 * 1000;

var d = new Date();

d.setTime(d.getTime() + oneWeek);

exports.run=function(o,cb) {

    o=(o||{})
    o.application= (o.application||function(args){})
    o.setting= o.setting||{}
    cb=cb||function(e,r){}

    setting=_.extend(setting,o.setting)

    if (cluster.isMaster) {

        var printheader = function (cb) {
            log.info(fs.readFileSync('res/motd'));
            log.info("!!----------------------------------------------------------!!");
            log.info("        master thread started. PID:" + process.pid);
            log.info("!!----------------------------------------------------------!!");
            cb();
        };

        //var ioport = function (cb) {
        //    var io = require('socket.io').listen(setting.ioport);
        //    //io.enable('browser client minification');  // send minified client
        //    //io.enable('browser client etag');          // apply etag caching logic based on version number
        //    //io.enable('browser client gzip');          // gzip the file
        //    io.set('log level', 1);                    // reduce logging
        //    io.set('transports', [
        //        'websocket'
        //        , 'flashsocket'
        //        , 'htmlfile'
        //        , 'xhr-polling'
        //        , 'jsonp-polling'
        //    ]);
        //    log.info("socket.io is running on port "+setting.ioport);
        //
        //    setting.io=io;
        //
        //    cb();
        //};

        //var nowport = function (cb) {
        //    try {
        //        var httpServer = require('http').createServer(function (req, response) { /* Serve your static files */
        //        });
        //
        //        httpServer.listen(setting.nowport);
        //
        //        var nowjs = require("now");
        //
        //        var everyone = nowjs.initialize(httpServer);
        //
        //        log.info('now.js is running on port ' + setting.nowport);
        //
        //        everyone.now.logStuff = function (msg) {
        //            log.info(msg);
        //        };
        //
        //        setting.everyone=everyone;
        //        setting.nowjs=nowjs
        //
        //        cb();
        //
        //    }
        //    catch (e) {
        //        log.info(e);
        //    }
        //};

        var clusterworkers = function (cb) {
            for (var i = 0; i < setting.threads; i++) {
                var worker = cluster.fork();
                worker.on('message', function (msg) {
                    if (msg == 'SIGQUIT') {
                        shutDownServer('SIGQUIT');
                    }
                })
            }

            process.once('SIGQUIT', function () {
                log.info('Received SIGQUIT');
                shutDownServer('SIGQUIT');
            });

            process.once('SIGHUP', function () {
                log.info('Received SIGHUP');
                shutDownServer('SIGHUP');
            });

            process.once('SIGINT', function () {
                log.info('Received SIGINT');
                //sigint = true;
                process.exit();
            });

            process.once('SIGUSR2', function () {
                log.info('Received SIGUSR2');
                shutDownAllWorker('SIGQUIT');
            });

            cluster.on('death', function (worker) {
                //cconsole.log('worker ' + worker.pid + ' died');
                log.info('worker ' + worker.pid + ' died');
                cluster.fork();
            });

            cluster.on('exit', function (worker, code, signal) {
                var exitCode = worker.process.exitCode;
                console.log('worker ' + worker.process.pid + ' died (' + exitCode + '). restarting...');
                cluster.fork();
            });

            function shutDownServer(sig) {
                log.info("Closing All Worker Thread");
                shutDownAllWorker(sig);
                setTimeout(function () {
                    log.info("Closing Master");
                    console.log('Exiting.');
                    process.exit(0);
                }, 100);
            }

            function shutDownAllWorker(sig) {
                log.info("Closing All Worker Thread");
                eachWorker(function (worker) {
                    worker.send({cmd: "stop"});
                });
            }

            function eachWorker(callback) {
                for (var id in cluster.workers) {
                    callback(cluster.workers[id]);
                }
            }

            if (setting.checkMaster === true) {
                // update worker master pid
                setInterval(function () {
                    eachWorker(function (worker) {
                        worker.send({masterpid: process.pid});
                    });
                }, setting.masterPidUpdatePeriod);
            }

            cb();
        };

        var callback=function(){
            cb(null,setting)
        };

        async.waterfall([
            printheader,
            //ioport,
            //nowport,
            clusterworkers
        ]);

        //todo: make nowjs working again

    } else {
        // worker thread starts here

        var masterpid;
        var running = require('is-running');

        var closeWorker = function () {
            try {
                log.info("Closing Worker");
                process._channel.close();
                process._channel.unref();
                fs.close(0);
                process.exit();
            } catch (e) {
            }
        };

        process.once('SIGQUIT', function () {
            closeWorker();
        });

        process.once('SIGINT', function () {
            closeWorker();
        });

        process.on('message', function (msg) {
            if (msg.cmd && msg.cmd === 'notifyRequest') {
                log.info(msg);
                numReqs++;
            }
            if (msg.cmd && msg.cmd === 'stop') {
                closeWorker()
            }
            if (msg.masterpid) {
                masterpid = msg.masterpid;
            }
        });

        process.on('exit', function (code, signal) {
            if (signal) {
                log.info("worker was killed by signal: " + signal);
            } else if (code !== 0) {
                log.info("worker exited with error code: " + code);
            } else {
                log.info("worker exited");
            }
        });

        // add logic here
        //*************************************
        o.arguments= o.arguments||{}
        o.arguments= _.extend(o.arguments,{setting:setting})

        o.application.call(this, o.arguments);

        log.info("Start thread " + cluster.worker.id + "/"+setting.threads+" with pid "+process.pid+"...");
        currentthreadcount=setting.currentthreadcount++
        if (cluster.worker.id >= (setting.threads)) {
            setTimeout(function(){
                log.info("All " + setting.threads + " threads started successfully.");
            },1000)
        }

        if (setting.checkMaster === true) {
            // check if master thread is alive every 30 seconds
            setInterval(function () {
                try {
                    if (masterpid) {
                        running(masterpid, function (err, live) {
                            if (err) {
                                log.info('failed to retrieve master running state');
                            }
                            else {
                                if (live !== true) {
                                    closeWorker();
                                }
                            }
                        });
                    }
                } catch (e) {
                }
            }, setting.checkMasterAlivePeriod);
        }
        cb(null,setting)
    }
};