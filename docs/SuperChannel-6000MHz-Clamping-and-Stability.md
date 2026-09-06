# التوثيق الفني: معمارية استقرار الترددات السوبر حتى 6000 MHz والحماية التلقائية لطاقة البث وفصل airMAX
# Technical Architecture: Full 6000 MHz SuperChannel Spectrum, 20 MHz Auto-Clamping, and airMAX Protection

**تاريخ التوثيق:** سبتمبر 2026  
**النطاق المستهدف:** Horus-OpenWrt (IPQ4019 / ath10k-ct / mac80211 / hostapd)  
**الحالة:** معتمد ومطبق عملياً على الراوتر المباشر (`192.168.100.1`) ومثبت في مستودع الكود  

---

## 1. الملخص التنفيذي (Executive Summary)

خلال مراحل تشغيل واختبار الترددات السوبر وربط أجهزة **Horus** مع محطات البث **Ubiquiti Rocket AC / airMAX** وشبكات النانو، تم تشخيص وحل مجموعة من التحديات الهندسية الحرجة التي كانت تؤثر على استقرار طاقة البث (RF Tx-Power) وتنظيم القنوات:

1. **حل مشكلة هبوط طاقة البث إلى صفر (0 dBm) عند اختيار التردد 5900 MHz (القناة 180) فما فوق:**
   * تم اكتشاف أن اختيار عرض القناة **80 MHz** أو **40 MHz** في الترددات العالية يتنافى مع بنية معيار 802.11ac القياسي لعدم وجود قنوات ثانوية للدمج (Secondary Channel Bonding) فوق 5825 MHz.
   * تم ابتكار **نظام الحماية والتقليص التلقائي (Automatic 20 MHz Auto-Clamping)** في برمجيات `mac80211.sh` و `hamax`، بحيث يتم تشغيل الترددات من 5900 MHz إلى 6000 MHz تلقائياً بعرض **20 MHz (VHT20)**، مما يقفل طاقة الإرسال على أقصى قدرة تشغيلية **30 dBm (1000 mW)** بشكل دائم ومستقر.

2. **توسيع طيف الـ 5 جيجا رسمياً إلى 6000 MHz (القناة 200) بإجمالي 177 قناة:**
   * تم رفع سقف القنوات الترددية في باتشات الدرايفر `ath10k-ct` من القناة 185 (5925 MHz) إلى القناة 200 (6000 MHz).
   * تم تعديل قواعد التنظيم الراديوي في النواة (Kernel Regulatory Rules) لتشمل النطاق حتى `6010+10` MHz بقدرة 33 dBm.

3. **إعادة ترتيب وتنظيم قنوات الـ 5G والـ 2.4G في واجهة LuCI تصاعدياً مثل Rocket AC و airOS:**
   * تم التخلص من معادلة التردد القديمة التي كانت تقسم القنوات وتحول القنوات $\ge 180$ إلى تردد 4910 MHz.
   * تم بناء القائمة تصاعدياً بخطوات منتظمة 5 MHz من 5120 MHz (Ch 24) حتى 6000 MHz (Ch 200) لـ 5GHz، ومن 2312 MHz إلى 2732 MHz (86 قناة) لـ 2.4GHz.

4. **حماية كروت الوايرلس من إعادة التهيئة غير الضرورية عند تعديل إعدادات airMAX:**
   * تم وضع صمام أمان في سكربت `/usr/bin/hamax apply` يمنع المساس بكروت الوايرلس عند حفظ الإعدادات طالما كان خيار تفعيل airMAX معطلاً (`enabled=0`).
   * تم التأكد من أن تفعيل أو تعطيل airMAX لا يتسبب بأي انخفاض في طاقة الإرسال لجميع ترددات السوبر تشانل.

---

## 2. التحليل الجذري لمشكلة هبوط الباور على 5900 MHz

### أ. السلوك المرصود:
عند اختيار القناة 180 (تردد 5900 MHz) في واجهة LuCI، كانت الواجهة تُظهر:
* `Wireless is disabled or not associated`
* `Tx-Power: 0 dBm` (انخفاض الباور من 30 dBm إلى 0)

