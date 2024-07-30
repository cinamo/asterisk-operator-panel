var config = require("./config.js"),
	http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    namiLib = require("nami"),
    port = config.port,
	namiActions = {}, // to link actions to responses
	extensionNames = {}, // to link names to extensions

	namiConfig = {
	    host: config.asterisk.host,
	    port: config.asterisk.port,
	    username: config.asterisk.username,
	    secret: config.asterisk.secret
	},
	nami = new (require("nami").Nami)(namiConfig),
	logger  = nami.logger,

	queueNames = config.queues,
	lastCalls = [];


// static http server

var httpServer = http.createServer(function(request, response) {
    if (path.normalize(decodeURI(request.url)) !== decodeURI(request.url)) {
        response.statusCode = 403;
        response.end();
        return;
    }
 
  var uri = url.parse(request.url).pathname
    , filename = path.join(process.cwd(), 'public', uri);
  
  fs.exists(filename, function(exists) {
    if(!exists) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found\n");
      response.end();
      return;
    }
 
    if (fs.statSync(filename).isDirectory()) filename += '/index.html';
 
    fs.readFile(filename, "binary", function(err, file) {
      if(err) {        
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }
 
      response.writeHead(200);
      response.write(file, "binary");
      response.end();
    });
  });
})


// websocket connections

io = require("socket.io")(httpServer);

httpServer.listen(port, function(){
  console.log('listening on port ' + port);
});

io.on('connection', function (socket) {

	console.log('user connected from ' + socket.handshake.address.address);

	/*socket.on('toggle ext', function (ext) {
		console.log('toggle ext', ext);
	});*/


	// register triggers for user-initiated actions

	socket.on('add queue member', function (ext, queue) {
		var action = new namiLib.Actions.QueueAdd();
		action.queue = queue;
		action.interface = 'Local/' + ext + '@from-queue/n';
		action.membername = extensionNames[parseInt(ext)];
		action.stateinterface = 'hint:' + ext + '@ext-local';

		console.log('add queue member', queue, ext, extensionNames[parseInt(ext)]);
		nami.send(action, function(response) {});
	});

	socket.on('remove queue member', function (ext, queue) {
		var action = new namiLib.Actions.QueueRemove();
		action.queue = queue;
		action.interface = 'Local/' + ext + '@from-queue/n';

		console.log('remove queue member', queue, ext, extensionNames[parseInt(ext)]);
		nami.send(action, function(response) {});
	});


	// update client with latest information

	sendExtensionsTo(socket);
	sendQueuesTo(socket);
	sendCallsTo(socket);
	sendLogTo(socket);


	// register triggers for asterisk-initiated events

	nami.on('namiEvent', function (event) { 
		if(event.event == "QueueMemberAdded") {
        	var ext = event.location.substring(6, event.location.indexOf('@'));
			addQueueMember(socket, event.queue, ext, event.membername);
		}

		if(event.event == "QueueMemberRemoved") {
        	var ext = event.location.substring(6, event.location.indexOf('@'));
			removeQueueMember(socket, event.queue, ext);
		}

		if(event.event == "ExtensionStatus") {
			if(event.context.toLowerCase() != 'ext-queues') {
				setExtensionStatus(socket, event.exten, event.status);
			}
		}

		if(event.event == "Dial") {
			if(event.subevent == 'Begin')
				if(event.channel.indexOf('SIP/') == 0) {
					var ext = event.channel.substring(4, event.channel.indexOf('-'));
					if(isNaN(ext)) return;

					var name = event.connectedlinename;
					if(event.connectedlinename != null
						&& event.connectedlinename.indexOf('CID:') == 0) name = '';

					callStarted(socket, ext, event.connectedlinenum, name, false);

					// only log lines on trunk, not to another extension
					var trunk = event.destination.substring(4, event.destination.indexOf('-'));
					if(isNaN(trunk)) addCallToLog(socket, event.uniqueid, ext, event.connectedlinenum, name, true);
				}
		}

		if(event.event == "Bridge") {
			// ouch! dirty hack, should be optimized!!!
			sendCallsTo(socket);
		}

		if(event.event == "Newstate") {
			if(event.channelstate == 5) { // ringing
				if(event.channel.indexOf('SIP/') == 0) {
					var ext = event.channel.substring(4, event.channel.indexOf('-'));
					if(isNaN(ext)) return;
					var callerid = event.connectedlinename;
					if(callerid == event.connectedlinenum) callerid = '';

					callStarted(socket, event.calleridnum, event.connectedlinenum, callerid, true);
					setExtensionStatus(socket, event.calleridnum, 8); // ringing
				}
			}
		}

		if(event.event == "Hangup") {
			if(event.channel.indexOf('SIP/') == 0) {
				var ext = event.channel.substring(4, event.channel.indexOf('-'));
				if(isNaN(ext)) return;

				callHungup(socket, ext, event.connectedlinenum);
			}
		}

		if(event.event == "Join") {
			callInQueue(socket, event.queue, event.calleridnum, event.calleridname, event.uniqueid);
		}

		if(event.event == "Leave") {
			callLeftQueue(socket, event.queue, event.uniqueid)
		}
	});
});



