RedAnt Asterisk operator panel
==============================

Disclaimer
----------

This is an Asterisk operator panel created for internal use, that I've whipped up because I was disenchanted with the things that were out there for free (basically, nothing). We're releasing this now in the hope that it might help somebody.
Since we're by no means Asterisk experts, exotic configurations (or configurations that are just different from ours) might not work perfectly. We're open to fixes and ways to do things better :)

Initial Configuration
---------------------

Edit the `config.js` file and set the following parameters:

`config.port` -- default port on which the web interface will listen
`config.asterisk.host` -- Asterisk host name or IP
`config.asterisk.port` -- Asterisk manager interface port (default: 5038)
`config.asterisk.username` -- Asterisk manager interface username (default: admin)
`config.asterisk.secret` -- Asterisk manager interface secret

Then configure your queue names, like this:

`config.queues = { 4000: 'RedAnt', 4999: 'Prometech', 6000: 'Support' };`

Note: Failure to create all created queues will crash the application.
