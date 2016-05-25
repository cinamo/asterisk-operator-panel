var config = {};

// The port the web interface will bind to
config.port = 3000;

config.asterisk = {};

// Asterisk configuration
config.asterisk.host = "";
config.asterisk.port = 5038;
config.asterisk.username = "admin";
config.asterisk.secret = "";

// Queues configuration (#: 'name')
config.queues = { 4000: 'RedAnt', 4999: 'Prometech', 6000: 'Support' };

module.exports = config;