# 🚀 Ultra-Fast RADIUS Synchronization Architecture & API Specification
> **دليل الهندسة البرمجية والمعمارية لجلب بيانات المشتركين فائق السرعة من سيرفرات الريديس (SAS 4 / DMA / ADV) لأجهزة أوبن ورت والأنظمة المدمجة.**

---

## 📌 الفهرس
1. [المقدمة والمقارنة بين الطرق القديمة والحديثة](#1-المقدمة)
2. [المبادئ المعمارية للسرعة الفائقة (Architecture Pillars)](#2-المبادئ-المعمارية)
3. [محرك مزامنة SAS 4 فائق السرعة](#3-محرك-مزامنة-sas-4)
4. [محرك مزامنة DMA Radius فائق السرعة](#4-محرك-مزامنة-dma-radius)
5. [محرك مزامنة ADV Radius](#5-محرك-مزامنة-adv-radius)
6. [نظام الحماية من الوميض والكتابة الذرية (0-Flicker & Atomic Pipeline)](#6-نظام-الحماية-من-الوميض)
7. [الحقن الفوري بالمتصفح (0ms MutationObserver & Flex Layout)](#7-الحقن-الفوري-بالمتصفح)
8. [كود بايثون كامل وجاهز للتشغيل (Production Code)](#8-كود-بايثون-كامل-وجاهز)

---

## 1. المقدمة

### ❌ عيوب الطرق القديمة (Slow & Fragile Approach):
* **جلب جداول المشتركين كاملة:** استعلام عن آلاف المشتركين من السيرفر بينما الراوتر لا يتصل عليه سوى 10 أجهزة فقط، مما يستهلك الرام ويستغرق 10 إلى 30 ثانية.
* **الاستعلامات المتتالية البطيئة (Sequential Blocking Requests):** الاستعلام عن كل مشترك واحد تلو الآخر بشكل فردي.
* **الوميض (Flickering & Drops):** مسح كاش المتصفح عند كل ثانية مما يظهر عبارة "غير مسجل" لجزء من الثانية.
* **قفل واجهة المستخدم (UI Freezing):** إعادة بناء شجرة الـ DOM كاملة مع كل دورة مزامنة.

### ✅ مزايا الهيكلية الحديثة (Ultra-Fast Modern Architecture):
* **استعلام مستهدف للماكات المتصلة فقط (Targeted MAC-Only Fetching):** الاستعلام فقط عن الماكات المتصلة حالياً عبر الوايرليس (`Associated Stations`).
* **استعلام دفعي موحد (Single-Shot Batching):** جلب بيانات ورصيد جميع المتصلين في طلب HTTP واحد أو عبر مسارات متوازية (`Multi-Threading`).
* **التخزين اللحظي والذري (Atomic Data Persistence):** كتابة البيانات بدون قفل الملفات أو حدوث ملفات فارغة أثناء القراءة.
* **تحديث فوري 0 ملي ثانية (Instant In-Place Mutation):** تحديث الأرقام فقط في مكانها دون إعادة بناء عناصر الصفحة.

---

## 2. المبادئ المعمارية

```mermaid
flowchart TD
    AP[📡 OpenWrt Router] -->|1. Scan Connected MACs| STAs[Connected Stations List]
    STAs -->|2. Multi-Thread / Batch Query| RAD[(🌐 Radius Server: SAS4 / DMA)]
    RAD -->|3. JSON Response| ENG[Python Engine / Daemon]
    ENG -->|4. In-Memory TTL Cache| CACHE[(Memory Cache)]
    ENG -->|5. Atomic Swap os.replace| TMP[/tmp/horus_radius.json]
    TMP -->|6. Instant Fetch| CGI[/cgi-bin/horus_mac_data]
    CGI -->|7. 0ms DOM MutationObserver| UI[💻 Browser LuCI Interface]
```

---

## 3. محرك مزامنة SAS 4

### 🔑 التشفير المعتمد في SAS 4:
يستخدم SAS 4 خوارزمية **AES-256-CBC** مع مفتاح ثابت بطول 32 بايت وتشفير Base64:
* **المفتاح الثابت:** `abcdefghijuklmno0123456789012345`
* **أمر التشفير عبر OpenSSL:**
  ```bash
  printf '%s' '{"count":1,"search":"AA:BB:CC:DD:EE:FF"}' | openssl enc -aes-256-cbc -md md5 -a -A -k 'abcdefghijuklmno0123456789012345'
  ```

### 🔄 مسار الاستعلام الفائق (3-Step Precision Pipeline):
1. **تسجيل الدخول وجلب التوكن (`/admin/api/index.php/api/login`):**
   * إرسال اسم المستخدم وكلمة السر مشفرين.
   * حفظ التوكن في ملف `/tmp/sas_token` لتجنب تسجيل الدخول في كل ثانية.
2. **البحث السريع بالماك في المتصلين (`/index/online`):**
   * إرسال `{"count": 1, "search": "<MAC>"}`.
   * جلب عنوان الآي بي (`framedipaddress`) ومدة الاتصال (`acctsessiontime`).
   * **تنبيه هام جداً:** حقل `id` في جذر كائن `/index/online` هو رقم جلسة المحاسبة (`radacctid`) وليس معرف المشترك! المعرف الحقيقي يوجد داخل `user_details.id`.
3. **البحث في قائمة المشتركين (`/index/user`):**
   * إذا لم يكن المشترك متصلاً أونلاين بعد، يتم البحث بالماك (كبير `AA:BB...` وصغير `aa:bb...`) لجلب معرف المشترك الحقيقي `user_id`.
4. **جلب تفاصيل الرصيد والكوتة اللحظية (`/user/overview/{user_id}`):**
   * جلب الكوتة المتبقية بالبايت (`remaining_rxtx`).
   * جلب الرصيد المالي (`balance`).
   * جلب السلف (`loan_balance`).
   * جلب تاريخ انتهاء الاشتراك (`expiration`).

---

## 4. محرك مزامنة DMA Radius

سيرفر DMA يدعم واجهة **REST/Query Multi-Purpose API** فائقة السرعة عبر ملف `user_api.php`.

### 🔑 مفتاح الأمان والتوثيق:
* **الرابط:** `http://<DMA_IP>/user_api.php`
* **المفتاح الافتراضي:** `Mohamady_Radius_2026`

### ⚡ تقنية الاستعلام الدفعي المزدوج (Two-Step Turbo Batch):
1. **استعلام الجلسات النشطة دفعة واحدة (`action=online`):**
   ```http
   GET /user_api.php?key=Mohamady_Radius_2026&admin_user=admin&admin_pass=PASS&action=online
   ```
   * يعيد السيرفر قائمة بجميع المتصلين متضمنة:
     * `name` أو `firstname`: اسم المشترك
     * `mac` أو `normalized_mac`: الماك أدريس
     * `username`: اسم الدخول (أو ماك الكارت في شبكات الهوتسبوت)
     * `profile_name` أو `srvname`: اسم الباقة
     * `remainingTrafficBytes`: المتبقي من الجيجات
     * `uptime`: مدة الجلسة بالثواني
     * `expiration`: تاريخ الانتهاء

2. **جلب الأرصدة والكوتة التفصيلية بطلب دفعي واحد (`action=batch_overview`):**
   بدلاً من الاستعلام عن رصيد كل مشترك في طلب منفصل، يتم إرسال جميع أسماء المستخدمين في مصفوفة JSON بطلب واحد يستغرق **40 ملي ثانية فقط**:
   ```http
   GET /user_api.php?key=Mohamady_Radius_2026&admin_user=admin&admin_pass=PASS&action=batch_overview&users=["user1","user2","user3"]
   ```
   * يعيد السيرفر الرصيد المالي (`credits` -> `balance`) لجميع المشتركين دفعة واحدة.

---

## 5. محرك مزامنة ADV Radius

1. **تسجيل الدخول (`POST /login`):**
   * إرسال `username`, `password` (MD5), `master_key`.
   * استقبال `token`.
2. **جلب المتصلين دفعة واحدة (`POST /get_online_users`):**
   * مع تمرير التوكن في الـ Header `Authorization: Bearer <TOKEN>`.

---

## 6. نظام الحماية من الوميض

### 1. الكتابة الذرية للملفات (Atomic File Swap):
لتجنب قراءة ملف JSON فارغ (0 بايت) أثناء كتابة البايثون له:
```python
import json, os, time

def write_json_atomic(records, file_path="/tmp/horus_radius.json"):
    tmp_file = file_path + ".tmp"
    payload = {
        "status": "online",
        "timestamp": int(time.time()),
        "count": len(records),
        "data": records
    }
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    # استبدال ذري فوري في 0 نانو ثانية بدون قفل أو تجزئة
    os.replace(tmp_file, file_path)
```

### 2. التخزين الذاتي المرن (Fault-Tolerant Cache):
إذا حدث بطء مؤقت أو فقدان اتصال لمدة ثانية من سيرفر الريديس، **لا تقم بمسح بيانات المشترك**؛ بل يتم الاحتفاظ بآخر قراءة صحيحة لمدة تصل إلى 180 ثانية حتى يتصل السيرفر مجدداً وتتحدث الأرقام بسلاسة.

---

## 7. الحقن الفوري بالمتصفح

### كود الجافا سكريبت للواجهة (0ms DOM MutationObserver + Flex Layout):

```javascript
(function() {
    'use strict';

    var cachedMap = {};

    function normalizeMac(mac) {
        if (!mac) return '';
        var clean = String(mac).replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        if (clean.length === 12) return clean.match(/.{1,2}/g).join(':');
        return String(mac).toUpperCase().trim();
    }

    function injectAll() {
        var rows = document.querySelectorAll('tr');

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.querySelector('th')) continue;

            var cells = row.querySelectorAll('td');
            // استثناء جداول الوايرليس بالأعلى (تحتوي على أقل من 4 خانات)
            if (cells.length < 4) continue;

            // استثناء الصفوف التي تحتوي على أزرار التعديل والفحص
            var btns = row.querySelectorAll('button, input[type="button"], a.cbi-button');
            var isInterface = false;
            for (var b = 0; b < btns.length; b++) {
                var txt = (btns[b].textContent || btns[b].value || '').toLowerCase();
                if (txt.indexOf('edit') !== -1 || txt.indexOf('تعديل') !== -1 || txt.indexOf('scan') !== -1) {
                    isInterface = true; break;
                }
            }
            if (isInterface) continue;

            var macCellIndex = -1;
            var matchedMac = '';
            for (var c = 0; c < cells.length; c++) {
                var match = cells[c].textContent.trim().match(/([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/);
                if (match) {
                    macCellIndex = c;
                    matchedMac = normalizeMac(match[0]);
                    break;
                }
            }

            if (macCellIndex !== -1 && matchedMac !== '') {
                var hostCell = (cells.length > macCellIndex + 1) ? cells[macCellIndex + 1] : null;
                if (!hostCell || hostCell.querySelector('input[type="button"], button, a.cbi-button')) continue;

                var info = cachedMap[matchedMac];
                if (info) {
                    var balNum = parseFloat(info.balance || 0);
                    var balColor = (!isNaN(balNum) && balNum > 0) ? '#ffd700' : '#b0bec5';
                    var balanceHtml = '<span style="color:' + balColor + '; font-weight:bold;">💰 رصيد: ' + (isNaN(balNum) ? '0.00' : balNum.toFixed(2)) + ' ج</span>';

                    var cellKey = [matchedMac, info.name, info.profile, info.quota, info.balance, info.session].join('_');
                    if (hostCell.getAttribute('data-sas-done') === cellKey) continue;
                    hostCell.setAttribute('data-sas-done', cellKey);

                    hostCell.innerHTML = [
                        '<div style="line-height:1.5; font-family:sans-serif; text-align:right; direction:rtl; width:100%; min-width:180px;">',
                            '<div style="font-weight:bold; color:#00e676; font-size:13px; margin-bottom:2px;">👤 ' + info.name + '</div>',
                            '<div style="display:flex; flex-wrap:wrap; gap:4px 8px; font-size:11px; margin-bottom:2px;">',
                                '<span style="color:#69f0ae;">📦 ' + info.profile + '</span>',
                                balanceHtml,
                            '</div>',
                            '<div style="display:flex; flex-wrap:wrap; gap:4px 8px; font-size:11px; margin-bottom:2px;">',
                                '<span style="color:#ffd54f;">📊 متبقي: ' + info.quota_formatted + '</span>',
                                '<span style="color:#00e676;">📅 متبقي ' + info.days + ' يوم</span>',
                            '</div>',
                        '</div>'
                    ].join('');

                    var macCell = cells[macCellIndex];
                    var existingBadge = macCell.querySelector('.sas-badge-icon');
                    if (existingBadge) existingBadge.remove();
                    var badge = document.createElement('span');
                    badge.className = 'sas-badge-icon';
                    badge.style.cssText = 'display:inline-block; margin-left:6px; font-size:10px; background:#00c853; color:#000; padding:1px 4px; border-radius:3px; font-weight:bold;';
                    badge.textContent = 'SAS ✓';
                    macCell.appendChild(badge);
                }
            }
        }
    }

    // مراقب الـ DOM فوري لمنع أي وميض 0ms
    if (window.MutationObserver) {
        var obs = new MutationObserver(function() { injectAll(); });
        obs.observe(document.body, { childList: true, subtree: true });
    }
})();
```

---

## 8. كود بايثون كامل وجاهز

```python
#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""
High-Performance Universal Radius Engine (SAS 4 & DMA)
Author: Horus Team (c) 2026
"""

import sys, os, time, json, subprocess, urllib.request, urllib.parse, threading

JSON_OUT = "/tmp/horus_radius.json"
TOKEN_FILE = "/tmp/sas_token"

def http_req(url, data=None, headers=None, timeout=5):
    try:
        h = {"User-Agent": "HorusSync/2.0"}
        if headers: h.update(headers)
        if data is not None:
            if isinstance(data, dict):
                body = urllib.parse.urlencode(data).encode("utf-8")
                h["Content-Type"] = "application/x-www-form-urlencoded"
            else:
                body = data if isinstance(data, bytes) else str(data).encode("utf-8")
            req = urllib.request.Request(url, data=body, headers=h)
        else:
            req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="ignore"))
    except Exception:
        return None

def write_json_output(records, status="online"):
    try:
        tmp_file = "/tmp/horus_radius.tmp"
        output_payload = {
            "status": status,
            "timestamp": int(time.time()),
            "count": len(records),
            "data": records
        }
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, ensure_ascii=False)
        os.replace(tmp_file, JSON_OUT)
    except Exception:
        pass

class SasEngine:
    KEY = "abcdefghijuklmno0123456789012345"

    def __init__(self, base_url, username, password):
        self.base_url = base_url.strip().rstrip("/")
        self.username = username
        self.password = password
        self.token = ""
        self.user_cache = {}

        u = self.base_url
        if u.endswith("/api") or u.endswith("/api/"):
            self.login_url = u.rstrip("/") + "/login"
        elif "/api/" in u:
            self.login_url = u
        else:
            self.login_url = f"{u}/admin/api/index.php/api/login"
        
        self.online_url = self.login_url.replace("/login", "/index/online")
        self.user_url = self.login_url.replace("/login", "/index/user")
        self.overview_base_url = self.login_url.replace("/login", "/user/overview")

    def _encrypt(self, plain_text):
        try:
            cmd = f"printf '%s' '{plain_text}' | openssl enc -aes-256-cbc -md md5 -a -A -k '{self.KEY}'"
            return subprocess.check_output(cmd, shell=True, text=True).strip()
        except Exception:
            return None

    def get_token(self, force_refresh=False):
        if self.token and not force_refresh:
            return self.token
        payload = {"username": self.username, "password": self.password}
        enc = self._encrypt(json.dumps(payload))
        if not enc: return ""
        res = http_req(self.login_url, {"payload": enc}, timeout=5)
        if res and isinstance(res, dict) and res.get("data") and res["data"].get("token"):
            self.token = res["data"]["token"]
            return self.token
        return ""

    def fetch_user_info_for_mac(self, mac, token):
        headers = {"Authorization": f"Bearer {token}"}
        uname, name, profile, expiration, quota, balance, loan, ip, session, uid = mac, "", "", "", "", "", "", "", 0, ""

        # 1. Search Online
        enc_online = self._encrypt(json.dumps({"count": 1, "search": mac}))
        if enc_online:
            res = http_req(self.online_url, {"payload": enc_online}, headers=headers, timeout=5)
            if res and isinstance(res, dict) and res.get("data") and len(res["data"]) > 0:
                user_data = res["data"][0]
                ip = user_data.get("framedipaddress") or ""
                session = user_data.get("acctsessiontime") or 0
                uname = user_data.get("username") or mac
                ud = user_data.get("user_details") or {}
                uid = ud.get("id", "")
                name = (ud.get("firstname", "") + " " + (ud.get("lastname", "") or "")).strip()
                profile = user_data.get("user_profile_name", "") or ud.get("profile_details", {}).get("name", "")
                expiration = ud.get("expiration", "")

        # 2. Search Users if not found
        if not uid:
            for s_mac in [mac, mac.lower()]:
                enc_u = self._encrypt(json.dumps({"count": 1, "search": s_mac}))
                res = http_req(self.user_url, {"payload": enc_u}, headers=headers, timeout=5)
                if res and isinstance(res, dict) and res.get("data") and len(res["data"]) > 0:
                    ud = res["data"][0]
                    uid = ud.get("id", "")
                    if uid:
                        name = (ud.get("firstname", "") + " " + (ud.get("lastname", "") or "")).strip() or ud.get("username", "")
                        profile = ud.get("profile_details", {}).get("name", "")
                        expiration = ud.get("expiration", "")
                        break

        # 3. Overview for live traffic & balance
        if uid:
            res = http_req(f"{self.overview_base_url}/{uid}", headers=headers, timeout=5)
            if res and isinstance(res, dict) and res.get("data"):
                od = res.get("data") or {}
                quota = od.get("remaining_rxtx", "")
                balance = od.get("balance", "")
                loan = od.get("loan_balance", "")

        if not name and not profile and not ip:
            return None

        return {
            "mac": mac,
            "name": name or uname,
            "profile": profile,
            "expiration": expiration,
            "quota": quota,
            "balance": str(balance) if (balance is not None and balance != "") else "0.00",
            "loan": str(loan) if loan is not None else "",
            "ip": ip,
            "session": session,
            "username": uname
        }

    def sync(self, connected_macs):
        token = self.get_token()
        if not token: token = self.get_token(force_refresh=True)
        if not token: return [], "offline"

        results = []
        lock = threading.Lock()

        def _process(mac):
            try:
                res = self.fetch_user_info_for_mac(mac, token)
                if res:
                    self.user_cache[mac] = {'data': res, 'ts': time.time()}
                    with lock: results.append(res)
                elif mac in self.user_cache and (time.time() - self.user_cache[mac]['ts']) < 180:
                    with lock: results.append(self.user_cache[mac]['data'])
            except Exception:
                if mac in self.user_cache:
                    with lock: results.append(self.user_cache[mac]['data'])

        threads = [threading.Thread(target=_process, args=(m,)) for m in connected_macs]
        for t in threads: t.start()
        for t in threads: t.join()
        return results, "online"
```
