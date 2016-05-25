var socket = io();
var app = angular.module('raopApp', []);

app.controller('RaopCtrl', function ($scope) {
  $scope.extensions = {};
  $scope.queues = {};
  $scope.calls = [];
  $scope.callLog = [];

  // incoming events

  socket.on('register ext', function(ext) {
    ext.calls = [];
    $scope.extensions[ext.ext] = ext;
    $scope.$apply();
  });

  socket.on('register queue', function(queue) {
    queue.calls = [];
    queue.members = [];

    $scope.queues[queue.ext] = queue;
    $scope.$apply();
  });

  socket.on('add queue member', function(member) {
    $scope.queues[member.queue].members.push({ ext: member.ext, name: member.name });
    $scope.$apply();
  });

  socket.on('remove queue member', function(member) {
    var qMembers = $scope.queues[member.queue].members;
    for(var i = 0; i < qMembers.length; i++) {
      if(qMembers[i].ext == member.ext) {
        qMembers.splice(i, 1);
        $scope.$apply();
      }
    }
  });

  socket.on('update call status', function(calls) {
    $scope.calls = [];

    for(var i = 0; i < calls.length; i++) {
      $scope.calls.push(calls[i]);
    }
    $scope.$apply();
  });

  socket.on('call started', function(call) {
    console.log('call started', call);
    $scope.calls.push(call);
    $scope.$apply();
  });

  socket.on('call hungup', function(call) {
    for(var i = 0; i < $scope.calls.length; i++) {
      if($scope.calls[i].ext == call.ext && $scope.calls[i].number == call.number) {
        $scope.calls.splice(i, 1);
      }
    }
    $scope.$apply();
  });

  socket.on('call in queue', function(call) {
    $scope.calls.push(call);
    $scope.$apply();
  });

  socket.on('call left queue', function(call) {
    for(var i = 0; i < $scope.calls.length; i++) {
      if($scope.calls[i].id == call.id) {
        $scope.calls.splice(i, 1);
      }
    }
    $scope.$apply();
  });

  socket.on('extension status changed', function(ext) {
    $scope.extensions[ext.ext].status = ext.status;
    $scope.$apply();
  });

  socket.on('log', function(callLog) {
    $scope.callLog = callLog;
    $scope.$apply();
  });


  // actions

  $scope.addQueueMember = function(ext, queue) {
    socket.emit('add queue member', ext, queue);
  };

  $scope.removeQueueMember = function(ext, queue) {
    socket.emit('remove queue member', ext, queue);
  }

  $scope.toggleExt = function(ext) {
    socket.emit('toggle ext', ext);
  }
});


// Utility functions

var t = setInterval(function() {
  $('.timer').each(function (index) {
    var totalSec = $(this).data('ts') + 1;

    var date = new Date(1970,0,1);
    date.setSeconds(totalSec);
    var text = date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");

    $(this).data('ts', totalSec);
    $(this).html(text + "<br />");
  })
}, 1000);