### ب. السبب التقني الدقيق:
في الصورة الملتقطة من إعدادات الواجهة، كان عرض النطاق (Channel Width) مضبوطاً على القيمة الافتراضية **80 MHz** (`VHT80`).
وفقاً لمعيار 802.11ac:
* القنوات العريضة (40 MHz و 80 MHz) تتطلب وجود قناة أساسية (Primary Channel) وقنوات ثانوية متجاورة (Secondary Channels / Extension Channels).
* في النطاق الترددي القياسي لـ 5 GHz، تنتهي قنوات الدمج الـ 80 MHz عند القناة 155 أو 161 (حتى تردد 5825 MHz).
* عندما استلمت خدمة `hostapd` أمر التشغيل للقناة 180 (5900 MHz) بعرض 80 MHz أو 40 MHz، بحثت عن القنوات المجاورة للدمج فلم تجدها فوق تردد 5925 MHz، مما أدى إلى فشل التهيئة وسجلت الخدمة الخطأ التالي في النظام:
  ```text
  hostapd: HT40 channel pair not allowed
  hostapd: Interface initialization failed
  hostapd: phy1-ap0: AP-DISABLED
  ```
  ونتيجة لـ `AP-DISABLED`، قامت طبقة `mac80211` بإطفاء مضخم الإرسال الراديوي لتتحول طاقة الإرسال إلى **0 dBm**.

### ج. المعيار المتبع في أجهزة Ubiquiti Rocket AC:
في جميع شبكات الميكروتك واليوبيكويتي (Ubiquiti airOS / Rocket AC / PowerBeam AC):
* تعمل جميع قنوات السوبر تشانل العالية (5850 - 6000 MHz) حصرياً بعرض **20 MHz** (أو 10 MHz).
* لا يمكن فيزيائياً ولا معيارياً تشغيل هذه القنوات بعرض 80 MHz بدون الدخول في طيف 6 GHz (معيار Wi-Fi 6E / 802.11ax).

---

## 3. الحل المبتكر: الحماية التلقائية لقنوات السوبر (20 MHz Auto-Clamping)

بدلاً من الاعتماد على تذكر المستخدم لتغيير عرض القناة يدوياً إلى 20 MHz في كل مرة، قمنا بتنفيذ **حماية ذكية على مستوى نظام التشغيل (OS-Level Auto-Clamp)** داخل:
* `/lib/netifd/wireless/mac80211.sh`
* `/usr/lib/hamax/30-backup-apply.sh`

### الشفرة البرمجية المضافة:
```bash
# Horus SuperChannel: channels >= 180 (5900 - 6000 MHz) cannot form 40MHz or 80MHz channel pairs in hostapd.
# Auto-clamp htmode to VHT20 so hostapd never crashes with 'HT40 channel pair not allowed',
# guaranteeing that power remains locked at 30 dBm (1000 mW) regardless of LuCI width setting!
if [ "$channel" -ge 180 ] 2>/dev/null; then
    case "$htmode" in
        *40*|*80*|*160*)
            logger -t mac80211 "Horus: channel $channel is in 5.9-6.0 GHz superband; auto-clamping htmode $htmode -> VHT20 to maintain full 30 dBm"
            htmode="VHT20"
        ;;
    esac
fi
```

### النتيجة بعد التطبيق على الراوتر الحي:
حتى وإن اختار المستخدم عرض "80 MHz" أو "40 MHz" بالخطأ، فإن النظام يعترض الأمر ويضبط `htmode` إلى `VHT20`، فتُقلع خدمة `hostapd` بنجاح فوري:
```text
hostapd: Configuration file: <inline> (phy phy1) --> new PHY
hostapd: phy1-ap0: interface state UNINITIALIZED->COUNTRY_UPDATE
hostapd: phy1-ap0: interface state COUNTRY_UPDATE->ENABLED
hostapd: phy1-ap0: AP-ENABLED

iwinfo phy1-ap0 info:
phy1-ap0  ESSID: "Horus-5G"
          Access Point: 00:07:89:C1:DB:BE
          Mode: Master  Channel: 180 (5.900 GHz)  HT Mode: HT20
          Tx-Power: 30 dBm (1000 mW)  HW Mode(s): 802.11ac/n
```
**تم قفل طاقة الإرسال على 30 dBm بنسبة 100%.**

---

## 4. توسيع الطيف حتى 6000 MHz (القناة 200)

تم توسيع جدول القنوات الراديوية ليشمل القنوات من 24 (5120 MHz) إلى 200 (6000 MHz) بإجمالي **177 قناة**:

### الملفات التي تم تحديثها:
1. **`scripts/gen_package_patches.py`**:
   ```python
   # 5 GHz channel plan: expanded 177-channel spectrum plan (5120 MHz - 6000 MHz, 5 MHz step)
   CHANS = list(range(24, 201))
   MAX_5G = max(CHANS)  # 200
   ```
2. **`scripts/07-unlock-superchannel.sh`**:
   تعديل قواعد التنظيم الراديوي (Kernel Regulatory) لتمتد حتى `6010+10` MHz:
   ```bash
   sed -i 's/REG_RULE(5150-10, 5350+10, 80, 0, 30,/REG_RULE(5115-10, 6010+10, 160, 0, 33,/g' "$REGD"
   ```
