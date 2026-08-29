'use strict';
'require baseclass';
'require dom';

return baseclass.extend({
	DICT: {
		ar: {
			'wlc_dashboard': '📊 لوحة التحكم والإكسسات (WLC Dashboard)',
			'ap_groups': '📁 المجموعات والقوالب (AP Groups)',
			'total_aps': 'إجمالي الإكسسات',
			'online': 'متصل 🟢',
			'offline': 'مفصول 🔴',
			'connected_clients': 'العملاء المتصلين',
			'search_placeholder': '🔍 بحث بالاسم، الآي بي، أو عنوان الماك...',
			'all_aps': 'جميع الإكسسات (All APs)',
			'online_only': 'المتصلة فقط 🟢',
			'offline_only': 'المفصولة فقط 🔴',
			'status': 'الحالة',
			'ap_name_host': 'اسم الإكسس / Hostname',
			'ip_mac': 'عنوان الـ IP والماك',
			'live_speed': 'السرعة اللحظية الحالية',
			'hw_health': 'أداء المعالج والحرارة',
			'clients_col': 'المتصلين (وايرليس / كابل)',
			'active_wifi': 'ترددات الواي فاي النشطة',
			'actions': 'إجراءات وتحكم شامل',
			'manage': '🖥️ تحكم وإدارة',
			'reboot': '🔄 ريستارت',
			'wireless_clients': 'وايرليس',
			'wired_clients': 'كابل',
			'cpu': 'المعالج',
			'temp': 'الحرارة',
			'ram': 'الرام',
			'download': 'سحب',
			'upload': 'رفع',
			'total_session': 'إجمالي استهلاك الجلسة',
			'signal_rate': 'الإشارة ومعدل الربط',
			'network_ip': 'الشبكة (IP / Iface)',
			'client_actions': 'إجراءات التحكم',
			'steer': '⚡ توجيه',
			'kick': '❌ فصل',
			'ban': '🚫 حظر',
			'unban': '🔓 فك الحظر',
			'back_to_dash': '⬅️ العودة للوحة الإكسسات العامة',
			'connected_hmp': 'متصل عبر HMP 🟢',
			'reboot_ap': '🔄 إعادة تشغيل الإكسس',
			'rx_live_total': 'سرعة التحميل اللحظية | الإجمالي:',
			'tx_live_total': 'سرعة الرفع اللحظية | الإجمالي:',
			'active_wifi_clients': 'عدد عملاء الوايرليس النشطين',
			'cpu_mem_temp': 'المعالج والذاكرة وحرارة الجهاز',
			'radio_2g_title': '📶 راديو 2.4GHz (Radio 0 - طويل المدى)',
			'radio_5g_title': '📶 راديو 5GHz (Radio 1 - عالي السرعة)',
			'running': '🟢 يعمل',
			'stopped': '🔴 متوقف',
			'noise_floor': '📡 مستوى الضوضاء والتشويش (Noise Floor):',
			'clean_env': '🟢 بيئة نقية',
			'restart_radio': '🔄 ريستارت',
			'toggle_radio_on': '✔️ تشغيل الراديو',
			'toggle_radio_off': '📴 إيقاف الراديو',
			'ssid_name': 'اسم الشبكة (SSID):',
			'new_password': 'كلمة السر:',
			'current_channel': 'القناة الحالية:',
			'channel_width': 'عرض القناة:',
			'save_radio_settings': '💾 حفظ وتطبيق إعدادات',
			'wired_ports_title': '🔌 منافذ اللان السلكية والأجهزة المتصلة كابل (Wired Ethernet Ports)',
			'wired_ports_desc': 'مراقبة حالة كابلات اللان وسرعة المنافذ والتحكم في إيقاف أو تشغيل أي منفذ سلكي.',
			'port_cable_connected': 'متصل بكابل',
			'port_enabled_no_cable': '⚪ مفعل (لا يوجد كابل)',
			'port_disabled_admin': '🔴 معطل برمجياً',
			'disable_port': '📴 إيقاف المنفذ',
			'enable_port': '✔️ تفعيل المنفذ',
			'connected_wired_clients': 'المتصلين',
			'wifi_subscribers_title': '👥 المشتركون المتصلون لاسلكياً على هذا الإكسس',
			'mac_brand': 'الماك وبصمة الجهاز',
			'subscriber_radius': 'بيانات المشترك والريديس',
			'remote_ip_admin_title': '🌐 إعدادات الشبكة وباسورد الإكسس عن بعد (Remote Static IP & Admin Password)',
			'new_ip': 'عنوان الـ IP الجديد:',
			'netmask': 'قناع الشبكة (Netmask):',
			'gateway': 'البوابة (Gateway):',
			'admin_password': 'كلمة سر لوحة التحكم (Admin Password):',
			'apply_remote_ip_btn': '💾 تغيير عنوان الـ IP والاسم وباسورد الإكسس فوراً عبر HMP',
			'banned_registry': '📑 قائمة الأجهزة المحظورة حالياً (Banned MACs Registry)',
			'manual_ban': '➕ إضافة ماك للقائمة المحظورة يدويّاً',
			'spoof_audit': '🛡️ سجل رصد الماكات المكررة ومكافحة السرقة',
			'roam_log': '📶 سجل تنقل الهواتف السلس (Fast Roaming)',
			'bulk_wifi': '📶 تعديل الواي فاي',
			'bulk_pass': '🔐 تغيير الباسورد',
			'bulk_reboot': '🔄 ريستارت',
			'bulk_radio_off': '📴 إيقاف الوايرليس',
			'bulk_radio_on': '✔️ تشغيل الوايرليس',
			'bulk_title': '🎯 تم تحديد ({n}) إكسس - الإجراءات الجماعية:',
			'settings': 'إعدادات نظام حورس',
			'lang_toggle': '🌐 English'
		},
		en: {
			'wlc_dashboard': '📊 WLC Dashboard & APs',
			'ap_groups': '📁 AP Groups & Templates',
			'total_aps': 'Total Access Points',
			'online': 'Online 🟢',
			'offline': 'Offline 🔴',
			'connected_clients': 'Connected Clients',
			'search_placeholder': '🔍 Search by name, IP, or MAC address...',
			'all_aps': 'All Access Points (All APs)',
			'online_only': 'Online Only 🟢',
			'offline_only': 'Offline Only 🔴',
			'status': 'Status',
			'ap_name_host': 'AP Name / Hostname',
			'ip_mac': 'IP & MAC Address',
			'live_speed': 'Live Bandwidth Speed',
			'hw_health': 'Hardware & Health',
			'clients_col': 'Clients (WiFi / Wired)',
			'active_wifi': 'Active WiFi Radios',
			'actions': 'Actions & Control',
			'manage': '🖥️ Manage & Details',
			'reboot': '🔄 Reboot',
			'wireless_clients': 'WiFi',
			'wired_clients': 'Wired',
			'cpu': 'CPU',
			'temp': 'Temp',
			'ram': 'RAM',
			'download': 'DL',
			'upload': 'UL',
			'total_session': 'Session Data',
			'signal_rate': 'Signal & Link Rate',
			'network_ip': 'Network (IP / Iface)',
			'client_actions': 'Client Actions',
			'steer': '⚡ Steer',
			'kick': '❌ Kick',
			'ban': '🚫 Ban',
			'unban': '🔓 Unban',
			'back_to_dash': '⬅️ Back to Main Dashboard',
			'connected_hmp': 'HMP Connected 🟢',
			'reboot_ap': '🔄 Reboot AP',
			'rx_live_total': 'Live Download | Total:',
			'tx_live_total': 'Live Upload | Total:',
			'active_wifi_clients': 'Active Wireless Clients',
			'cpu_mem_temp': 'CPU, Memory & SoC Temp',
			'radio_2g_title': '📶 Radio 2.4GHz (Radio 0 - Long Range)',
			'radio_5g_title': '📶 Radio 5GHz (Radio 1 - High Speed)',
			'running': '🟢 Active',
			'stopped': '🔴 Disabled',
			'noise_floor': '📡 Noise Floor Level:',
			'clean_env': '🟢 Clean Spectrum',
			'restart_radio': '🔄 Restart',
			'toggle_radio_on': '✔️ Enable Radio',
			'toggle_radio_off': '📴 Disable Radio',
			'ssid_name': 'Network Name (SSID):',
			'new_password': 'Password:',
			'current_channel': 'Current Channel:',
			'channel_width': 'Channel Width:',
			'save_radio_settings': '💾 Save & Apply Radio',
			'wired_ports_title': '🔌 Wired Ethernet Ports & Switch Links',
			'wired_ports_desc': 'Monitor Ethernet port links, link speeds, and control port power status.',
			'port_cable_connected': 'Cable Connected',
			'port_enabled_no_cable': '⚪ Enabled (No Cable)',
			'port_disabled_admin': '🔴 Disabled by Admin',
			'disable_port': '📴 Disable Port',
			'enable_port': '✔️ Enable Port',
			'connected_wired_clients': 'Wired Clients',
			'wifi_subscribers_title': '👥 Wireless Connected Clients on this AP',
			'mac_brand': 'MAC & Device Vendor',
			'subscriber_radius': 'Subscriber & RADIUS Details',
			'remote_ip_admin_title': '🌐 Remote Network & AP Admin Credentials',
			'new_ip': 'New Static IP:',
			'netmask': 'Subnet Mask:',
			'gateway': 'Default Gateway:',
			'admin_password': 'AP Admin Password:',
			'apply_remote_ip_btn': '💾 Apply Remote Network & Admin Credentials via HMP',
			'banned_registry': '📑 Banned Devices Registry',
			'manual_ban': '➕ Add MAC to Ban List',
			'spoof_audit': '🛡️ Anti-Spoofing & Duplicate Audit',
			'roam_log': '📶 Fast Roaming Audit Log',
			'bulk_wifi': '📶 Edit WiFi',
			'bulk_pass': '🔐 Change Password',
			'bulk_reboot': '🔄 Reboot',
			'bulk_radio_off': '📴 Turn Off WiFi',
			'bulk_radio_on': '✔️ Turn On WiFi',
			'bulk_title': '🎯 Selected ({n}) APs - Bulk Actions:',
			'settings': 'Horus WLC Settings',
			'lang_toggle': '🌐 العربية'
		}
	},

	getLang: function() {
		return localStorage.getItem('horus_lang') || 'ar';
	},

	setLang: function(lang) {
		localStorage.setItem('horus_lang', lang === 'en' ? 'en' : 'ar');
	},

	toggleLang: function() {
		var current = this.getLang();
		var next = current === 'ar' ? 'en' : 'ar';
		this.setLang(next);
		return next;
	},

	getDir: function() {
		return this.getLang() === 'ar' ? 'rtl' : 'ltr';
	},

	t: function(key, params) {
		var lang = this.getLang();
		var str = (this.DICT[lang] && this.DICT[lang][key]) || (this.DICT['ar'] && this.DICT['ar'][key]) || key;
		if (params && typeof params === 'object') {
			Object.keys(params).forEach(function(k) {
				str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
			});
		}
		return str;
	},

	buildLangBtn: function(onToggle) {
		var self = this;
		var btn = E('button', {
			class: 'btn-tool horus-lang-toggle',
			style: 'background:rgba(255,255,255,0.08); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:8px; padding:6px 14px; font-weight:800; font-size:13px; cursor:pointer; transition:all 0.2s; white-space:nowrap;'
		}, self.t('lang_toggle'));

		btn.onclick = function() {
			var newLang = self.toggleLang();
			btn.textContent = self.t('lang_toggle');
			if (typeof onToggle === 'function') {
				onToggle(newLang);
			}
		};

		return btn;
	}
});
