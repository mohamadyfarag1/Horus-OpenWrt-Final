'use strict';
'require baseclass';
'require dom';

return baseclass.extend({
	getStyles: function() {
		return E('style', {}, `
			/* ========================================================= */
			/* HORUS ENTERPRISE WLC DESIGN SYSTEM (DARK OBSIDIAN THEME)   */
			/* ========================================================= */
			
			#maincontent {
				max-width: 98% !important;
				width: 98% !important;
				margin: 0 auto !important;
				padding: 12px !important;
				-webkit-font-smoothing: antialiased;
				-moz-osx-font-smoothing: grayscale;
			}
			
			.horus-wlc-container, .horus-ban-view, .horus-settings-view {
				color: #f8fafc;
				width: 100% !important;
				max-width: 100% !important;
				box-sizing: border-box;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			}
			
			/* Glassmorphism Cards */
			.glass-card {
				background: rgba(17, 24, 39, 0.75);
				backdrop-filter: blur(16px);
				-webkit-backdrop-filter: blur(16px);
				border: 1px solid rgba(255, 255, 255, 0.09);
				border-radius: 14px;
				padding: 22px 26px;
				margin-bottom: 22px;
				box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.5);
				width: 100%;
				box-sizing: border-box;
				transition: border-color 0.2s ease, box-shadow 0.2s ease;
			}
			
			/* Navigation Tabs (Smooth Pill Tabs) */
			.horus-tabs {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 22px;
				gap: 10px;
				flex-wrap: wrap;
			}
			
			.horus-tab-group {
				background: rgba(15, 23, 42, 0.6);
				padding: 5px;
				border-radius: 12px;
				border: 1px solid rgba(255, 255, 255, 0.08);
				display: inline-flex;
				gap: 6px;
			}
			
			.horus-tab {
				padding: 10px 22px;
				cursor: pointer;
				font-size: 14px;
				font-weight: 700;
				color: #94a3b8;
				background: transparent;
				border: none;
				border-radius: 8px;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				user-select: none;
				display: inline-flex;
				align-items: center;
				gap: 6px;
			}
			
			.horus-tab:hover:not(.active) {
				background: rgba(255, 255, 255, 0.06);
				color: #f8fafc;
			}
			
			.horus-tab.active {
				background: linear-gradient(135deg, #10b981 0%, #059669 100%);
				color: #022c22;
				font-weight: 800;
				box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
			}
			
			/* Top KPI Metric Cards */
			.dash-cards {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
				gap: 16px;
				margin-bottom: 24px;
			}
			
			.dash-card {
				background: rgba(17, 24, 39, 0.65);
				backdrop-filter: blur(12px);
				-webkit-backdrop-filter: blur(12px);
				padding: 20px 24px;
				border-radius: 14px;
				border: 1px solid rgba(255, 255, 255, 0.08);
				text-align: center;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
				transition: transform 0.2s ease, box-shadow 0.2s ease;
			}
			
			.dash-card:hover {
				transform: translateY(-2px);
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
			}
			
			.dash-card h3 {
				margin: 0;
				font-size: 34px;
				font-weight: 900;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			}
			
			.dash-card p {
				margin: 6px 0 0 0;
				font-size: 13px;
				font-weight: 700;
				color: #94a3b8;
				letter-spacing: 0.2px;
			}
			
			.dash-card.total h3 { color: #38bdf8; }
			.dash-card.online h3 { color: #10b981; }
			.dash-card.offline h3 { color: #f87171; }
			.dash-card.clients h3 { color: #fbbf24; }
			
			/* Bulk Action Bar */
			.bulk-bar {
				background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
				border: 1px solid rgba(16, 185, 129, 0.4);
				border-radius: 12px;
				padding: 14px 20px;
				margin-bottom: 20px;
				display: flex;
				align-items: center;
				justify-content: space-between;
				flex-wrap: wrap;
				gap: 12px;
				box-shadow: 0 0 25px rgba(16, 185, 129, 0.15);
			}
			
			.bulk-title {
				font-weight: 800;
				color: #10b981;
				font-size: 14px;
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.bulk-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
			}
			
			.btn-bulk {
				padding: 8px 16px;
				font-size: 12px;
				font-weight: 700;
				border-radius: 8px;
				border: none;
				cursor: pointer;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				display: inline-flex;
				align-items: center;
				gap: 6px;
			}
			
			.btn-bulk:hover {
				transform: translateY(-1px);
			}
			
			.btn-bulk-wifi { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3); }
			.btn-bulk-pass { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #fff; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3); }
			.btn-bulk-reboot { background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
			.btn-bulk-off { background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
			.btn-bulk-on { background: rgba(16, 185, 129, 0.18); color: #4ade80; border: 1px solid rgba(16, 185, 129, 0.35); }
			
			/* Toolbar Filter */
			.toolbar {
				display: flex;
				flex-wrap: wrap;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 18px;
				gap: 12px;
				background: rgba(17, 24, 39, 0.6);
				backdrop-filter: blur(10px);
				padding: 14px 20px;
				border-radius: 12px;
				border: 1px solid rgba(255, 255, 255, 0.08);
			}
			
			.toolbar input, .toolbar select {
				padding: 10px 16px;
				background: #0f172a;
				color: #f8fafc;
				border: 1px solid rgba(255, 255, 255, 0.14);
				border-radius: 8px;
				outline: none;
				font-size: 13px;
				transition: all 0.2s ease;
			}
			
			.toolbar input:focus, .toolbar select:focus {
				border-color: #10b981;
				box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
			}
			
			.toolbar input { flex-grow: 1; min-width: 240px; }
			
			/* Enterprise Data Tables */
			.table-box {
				background: rgba(15, 23, 42, 0.5);
				border: 1px solid rgba(255, 255, 255, 0.09);
				border-radius: 14px;
				overflow-x: auto;
				margin-bottom: 22px;
				box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
			}
			
			.custom-table {
				width: 100%;
				border-collapse: collapse;
				text-align: inherit;
			}
			
			.custom-table th {
				background: rgba(30, 41, 59, 0.85);
				padding: 16px 18px;
				font-size: 13px;
				font-weight: 800;
				color: #94a3b8;
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				letter-spacing: 0.3px;
			}
			
			.custom-table td {
				padding: 14px 18px;
				font-size: 13px;
				border-bottom: 1px solid rgba(255, 255, 255, 0.05);
				color: #e2e8f0;
				vertical-align: middle;
			}
			
			.custom-table tr:hover td {
				background: rgba(255, 255, 255, 0.03);
			}
			
			.custom-table tr.selected td {
				background: rgba(16, 185, 129, 0.08);
			}
			
			/* Action Buttons & Badges */
			.client-ctrl-group, .ap-action-group {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				white-space: nowrap;
			}
			
			.btn-ctrl {
				padding: 7px 14px;
				border-radius: 8px;
				font-size: 12px;
				font-weight: 700;
				cursor: pointer;
				border: none;
				display: inline-flex;
				align-items: center;
				gap: 5px;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				user-select: none;
			}
			
			.btn-ctrl-steer { background: rgba(56, 189, 248, 0.16); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
			.btn-ctrl-steer:hover { background: #0284c7; color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4); }
			
			.btn-ctrl-kick { background: rgba(245, 158, 11, 0.16); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
			.btn-ctrl-kick:hover { background: #f59e0b; color: #000; transform: translateY(-1px); }
			
			.btn-ctrl-ban { background: rgba(239, 68, 68, 0.16); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
			.btn-ctrl-ban:hover { background: #ef4444; color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); }
			
			.btn-primary {
				padding: 10px 22px;
				background: linear-gradient(135deg, #10b981 0%, #059669 100%);
				color: #022c22;
				border: none;
				border-radius: 8px;
				font-weight: 800;
				font-size: 14px;
				cursor: pointer;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
			}
			
			.btn-primary:hover {
				transform: translateY(-1px);
				box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
			}
			
			.status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 4px; }
			.status-online { background: #10b981; box-shadow: 0 0 10px #10b981; }
			.status-offline { background: #ef4444; box-shadow: 0 0 10px #ef4444; }
			
			/* Speed Meter & Hardware Info Box */
			.speed-meter-box {
				display: inline-flex;
				flex-direction: column;
				gap: 4px;
				background: rgba(15, 23, 42, 0.7);
				border: 1px solid rgba(255, 255, 255, 0.1);
				padding: 6px 12px;
				border-radius: 8px;
				min-width: 120px;
				white-space: nowrap;
			}
			
			.speed-meter-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: monospace; font-size: 12px; font-weight: 800; }
			.speed-meter-row.rx { color: #38bdf8; }
			.speed-meter-row.tx { color: #4ade80; }
			
			.ap-hw-box {
				display: inline-flex;
				flex-direction: column;
				gap: 3px;
				font-size: 11px;
				background: rgba(15, 23, 42, 0.6);
				border: 1px solid rgba(255, 255, 255, 0.08);
				padding: 6px 12px;
				border-radius: 8px;
				min-width: 105px;
			}
			
			.pill-wifi { display: inline-block; background: rgba(16, 185, 129, 0.18); color: #4ade80; border: 1px solid rgba(16, 185, 129, 0.35); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
			.pill-wired { display: inline-block; background: rgba(56, 189, 248, 0.18); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-top: 4px; }
			
			.hidden { display: none !important; }
		`);
	}
});