function sendExtensionsTo(socket) {
	nami.send(new namiLib.Actions.SipPeers(), function(response) {
        var list = response.events;

        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            if(item.event == 'PeerEntry' && item.dynamic == 'yes') {
	            var ext = item.objectname;

            	var action = new namiLib.Actions.DbGet();
		        action.family = "AMPUSER"
		        action.key = ext + "/cidname"

		        namiActions[action.ActionID] = ext;

		        nami.send(action, function(response) {
		            if(response.response == 'Success') {
		            	var actionid = response.events[0].actionid;
		            	var ext = namiActions[actionid];
		            	var name = response.events[0].val;

		            	registerExtension(socket, ext, name);//, 'available');
		            	extensionNames[parseInt(ext)] = name;

		            	namiActions.removeItem(actionid);

		            	var statusAction = new namiLib.Actions.ExtensionState();
		            	statusAction.exten = ext;
		            	nami.send(statusAction, function(response) {
		            		setExtensionStatus(socket, response.exten, response.status)
		            	});
		            }
		        });
            }
        }
    });
}

function sendQueuesTo(socket) {
	nami.send(new namiLib.Actions.QueueStatus(), function(response) {
        var list = response.events;

        var queues = {};

        for(var i = 0; i < list.length; i++) {
        	var item = list[i];

        	if(item.event == "QueueParams" && item.queue != 'default') {
        		registerQueue(socket, item.queue, queueNames[item.queue], []);
        	}

        	if(item.event == "QueueMember") {
        		var ext = item.location.substring(6, item.location.indexOf('@'));
        		addQueueMember(socket, item.queue, ext, item.name);
        	}
        }
	});
}

function sendCallsTo(socket) {
	nami.send(new namiLib.Actions.CoreShowChannels(), function(response) {
		var list =  response.events;
		var calls = [];

		for(var i = 0; i < list.length; i++) {
			var item = list[i];

			if(item.event == "CoreShowChannel" && item.channel.indexOf('SIP/') == 0) {
				var ext = item.channel.substring(4, item.channel.indexOf('-'));
				if(isNaN(ext)) continue;
				var outgoing = (item.context == 'macro-dialout-trunk') ? true : false;
				var number = item.connectedlinenum;
				var callerid = (outgoing) ? '' : item.connectedlinename;
				if(callerid == number) callerid = '';
				var duration = hmsToSecondsOnly(item.duration);
				var id = item.uniqueid;

				calls.push({ ext: ext, number: number, name: callerid, duration: duration, outgoing: outgoing, id: id });
				
				//console.log(item);
				if(parseInt(item.channelstate) == 6) // up
					addCallToLog(socket, id, ext, number, callerid, outgoing);
			}
		}

		updateCallStatus(socket, calls);
	});
}

