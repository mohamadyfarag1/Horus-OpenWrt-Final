'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec('/usr/bin/uspot-clients.sh').then(function(res) {
			var data = { clients: [] };
			try {
				data = JSON.parse(res.stdout);
			} catch(e) {}
			return data.clients || data;
		}).catch(function() { return []; });
	},
	render: function(clients) {
		var E = document.createElement;
		
		// If clients is an object instead of array (some ubus returns object mapped by MAC)
		var clientArray = [];
		if (Array.isArray(clients)) {
			clientArray = clients;
		} else if (typeof clients === 'object') {
			for (var k in clients) {
				var c = clients[k];
				if (!c.mac) c.mac = k;
				clientArray.push(c);
			}
		}

		var table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('MAC Address')),
				E('th', { 'class': 'th' }, _('IP Address')),
				E('th', { 'class': 'th' }, _('State / Status')),
				E('th', { 'class': 'th' }, _('Bytes Rx / Tx')),
			])
		]);

		if (clientArray.length === 0) {
			table.appendChild(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '4' }, _('No connected clients or Horus Spot service is not running.'))
			]));
		} else {
			clientArray.forEach(function(c) {
				table.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, c.mac || '-'),
					E('td', { 'class': 'td' }, c.ip || c.ipaddr || '-'),
					E('td', { 'class': 'td' }, c.state || c.status || '-'),
					E('td', { 'class': 'td' }, (c.bytes_rx || 0) + ' / ' + (c.bytes_tx || 0))
				]));
			});
		}

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Horus Spot Connected Clients')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					table
				])
			])
		]);
	},
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
