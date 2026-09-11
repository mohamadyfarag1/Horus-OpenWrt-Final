# Horus OpenWrt Final — Enterprise Carrier-Grade IPQ4019 Firmware

[![Build Status](https://github.com/mohamadyfarag1/Horus-OpenWrt-Final/actions/workflows/build.yml/badge.svg)](https://github.com/mohamadyfarag1/Horus-OpenWrt-Final/actions)
[![License: GPL-2.0](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](LICENSE)
[![SoC: Qualcomm IPQ4019](https://img.shields.io/badge/SoC-Qualcomm%20IPQ4019%20Quad--Core-orange.svg)](https://www.qualcomm.com)
[![Wi-Fi: 162 Channels](https://img.shields.io/badge/Wi--Fi-162%20Channels%20%7C%2030%20dBm-brightgreen.svg)]()
[![Ubiquiti: Rocket AC Interoperable](https://img.shields.io/badge/Ubiquiti-airMAX%20AC%20%2F%20Rocket%20Prism-blueviolet.svg)]()

مشروع **Horus OpenWrt Final** هو التوزيعة البرمجية المتقدمة والمخصصة لأجهزة التوجيه اللاسلكية المعتمدة على معالج كوالكوم **Qualcomm Atheros IPQ4019** (رباعي النواة ARM Cortex-A7 بتردد 716 MHz)، والمصممة لتوفير أداء فائق في الشبكات الميدانية وشركات تزويد خدمة الإنترنت (WISP) ومحطات الربط بعيد المدى.

---

## 🌟 أبرز الإنجازات التقنية (Key Breakthroughs)

### 1. طيف الـ SuperChannel الكامل (162 قناة بترددات 5 MHz)
- كسر القيود القياسية لنطاق 5 GHz وفتح الطيف من **5120 MHz إلى 5925 MHz** بخطوات قفز **5 MHz** منتظمة.
- تشغيل **162 قناة ترددية كاملة** (القنوات 24 إلى 185) نشطة وجاهزة للبث والاتصال.
- طاقة بث كاملة ومعايرة مصنعياً **30.0 dBm (1000 mW)** على كافة الترددات الـ 162 دون أي انخفاض أو تعطيل لأي قناة.

### 2. حل معضلة فيضان ذاكرة الـ DMA لمحرك كوالكوم (Copy Engine 3)
- حل المشكلة الرياضية والبرمجية المزمنة في دريفر `ath10k` التي كانت تتسبب في فيضان ذاكرة SRAM للفيرموير (`send more we can: 3856 bytes > 2048 bytes`)، وانهيار طاقة البث إلى `0.0 dBm` مع إعادة تشغيل دورية للراوتر.
- ابتكار **معمارية الطيف ثنائية الطبقات (Dual-Layer Spectrum Architecture)** التي تحافظ على كامل الـ 162 تردداً لنظام التشغيل و LuCI، مع حماية مسجلات الـ DMA بحزمة مسح خلفي لا تتجاوز 1552 بايت.

### 3. الهندسة العكسية والتوافق التام مع Ubiquiti Rocket Prism 5AC (airMAX)
- فك تشفير شفرة التعارف السرية الخاصة بشركة Ubiquiti Networks (`00:27:22`) من خلال التفكيك الهندسي لوحدة النواة `ubnt_poll_host.ko`.
- حقن حزمة التعارف `dd080027220002040608` في كل من `hostapd` و `wpa_supplicant`.
- تمكين راوترات Horus من كشف والربط المباشر على محطات البث العملاقة **Rocket AC / Rocket Prism** العاملة بنظام **airOS 8.x (Mixed Mode)** بسلاسة تامة.

### 4. مزامنة بيانات Radius فائقة السرعة (Ultra-Fast Radius Sync)
- بنية متطورة لتوزيع وتحديث بيانات المشتركين وجلسات الدخول اللحظية مع خوادم Radius المركزية، مدعومة بواجهة تحكم مدمجة في LuCI.

---

## 📚 التوثيق الهندسي الشامل (Documentation)

| المستند | الوصف | الرابط |
| :--- | :--- | :--- |
| **استقرار الترددات حتى 6000MHz وحماية airMAX** | معمارية الـ 177 قناة حتى 6000 MHz، ونظام التقليص التلقائي (20MHz Auto-Clamp)، وفصل airMAX وحماية الباور. | [SuperChannel 6000MHz & Stability](docs/SuperChannel-6000MHz-Clamping-and-Stability.md) |
| **معمارية فصل وتطابق airMAX** | تفاصيل فصل الترددات بين الكارتين، إلغاء التشفير الإجباري، ومطابقة نظام Ubiquiti airOS. | [airMAX Decoupling Architecture](docs/airMAX-Decoupling-and-Superchannel-Stability-Architecture.md) |
| **المرجع التاريخي الشامل** | القصة الكاملة، التشريح الرياضي لانهيار CE3 DMA، الهندسة العكسية لشفرة الروكت، وسجلات الفحص الحي. | [Master Historical Doc](docs/Master-Historical-Superchannel-and-Rocket-AC-Breakthrough.md) |
| **تحليل وتوافق Rocket AC** | التحليل الهندسي الميداني لمحطة الروكت `192.168.22.77`، وتفكيك كود MIPS لوحدة `ubnt_poll_host.ko`. | [Rocket AC Analysis](docs/Rocket-AC-Analysis-and-Interoperability.md) |
| **جذر المشكلة وحل CE DMA** | التشريح الدقيق لمعمارية Copy Engine 3 وحسابات الـ DMA Buffer في دريفر `ath10k-ct`. | [Root Cause & Solution](docs/Frequency-Expansion-Root-Cause-and-Solution.md) |
| **خارطة طريق الترددات 5MHz** | جدول القنوات الـ 177 التفصيلي من 5120 MHz إلى 6000 MHz وقيم الترددات المركزية. | [Frequency Roadmap](docs/Frequency-Expansion-Roadmap-5MHz.md) |
| **بروتوكول HAMax** | تفاصيل بروتوكول العزل وتوليد الشبكات والنسخ الاحتياطي في فيرموير Horus. | [HAMax Protocol](docs/HAMax-Protocol.md) |
| **بنية مزامنة الـ Radius** | المعمارية التقنية لمزامنة بيانات المشتركين فائقة السرعة مع واجهة LuCI. | [Radius Sync Architecture](docs/Ultra_Fast_Radius_Sync_Architecture.md) |
| **نظام Horus-Spot الهجين وسد الثغرات** | المعمارية الهندسية للكابتف بورتال الهجين المتوافق مع SAS وسد كافة ثغرات الـ DNS والـ IPv6. | [Horus-Spot Hybrid Architecture](docs/Horus-Spot-Hybrid-Captive-Portal-Architecture.md) |

---

## 🛠️ بيانات الفحص الميداني المعتمدة (Production Telemetry)

تم فحص الفيرموير ميدانياً على راوتر Horus IPQ4019 حي متصل بالشبكة:
- **القنوات المسجلة**: 162 قناة كاملة (`iw phy phy1 info`).
- **القنوات بطاقة صفرية**: 0 قناة (جميع القنوات تعمل بقوة 30.0 dBm كاملة).
- **نقطة البث الحالية**: تعمل على القناة 119 (5595 MHz) بعرض 20 MHz وطاقة 30 dBm.
- **حقن حزم الـ Vendor**: مفعل ومؤكد في `/var/run/hostapd-phy0.conf` و `/var/run/hostapd-phy1.conf`.

---

## 🚀 البناء والتطوير (Build Instructions)

يتم بناء النظام آلياً عبر بيئة GitHub Actions المخصصة:
- السكريبتات المساعدة:
  - `scripts/gen_package_patches.py`: توليد باتشات حماية الـ DMA ودريفر `ath10k-ct`.
  - `scripts/build_regdb.py`: توليد وتوقيع قاعدة البيانات التنظيمية المخصصة (SuperChannel RegDB).
  - `build.sh`: سكريبت البناء الشامل للمشروع.

---

## 👥 فريق العمل والمساهمون

- **المهندس:** محمد فرج (Mohamed Farag) — قيادة المشروع، الاختبارات الميدانية، والتوجيه الصارم لرفض التنازل عن الترددات.
- **الذكاء الاصطناعي:** Antigravity (Google DeepMind) — التحليل المعماري للنواة، فك الشفرات الرياضية للـ DMA، والهندسة العكسية لوحدات MIPS.

---
*رُفعت راية حورس — 2026*