function sendLogTo(socket) {
	console.log('sent log to socket', lastCalls);
	socket.emit('log', lastCalls);
}

function registerExtension(socket, ext, name, status) {
	socket.emit('register ext', { ext: ext, name: name, status: status});
}

function unregisterExtension(socket, ext) {
	socket.emit('unregister ext', { ext: ext });
}

function registerQueue(socket, ext, name) {
	socket.emit('register queue', { ext: ext, name: name});
}

function addQueueMember(socket, queue, ext, name) {
	socket.emit('add queue member', { queue: queue, ext: ext, name: name });
}

function removeQueueMember(socket, queue, ext) {
	socket.emit('remove queue member', { queue: queue, ext: ext });
}

function callStarted(socket, ext, number, name, ringing) {
	socket.emit('call started', { ext: ext, number: number, name: name, ringing: ringing, duration: 0 });
}

function callHungup(socket, ext, number) {
	socket.emit('call hungup', { ext: ext, number: number });
}

function addCallToLog(socket, uniqueid, ext, number, name, outgoing) {
	var call = { id: uniqueid,
				 ext: ext, extname: extensionNames[parseInt(ext)],
				 number: number, name: name,
				 date: new Date(),
				 outgoing: outgoing };
	
	// skip internal call
	if(parseInt(number) in extensionNames) {
		return;
	}

	// see if we already have the call in the log
	for(var i = 0; i < lastCalls.length; i++) {
		if(lastCalls[i].id == call.id) {
			sendLogTo(socket);
			return;			
		}
	}

	// not replaced, then add to the log
	//console.log('call added to log', call);
	lastCalls.push(call);

	if(lastCalls.length > 20) {
		lastCalls = lastCalls.slice(-20);
	}

	sendLogTo(socket);
}

function callInQueue(socket, queueExt, number, name, id) {
	socket.emit('call in queue', { ext: queueExt, number: number, name: name, id: id, ringing: true, duration: 0 });
}

function callLeftQueue(socket, queueExt, id) {
	socket.emit('call left queue', { ext: queueExt, id: id });	
}

function setExtensionStatus(socket, ext, statusId) {
	var status;

	switch(parseInt(statusId)) {
		case 8:
			status = 'ringing';
			break;
		case 16: // on hold
		case 2: // busy
		case 1: // rings, not connected
		case 0:
			status = 'available';
			break;
		case -1: // extension not found
		case 4: // unavailable
		default:
			status = 'unavailable';
			break;
	}

	socket.emit('extension status changed', { ext: ext, status: status, statusid: statusId });
}

function updateCallStatus(socket, calls) {
	socket.emit('update call status', calls);
}



// open AMI connection ...

logger.setLevel('ERROR');

nami.open();

nami.on('namiConnected', function (event) {
	console.log("connected to Asterisk manager interface on " + namiConfig.host + ":" + namiConfig.port);
});

// ... keep the AMI connection alive ...

setInterval(function() {
	//console.log('ping');
	nami.send(new namiLib.Actions.Ping(), function(response) {
		//console.log('pong');
	});
}, 30000);

// ... and close it properly on exit

process.on('SIGINT', function () {
    nami.close();
    process.exit();
});

function hmsToSecondsOnly(str) {
    var p = str.split(':'),
        s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }

    return s;
}

Object.prototype.removeItem = function (key) {
   if (!this.hasOwnProperty(key))
      return
   if (isNaN(parseInt(key)) || !(this instanceof Array))
      delete this[key]
   else
      this.splice(key, 1)
};

/*
Status codes:
-1 = Extension not found
0 = Idle
1 = In Use
2 = Busy
4 = Unavailable
8 = Ringing
16 = On Hold*/