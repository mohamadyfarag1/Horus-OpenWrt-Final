'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.read('/etc/config/uspot').catch(function() { return ''; });
	},
	render: function(configContent) {
		var E = document.createElement;
		var textarea = E('textarea', {
			'id': 'uspot_config',
			'style': 'width: 100%; min-height: 400px; font-family: monospace; font-size: 14px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; background: #fafafa;',
			'wrap': 'off'
		}, [ configContent != null ? configContent : '' ]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Advanced Horus Spot Configuration')),
			E('div', { 'class': 'cbi-map-descr' }, _('Edit the raw /etc/config/uspot configuration file directly. Incorrect syntax may prevent Horus Spot from starting.')),
			E('div', { 'class': 'cbi-section' }, [
				textarea
			])
		]);
	},
	handleSave: function(ev) {
		var content = document.getElementById('uspot_config').value;
		return fs.write('/etc/config/uspot', content).then(function() {
			ui.addNotification(null, document.createElement('div', {}, _('Configuration saved successfully.')), 'info');
		}).catch(function(e) {
			ui.addNotification(null, document.createElement('div', {}, _('Failed to save configuration: ' + e.message)), 'danger');
		});
	},
	handleSaveApply: function(ev, bypass) {
		var content = document.getElementById('uspot_config').value;
		return fs.write('/etc/config/uspot', content).then(function() {
			return fs.exec('/etc/init.d/uspot', ['restart']).then(function() {
				ui.addNotification(null, document.createElement('div', {}, _('Configuration saved and Horus Spot restarted.')), 'info');
			});
		}).catch(function(e) {
			ui.addNotification(null, document.createElement('div', {}, _('Failed to save configuration: ' + e.message)), 'danger');
		});
	}
});
