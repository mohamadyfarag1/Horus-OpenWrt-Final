'use strict';
'require baseclass';
'require dom';

return baseclass.singleton({
	getStyles: function() {
		return E('style', {}, `
			#maincontent { max-width: 98% !important; width: 98% !important; margin: 0 auto !important; padding: 10px !important; }
			.horus-wlc-container { color: #f8fafc; width: 100% !important; max-width: 100% !important; box-sizing: border-box; }
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 22px; margin-bottom: 22px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); width: 100%; box-sizing: border-box; }
			
			.horus-tabs { display: flex; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 20px; gap: 8px; }
			.horus-tab { padding: 12px 24px; cursor: pointer; font-size: 15px; font-weight: 700; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 10px 10px 0 0; transition: all 0.2s; }
			.horus-tab.active { background: rgba(30, 41, 59, 0.9); color: #00e676; border-color: rgba(0, 230, 118, 0.4); border-bottom: 2px solid #00e676; margin-bottom: -2px; }
			.horus-tab:hover:not(.active) { background: rgba(51, 65, 85, 0.5); color: #f8fafc; }
			
			.dash-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 22px; }
			.dash-card { background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(10px); padding: 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
			.dash-card h3 { margin: 0; font-size: 32px; font-weight: 800; }
			.dash-card p { margin: 6px 0 0 0; font-size: 13px; font-weight: 600; color: #94a3b8; }
			.dash-card.total h3 { color: #38bdf8; }
			.dash-card.online h3 { color: #4ade80; }
			.dash-card.offline h3 { color: #f87171; }
			.dash-card.clients h3 { color: #fbbf24; }
			
			/* Bulk Action Bar */
			.bulk-bar { background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%); border: 1px solid rgba(0, 230, 118, 0.4); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: 0 0 20px rgba(0, 230, 118, 0.15); }
			.bulk-title { font-weight: 800; color: #00e676; font-size: 14px; display: flex; align-items: center; gap: 8px; }
			.bulk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
			.btn-bulk { padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
			.btn-bulk-wifi { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; }
			.btn-bulk-pass { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #fff; }
			.btn-bulk-reboot { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
			.btn-bulk-off { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
			.btn-bulk-on { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
			
			.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; background: rgba(30, 41, 59, 0.5); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); }
			.toolbar input, .toolbar select { padding: 9px 14px; background: rgba(15, 23, 42, 0.6); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; outline: none; font-size: 13px; }
			.toolbar input { flex-grow: 1; min-width: 220px; }
			
			.table-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto; margin-bottom: 20px; }
			.custom-table { width: 100%; border-collapse: collapse; text-align: right; }
			.custom-table th { background: rgba(30, 41, 59, 0.8); padding: 14px 16px; font-size: 13px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
			.custom-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; }
			.custom-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
			.custom-table tr.selected td { background: rgba(0, 230, 118, 0.07); }
			
			.status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 6px; }
			.status-online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
			.status-offline { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
			
			/* Full Dedicated AP Drilldown */
			.ap-detail-header { display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 18px 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; flex-wrap: wrap; gap: 15px; }
			.ap-detail-title { font-size: 20px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 10px; margin: 0; }
			.btn-back { padding: 9px 18px; background: rgba(255,255,255,0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; }
			.btn-back:hover { background: rgba(255,255,255,0.2); color: #fff; }
			
			.radios-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 24px; }
			.radio-card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
			.radio-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
			.radio-title { font-size: 16px; font-weight: 700; color: #4ade80; margin: 0; }
			.radio-ops { display: flex; gap: 8px; flex-wrap: wrap; }
			.btn-sm-op { padding: 5px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; transition: 0.2s; }
			
			/* Ports Grid */
			.ports-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
			.port-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
			.port-header { display: flex; justify-content: space-between; align-items: center; }
			.port-name { font-weight: 800; font-size: 14px; color: #38bdf8; }
			.port-status-up { color: #4ade80; font-weight: 700; font-size: 12px; }
			.port-status-down { color: #94a3b8; font-size: 12px; }
			.port-clients-list { font-size: 11px; color: #cbd5e1; font-family: monospace; }
			
			.form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
			.form-field { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 4px; }
			.form-field label { font-size: 12px; font-weight: 600; color: #cbd5e1; }
			.form-field input, .form-field select { padding: 9px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15, 23, 42, 0.6); color: #f8fafc; font-size: 13px; outline: none; }
			.form-field input:focus, .form-field select:focus { border-color: #00e676; }
			
			/* Modern Action Controls */
			.client-ctrl-group { display: flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
			.btn-ctrl { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s; white-space: nowrap; user-select: none; }
			.btn-ctrl-steer { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
			.btn-ctrl-steer:hover { background: #0284c7; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); }
			.btn-ctrl-kick { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
			.btn-ctrl-kick:hover { background: #f59e0b; color: #000; transform: translateY(-1px); }
			.btn-ctrl-ban { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
			.btn-ctrl-ban:hover { background: #ef4444; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4); }
			.btn-primary { padding: 10px 22px; background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%); color: #000; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px; }
			.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3); }

			/* Modern Live Speed Meter Box */
			.speed-meter-box { display: inline-flex; flex-direction: column; gap: 4px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); padding: 6px 10px; border-radius: 8px; min-width: 115px; white-space: nowrap; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3); }
			.speed-meter-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: monospace; font-size: 12px; font-weight: 800; }
			.speed-meter-row.rx { color: #38bdf8; }
			.speed-meter-row.tx { color: #4ade80; }

			/* Modern Data Session Box */
			.session-data-box { display: inline-flex; flex-direction: column; gap: 3px; font-size: 11px; color: #cbd5e1; font-family: monospace; white-space: nowrap; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); }

			/* Wireless Health Box */
			.wireless-health-box { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; white-space: nowrap; }

			/* Modern AP Table Specific Styling */
			.ap-action-group { display: flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
			.ap-clients-box { display: inline-flex; flex-direction: column; gap: 4px; white-space: nowrap; }
			.pill-wifi { display: inline-flex; align-items: center; gap: 5px; background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.35); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 12px; white-space: nowrap; }
			.pill-wired { display: inline-flex; align-items: center; gap: 5px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 12px; white-space: nowrap; }
			.ap-hw-box { display: inline-flex; flex-direction: column; gap: 2px; font-size: 11px; color: #cbd5e1; background: rgba(0,0,0,0.25); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
			.ap-wifi-box { display: inline-flex; flex-direction: column; gap: 3px; white-space: nowrap; }
			.ap-wifi-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; white-space: nowrap; }

			.hidden { display: none !important; }
		`);
	}
});
