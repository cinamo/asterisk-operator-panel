RedAnt Asterisk operator panel
==============================

Disclaimer
----------

This is a basic Asterisk operator panel created for internal use, that I've whipped up because I was disenchanted with the things that were out there for free (basically, nothing). We're releasing this now in the hope that it might help somebody.
Since we're by no means Asterisk experts, exotic configurations (or configurations that are just different from ours) might not work perfectly. We're open to fixes and ways to do things better :)

Features
--------

* Shows extensions and their current status (offline, on call, with whom, for how long)
* Shows queues and callers currently in those queues
* Queue membership + add/remove extensions that are dynamic members of the queue
* List of last 10 calls and who has picked them up

Requirements
------------

You need to have the Asterisk Manager Interface (AMI) running. It is usually configured in `/etc/asterisk/manager.conf` and is for instance usually enabled by FreePBX.

Install all dependencies using `npm install` - this will also run `bower install` to put all the Bower components in `public/bower_components`.

Initial Configuration
---------------------

Edit the `config.js` file and set the following parameters:

- `config.port` -- default port on which the web interface will listen
- `config.asterisk.host` -- Asterisk host name or IP
- `config.asterisk.port` -- Asterisk manager interface port (default: 5038)
- `config.asterisk.username` -- Asterisk manager interface username (default: admin)
- `config.asterisk.secret` -- Asterisk manager interface secret

Then configure your queue names, like this:

`config.queues = { 4000: 'RedAnt', 4999: 'Prometech', 6000: 'Support' };`

Note: Failure to create all created queues will crash the application.

Acknowledgements
----------------

* Many thanks to Marcelo Gornstein for his NAME (Asterisk manager interface client for nodejs) without whom this wouldn't be possible
