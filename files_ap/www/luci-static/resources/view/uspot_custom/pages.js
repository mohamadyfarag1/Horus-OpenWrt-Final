'use strict';
'require view';
'require form';
'require fs';
'require ui';

// Horus Spot — Portal Pages
return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('Portal Pages (MikroTik Theme)'),
			_('Horus Spot contains a built-in MikroTik Template Engine! You can upload a standard MikroTik Hotspot folder and it will work flawlessly with $(mac) and MD5 CHAP hashing.'));

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('Upload Hotspot Theme'));

		// Instruction Dummy
		o = s.option(form.DummyValue, '_howto', _('How to upload?'));
		o.default = _('<b>Method 1 (Recommended)</b>: Compress your MikroTik hotspot files into a .zip file. Click "Select file...". In the window that opens, click the <b>Upload icon (سهم لأعلى)</b> at the top to choose the ZIP from your computer. After it uploads, click on the file name in the list to select it.<br><b>Method 2 (Advanced)</b>: Use WinSCP to connect to the router and drag your files directly into <b>/www/uspot/</b>');
		o.rawhtml = true;

		// ZIP Upload
		o = s.option(form.FileUpload, 'theme_zip', _('Upload Theme (ZIP File)'));
		o.root_directory = '/tmp';
		o.enable_upload = true;
		o.enable_remove = true;
		o.description = _('Upload a .zip containing your MikroTik hotspot files (login.html, css, js).');

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			return fs.exec('/sbin/uci', ['get', 'uspot.hotspot.theme_zip']).then(function(res) {
				var zip_path = res.stdout ? res.stdout.trim() : '';
				if (zip_path && zip_path !== '') {
					// The path might be relative to /tmp since root_directory is /tmp
					var full_path = zip_path.charAt(0) === '/' ? zip_path : '/tmp/' + zip_path;
					return fs.exec('/usr/bin/uspot-theme.sh', [full_path]).then(function() {
						ui.addNotification(null, E('p', _('Theme extracted successfully to /www/uspot/!')), 'info');
						// Clear the UCI value so it doesn't try to extract again next time
						return fs.exec('/sbin/uci', ['set', 'uspot.hotspot.theme_zip=']).then(function() {
							return fs.exec('/sbin/uci', ['commit', 'uspot']);
						});
					}).catch(function() {
						ui.addNotification(null, E('p', _('Failed to extract theme. Ensure it is a valid ZIP.')), 'danger');
					});
				}
			}).catch(function() {});
		});
	}
});