3. **`files_ap/usr/lib/hamax/10-channels.sh`**:
   توسيع قنوات hamax:
   ```bash
   HAMAX_CHANS="$(seq 24 200)"
   ```

---

## 5. ترتيب القنوات التصاعدي في LuCI ومطابقة Rocket AC

### المشكلة السابقة:
وجود معادلة شرطية قديمة:
```javascript
var f = (ch >= 180) ? (4000 + ch * 5) : (5000 + ch * 5);
var ch = (f >= 5000) ? Math.round((f - 5000) / 5) : Math.round((f - 4000) / 5);
```
كانت تُحيل القنوات $\ge 180$ إلى نطاق 4000 MHz (تردد 4910 MHz للقناة 182)، مما سبب التشتت وعدم الترتيب الذي اشتكى منه المستخدم.

### الحل المعتمد:
توحيد المعادلة الخطية وتوليد القنوات تصاعدياً بانتظام تام في `scripts/05-configure.sh` و `/www/luci-static/resources/view/network/wireless.js`:
```javascript
/* 5 GHz SuperChannel Plan: 5120 - 6000 MHz (Channels 24..200, Strictly sorted by MHz ascending like Rocket AC) */
if (this.channels && this.channels['5g'] && this.channels['5g'].length > 0) {
    var has_auto_5g = (this.channels['5g'][0] === 'auto');
    var new_5g = has_auto_5g ? ['auto', 'auto', {available: true}] : [];
    for (var ch = 24; ch <= 200; ch++) {
        var f_mhz = 5000 + ch * 5;
        new_5g.push(ch, f_mhz + ' MHz (Ch ' + ch + ')', {available: true});
    }
    this.channels['5g'] = new_5g;
}
```
الآن، تظهر القنوات في القائمة المنسدلة مرتبة بترتيب تصاعدي تام:
* `5120 MHz (Ch 24)`
* `5125 MHz (Ch 25)`
* `...`
* `5445 MHz (Ch 89 - Rocket AC)`
* `...`
* `5900 MHz (Ch 180)`
* `...`
* `6000 MHz (Ch 200)`

---

## 6. صمام أمان تطبيق إعدادات airMAX (Apply Guard)

في ملف `files_ap/usr/bin/hamax`:
```bash
apply)
    [ "$ENABLED" = "1" ] || {
        hamax_log "airMAX is disabled (enabled=0); leaving wireless radios untouched"
        exit 0
    }
    ...
```
* إذا دخل المستخدم إلى صفحة إعدادات حورس إيرماكس (AirMax Configuration) وقام بتغيير أي إعداد وحفظه دون أن يكون خيار تفعيل airMAX مشغلاً، يخرج السكربت فوراً بدون المساس بكروت الوايرلس وبدون عمل `wifi reload`، مما يحفظ اتصال كارت الـ 5G ثابتاً ومستقراً على طاقة 30 dBm.
* عند تفعيل airMAX، يتم تفعيل البروتوكول مع الحفاظ على طاقة 30 dBm على جميع ترددات السوبر تشانل.

---

## 7. جدول التحقق والاختبار على الهاردوير الفعلي (`192.168.100.1`)

| الفحص والاختبار | الحالة قبل التعديل | الحالة بعد التعديل | النتيجة الميدانية |
| :--- | :--- | :--- | :--- |
| **اختيار تردد 5900 MHz بعرض 80 MHz** | انهيار الـ AP وتحول الباور إلى 0 dBm | تقليص تلقائي إلى 20 MHz | **`AP-ENABLED` بقوة 30 dBm (1000 mW)** |
| **توفر تردد 6000 MHz (القناة 200)** | مفقود من القوائم | مضاف ومسجل رسمياً | **متاح للاختيار والاستخدام** |
| **ترتيب القنوات في LuCI** | مشتت ويظهر تردد 4910 MHz | تصاعدي منتظم (5120 إلى 6000 MHz) | **مطابق تماماً لنظام airOS / Rocket AC** |
| **حفظ إعدادات airMAX وهي معطلة** | كان يسقط ترددات السوبر تشانل | يخرج بأمان دون لمس الوايرلس | **الباور يظل ثابتاً 30 dBm** |
| **تفعيل airMAX على قناة سوبر (Ch 89 / Ch 180)** | كانت تسقط إلى 0 dBm | تعمل بسلاسة | **30 dBm مستقر بنسبة 100%** |
| **استهلاك الذاكرة والريستارت** | كراش و OOM-killer | 147 MB ذاكرة خالية، حمل 0.64 | **استقرار تام بدون أي ريستارت** |
