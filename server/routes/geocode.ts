import express from "express";
import { normalizeArabic, stripDefiniteArticle, scoreArabicMatch } from "../utils/arabic-search";
import { storage } from "../storage";

const router = express.Router();

// Rich regional & global known places database for instantaneous zero-latency matching
const KNOWN_PLACES = [
  // مدن ومناطق يمنية
  { name: "صنعاء", fullName: "مدينة صنعاء، اليمن", lat: 15.3694, lng: 44.1910, country: "اليمن" },
  { name: "حدة", fullName: "حي حدة، مديرية السبعين، صنعاء، اليمن", lat: 15.3188, lng: 44.1963, country: "اليمن" },
  { name: "شارع حدة", fullName: "شارع حدة الرئيسي، صنعاء، اليمن", lat: 15.3214, lng: 44.1945, country: "اليمن" },
  { name: "السبعين", fullName: "ميدان السبعين، صنعاء، اليمن", lat: 15.3367, lng: 44.2045, country: "اليمن" },
  { name: "التحرير", fullName: "ميدان التحرير، وسط صنعاء، اليمن", lat: 15.3533, lng: 44.2078, country: "اليمن" },
  { name: "شارع الزبيري", fullName: "شارع الزبيري، صنعاء، اليمن", lat: 15.3508, lng: 44.2012, country: "اليمن" },
  { name: "شارع الستين", fullName: "شارع الستين الغربي، صنعاء، اليمن", lat: 15.3421, lng: 44.1754, country: "اليمن" },
  { name: "شارع الخمسين", fullName: "شارع الخمسين، صنعاء، اليمن", lat: 15.3056, lng: 44.1989, country: "اليمن" },
  { name: "بيت بوس", fullName: "حي بيت بوس، جنوب صنعاء، اليمن", lat: 15.2845, lng: 44.2034, country: "اليمن" },
  { name: "الأصبحي", fullName: "حي الأصبحي، صنعاء، اليمن", lat: 15.3012, lng: 44.2156, country: "اليمن" },
  { name: "شميلة", fullName: "سوق شميلة، صنعاء، اليمن", lat: 15.3167, lng: 44.2250, country: "اليمن" },
  { name: "الحصبة", fullName: "حي الحصبة، شمال صنعاء، اليمن", lat: 15.3850, lng: 44.2056, country: "اليمن" },
  { name: "باب اليمن", fullName: "باب اليمن، صنعاء القديمة، اليمن", lat: 15.3522, lng: 44.2158, country: "اليمن" },
  { name: "صنعاء القديمة", fullName: "مدينة صنعاء القديمة، صنعاء، اليمن", lat: 15.3547, lng: 44.2144, country: "اليمن" },
  { name: "الروضة", fullName: "منطقة الروضة، شمال صنعاء، اليمن", lat: 15.4200, lng: 44.2200, country: "اليمن" },
  { name: "مذبح", fullName: "منطقة مذبح، غرب صنعاء، اليمن", lat: 15.3720, lng: 44.1680, country: "اليمن" },
  { name: "شملان", fullName: "منطقة شملان، شمال غرب صنعاء، اليمن", lat: 15.4050, lng: 44.1500, country: "اليمن" },
  { name: "الجراف", fullName: "حي الجراف، شمال صنعاء، اليمن", lat: 15.3900, lng: 44.2100, country: "اليمن" },
  { name: "عصر", fullName: "منطقة عصر، غرب صنعاء، اليمن", lat: 15.3350, lng: 44.1650, country: "اليمن" },
  { name: "شارع صخر", fullName: "شارع صخر، المتفرع من شارع بغداد، صنعاء، اليمن", lat: 15.3410, lng: 44.1980, country: "اليمن" },
  { name: "شارع بغداد", fullName: "شارع بغداد، صنعاء، اليمن", lat: 15.3430, lng: 44.1990, country: "اليمن" },
  { name: "شارع الجزائر", fullName: "شارع الجزائر، صنعاء، اليمن", lat: 15.3380, lng: 44.1950, country: "اليمن" },
  { name: "شارع تعز", fullName: "شارع تعز، جنوب صنعاء، اليمن", lat: 15.3100, lng: 44.2300, country: "اليمن" },
  { name: "جولة الرويشان", fullName: "جولة الرويشان، شارع حدة، صنعاء، اليمن", lat: 15.3355, lng: 44.1972, country: "اليمن" },
  { name: "جولة المصباحي", fullName: "جولة المصباحي، شارع حدة، صنعاء، اليمن", lat: 15.3210, lng: 44.1940, country: "اليمن" },
  { name: "جولة عصر", fullName: "جولة عصر، صنعاء، اليمن", lat: 15.3340, lng: 44.1660, country: "اليمن" },
  { name: "مستشفى الثورة", fullName: "مستشفى الثورة العام، صنعاء، اليمن", lat: 15.3580, lng: 44.2250, country: "اليمن" },
  { name: "جامعة صنعاء", fullName: "جامعة صنعاء الجديدة، الدائري الغربي، صنعاء، اليمن", lat: 15.3680, lng: 44.1820, country: "اليمن" },

  // عدن وأحيائها
  { name: "عدن", fullName: "مدينة عدن، اليمن", lat: 12.7855, lng: 45.0187, country: "اليمن" },
  { name: "كريتر", fullName: "مديرية كريتر (صيرة)، عدن، اليمن", lat: 12.7750, lng: 45.0350, country: "اليمن" },
  { name: "المعلا", fullName: "مديرية المعلا، عدن، اليمن", lat: 12.7880, lng: 45.0020, country: "اليمن" },
  { name: "التواهي", fullName: "مديرية التواهي، عدن، اليمن", lat: 12.7820, lng: 44.9850, country: "اليمن" },
  { name: "خور مكسر", fullName: "مديرية خور مكسر، عدن، اليمن", lat: 12.8250, lng: 45.0400, country: "اليمن" },
  { name: "المنصورة", fullName: "مديرية المنصورة، عدن، اليمن", lat: 12.8600, lng: 44.9950, country: "اليمن" },
  { name: "الشيخ عثمان", fullName: "مديرية الشيخ عثمان، عدن، اليمن", lat: 12.8750, lng: 45.0050, country: "اليمن" },
  { name: "دار سعد", fullName: "مديرية دار سعد، عدن، اليمن", lat: 12.9000, lng: 45.0000, country: "اليمن" },
  { name: "إنماء", fullName: "مدينة إنماء السكنية، المنصورة، عدن، اليمن", lat: 12.8550, lng: 44.9600, country: "اليمن" },

  // تعز
  { name: "تعز", fullName: "مدينة تعز، اليمن", lat: 13.5775, lng: 44.0189, country: "اليمن" },
  { name: "شارع جمال", fullName: "شارع جمال عبدالناصر، وسط تعز، اليمن", lat: 13.5790, lng: 44.0150, country: "اليمن" },
  { name: "الحوبان", fullName: "منطقة الحوبان، تعز، اليمن", lat: 13.6150, lng: 44.0850, country: "اليمن" },
  { name: "بير باشا", fullName: "منطقة بير باشا، غرب تعز، اليمن", lat: 13.5700, lng: 43.9850, country: "اليمن" },

  // إب
  { name: "إب", fullName: "مدينة إب اللواء الأخضر، اليمن", lat: 13.9753, lng: 44.1708, country: "اليمن" },
  { name: "المشنة", fullName: "مديرية المشنة، إب، اليمن", lat: 13.9680, lng: 44.1780, country: "اليمن" },
  { name: "الظهار", fullName: "مديرية الظهار، إب، اليمن", lat: 13.9850, lng: 44.1650, country: "اليمن" },
  { name: "شارع العدين", fullName: "شارع العدين، إب، اليمن", lat: 13.9730, lng: 44.1720, country: "اليمن" },

  // حضرموت والمكلا
  { name: "المكلا", fullName: "مدينة المكلا، ساحل حضرموت، اليمن", lat: 14.5425, lng: 49.1242, country: "اليمن" },
  { name: "سيئون", fullName: "مدينة سيئون، وادي حضرموت، اليمن", lat: 15.9380, lng: 48.7880, country: "اليمن" },
  { name: "الشرج", fullName: "حي الشرج، المكلا، حضرموت، اليمن", lat: 14.5380, lng: 49.1200, country: "اليمن" },
  { name: "فوه", fullName: "منطقة فوه، المكلا، حضرموت، اليمن", lat: 14.5200, lng: 49.0700, country: "اليمن" },

  // الحديدة
  { name: "الحديدة", fullName: "مدينة الحديدة، عروس البحر الأحمر، اليمن", lat: 14.7978, lng: 42.9545, country: "اليمن" },
  { name: "شارع الميناء", fullName: "شارع الميناء، الحديدة، اليمن", lat: 14.8050, lng: 42.9480, country: "اليمن" },
  { name: "شارع صنعاء بالحديدة", fullName: "شارع صنعاء، الحديدة، اليمن", lat: 14.7920, lng: 42.9700, country: "اليمن" },

  // مدن ومحافظات يمنية أخرى
  { name: "ذمار", fullName: "مدينة ذمار، اليمن", lat: 14.5428, lng: 44.4056, country: "اليمن" },
  { name: "مأرب", fullName: "مدينة مأرب، اليمن", lat: 15.4628, lng: 45.3253, country: "اليمن" },
  { name: "عمران", fullName: "مدينة عمران، اليمن", lat: 15.6594, lng: 43.9408, country: "اليمن" },
  { name: "صعدة", fullName: "مدينة صعدة، اليمن", lat: 16.9400, lng: 43.7636, country: "اليمن" },
  { name: "حجة", fullName: "مدينة حجة، اليمن", lat: 15.6944, lng: 43.6033, country: "اليمن" },
  { name: "لحج", fullName: "مدينة الحوطة، لحج، اليمن", lat: 13.0600, lng: 44.8800, country: "اليمن" },
  { name: "أبين", fullName: "مدينة زنجبار، أبين، اليمن", lat: 13.1289, lng: 45.3808, country: "اليمن" },
  { name: "شبوة", fullName: "مدينة عتق، شبوة، اليمن", lat: 14.5378, lng: 46.8319, country: "اليمن" },
  { name: "المهرة", fullName: "مدينة الغيضة، المهرة، اليمن", lat: 16.2081, lng: 52.1764, country: "اليمن" },
  { name: "سقطرى", fullName: "مدينة حديبو، أرخبيل سقطرى، اليمن", lat: 12.6500, lng: 54.0200, country: "اليمن" },

  // عواصم ومدن عربية وعالمية بارزة
  { name: "مكة المكرمة", fullName: "مكة المكرمة، المملكة العربية السعودية", lat: 21.3891, lng: 39.8579, country: "السعودية" },
  { name: "المدينة المنورة", fullName: "المدينة المنورة، المملكة العربية السعودية", lat: 24.5247, lng: 39.5692, country: "السعودية" },
  { name: "الرياض", fullName: "مدينة الرياض، عاصمة المملكة العربية السعودية", lat: 24.7136, lng: 46.6753, country: "السعودية" },
  { name: "العليا الرياض", fullName: "حي العليا، الرياض، المملكة العربية السعودية", lat: 24.6980, lng: 46.6850, country: "السعودية" },
  { name: "جدة", fullName: "مدينة جدة، المملكة العربية السعودية", lat: 21.5433, lng: 39.1728, country: "السعودية" },
  { name: "الدمام", fullName: "مدينة الدمام، المنطقة الشرقية، المملكة العربية السعودية", lat: 26.4207, lng: 50.0888, country: "السعودية" },
  { name: "الخبر", fullName: "مدينة الخبر، المملكة العربية السعودية", lat: 26.2172, lng: 50.1971, country: "السعودية" },
  { name: "أبها", fullName: "مدينة أبها، منطقة عسير، المملكة العربية السعودية", lat: 18.2164, lng: 42.5053, country: "السعودية" },
  { name: "خميس مشيط", fullName: "مدينة خميس مشيط، المملكة العربية السعودية", lat: 18.3000, lng: 42.7333, country: "السعودية" },
  { name: "جازان", fullName: "مدينة جازان، المملكة العربية السعودية", lat: 16.8892, lng: 42.5511, country: "السعودية" },
  { name: "نجران", fullName: "مدينة نجران، المملكة العربية السعودية", lat: 17.4933, lng: 44.1277, country: "السعودية" },
  { name: "دبي", fullName: "إمارة دبي، الإمارات العربية المتحدة", lat: 25.2048, lng: 55.2708, country: "الإمارات" },
  { name: "أبوظبي", fullName: "مدينة أبوظبي، عاصمة الإمارات العربية المتحدة", lat: 24.4539, lng: 54.3773, country: "الإمارات" },
  { name: "الشارقة", fullName: "إمارة الشارقة، الإمارات العربية المتحدة", lat: 25.3573, lng: 55.4033, country: "الإمارات" },
  { name: "عجمان", fullName: "إمارة عجمان، الإمارات العربية المتحدة", lat: 25.4052, lng: 55.5136, country: "الإمارات" },
  { name: "رأس الخيمة", fullName: "إمارة رأس الخيمة، الإمارات العربية المتحدة", lat: 25.7895, lng: 55.9432, country: "الإمارات" },
  { name: "الفجيرة", fullName: "إمارة الفجيرة، الإمارات العربية المتحدة", lat: 25.1288, lng: 56.3265, country: "الإمارات" },
  { name: "الدوحة", fullName: "مدينة الدوحة، عاصمة قطر", lat: 25.2854, lng: 51.5310, country: "قطر" },
  { name: "الكويت", fullName: "مدينة الكويت، عاصمة الكويت", lat: 29.3759, lng: 47.9774, country: "الكويت" },
  { name: "المنامة", fullName: "مدينة المنامة، عاصمة البحرين", lat: 26.2285, lng: 50.5860, country: "البحرين" },
  { name: "مسقط", fullName: "مدينة مسقط، عاصمة سلطنة عمان", lat: 23.5880, lng: 58.3829, country: "عمان" },
  { name: "صلالة", fullName: "مدينة صلالة، سلطنة عمان", lat: 17.0151, lng: 54.0924, country: "عمان" },
  { name: "القاهرة", fullName: "مدينة القاهرة، جمهورية مصر العربية", lat: 30.0444, lng: 31.2357, country: "مصر" },
  { name: "الجيزة", fullName: "مدينة الجيزة، جمهورية مصر العربية", lat: 30.0131, lng: 31.2089, country: "مصر" },
  { name: "الإسكندرية", fullName: "مدينة الإسكندرية، مصر", lat: 31.2001, lng: 29.9187, country: "مصر" },
  { name: "شرم الشيخ", fullName: "مدينة شرم الشيخ، جنوب سيناء، مصر", lat: 27.9158, lng: 34.3299, country: "مصر" },
  { name: "عمان", fullName: "مدينة عمّان، عاصمة المملكة الأردنية الهاشمية", lat: 31.9454, lng: 35.9284, country: "الأردن" },
  { name: "إربد", fullName: "مدينة إربد، المملكة الأردنية الهاشمية", lat: 32.5568, lng: 35.8469, country: "الأردن" },
  { name: "العقبة", fullName: "مدينة العقبة، الأردن", lat: 29.5320, lng: 35.0063, country: "الأردن" },
  { name: "دمشق", fullName: "مدينة دمشق، عاصمة سوريا", lat: 33.5138, lng: 36.2765, country: "سوريا" },
  { name: "حلب", fullName: "مدينة حلب، سوريا", lat: 36.2021, lng: 37.1343, country: "سوريا" },
  { name: "بيروت", fullName: "مدينة بيروت، عاصمة لبنان", lat: 33.8938, lng: 35.5018, country: "لبنان" },
  { name: "طرابلس لبنان", fullName: "مدينة طرابلس، شمال لبنان", lat: 34.4367, lng: 35.8497, country: "لبنان" },
  { name: "بغداد", fullName: "مدينة بغداد، عاصمة العراق", lat: 33.3152, lng: 44.3661, country: "العراق" },
  { name: "البصرة", fullName: "مدينة البصرة، جنوب العراق", lat: 30.5085, lng: 47.7804, country: "العراق" },
  { name: "أربيل", fullName: "مدينة أربيل، إقليم كردستان العراق", lat: 36.1901, lng: 44.0091, country: "العراق" },
  { name: "الموصل", fullName: "مدينة الموصل، نينوى، العراق", lat: 36.3400, lng: 43.1300, country: "العراق" },
  { name: "القدس", fullName: "مدينة القدس الشريف، فلسطين", lat: 31.7683, lng: 35.2137, country: "فلسطين" },
  { name: "رام الله", fullName: "مدينة رام الله، الضفة الغربية، فلسطين", lat: 31.9038, lng: 35.2034, country: "فلسطين" },
  { name: "نابلس", fullName: "مدينة نابلس، الضفة الغربية، فلسطين", lat: 32.2211, lng: 35.2544, country: "فلسطين" },
  { name: "الخليل", fullName: "مدينة الخليل، الضفة الغربية، فلسطين", lat: 31.5326, lng: 35.0998, country: "فلسطين" },
  { name: "غزة", fullName: "مدينة غزة، قطاع غزة، فلسطين", lat: 31.5017, lng: 34.4668, country: "فلسطين" },
  { name: "الخرطوم", fullName: "مدينة الخرطوم، عاصمة السودان", lat: 15.5007, lng: 32.5599, country: "السودان" },
  { name: "بورتسودان", fullName: "مدينة بورتسودان، البحر الأحمر، السودان", lat: 19.6175, lng: 37.2164, country: "السودان" },
  { name: "طرابلس", fullName: "مدينة طرابلس، عاصمة ليبيا", lat: 32.8872, lng: 13.1913, country: "ليبيا" },
  { name: "بنغازي", fullName: "مدينة بنغازي، شرق ليبيا", lat: 32.1167, lng: 20.0667, country: "ليبيا" },
  { name: "تونس", fullName: "مدينة تونس، عاصمة الجمهورية التونسية", lat: 36.8065, lng: 10.1815, country: "تونس" },
  { name: "سوسة", fullName: "مدينة سوسة، تونس", lat: 35.8256, lng: 10.6369, country: "تونس" },
  { name: "صفاقس", fullName: "مدينة صفاقس، تونس", lat: 34.7406, lng: 10.7603, country: "تونس" },
  { name: "الجزائر", fullName: "مدينة الجزائر العاصمة، الجمهورية الجزائرية", lat: 36.7538, lng: 3.0588, country: "الجزائر" },
  { name: "وهران", fullName: "مدينة وهران، غرب الجزائر", lat: 35.6971, lng: -0.6308, country: "الجزائر" },
  { name: "قسنطينة", fullName: "مدينة قسنطينة، شرق الجزائر", lat: 36.3650, lng: 6.6147, country: "الجزائر" },
  { name: "الرباط", fullName: "مدينة الرباط، عاصمة المملكة المغربية", lat: 34.0209, lng: -6.8416, country: "المغرب" },
  { name: "الدار البيضاء", fullName: "مدينة الدار البيضاء (كازابلانكا)، المغرب", lat: 33.5731, lng: -7.5898, country: "المغرب" },
  { name: "مراكش", fullName: "مدينة مراكش، المغرب", lat: 31.6295, lng: -7.9811, country: "المغرب" },
  { name: "طنجة", fullName: "مدينة طنجة، شمال المغرب", lat: 35.7595, lng: -5.8340, country: "المغرب" },
  { name: "فاس", fullName: "مدينة فاس، المغرب", lat: 34.0333, lng: -5.0000, country: "المغرب" },
  { name: "نواكشوط", fullName: "مدينة نواكشوط، عاصمة موريتانيا", lat: 18.0735, lng: -15.9582, country: "موريتانيا" },
  { name: "مقديشو", fullName: "مدينة مقديشو، عاصمة الصومال", lat: 2.0469, lng: 45.3182, country: "الصومال" },
  { name: "جيبوتي", fullName: "مدينة جيبوتي، عاصمة جمهورية جيبوتي", lat: 11.5721, lng: 43.1456, country: "جيبوتي" },
  { name: "اسطنبول", fullName: "مدينة اسطنبول، تركيا", lat: 41.0082, lng: 28.9784, country: "تركيا" },
  { name: "أنقرة", fullName: "مدينة أنقرة، عاصمة تركيا", lat: 39.9334, lng: 32.8597, country: "تركيا" },
  { name: "أنطاليا", fullName: "مدينة أنطاليا، تركيا", lat: 36.8969, lng: 30.7133, country: "تركيا" },
  { name: "لندن", fullName: "مدينة لندن، عاصمة المملكة المتحدة", lat: 51.5074, lng: -0.1278, country: "بريطانيا" },
  { name: "باريس", fullName: "مدينة باريس، عاصمة فرنسا", lat: 48.8566, lng: 2.3522, country: "فرنسا" },
  { name: "برلين", fullName: "مدينة برلين، عاصمة ألمانيا", lat: 52.5200, lng: 13.4050, country: "ألمانيا" },
  { name: "ميونخ", fullName: "مدينة ميونخ، بافاريا، ألمانيا", lat: 48.1351, lng: 11.5820, country: "ألمانيا" },
  { name: "روما", fullName: "مدينة روما، عاصمة إيطاليا", lat: 41.9028, lng: 12.4964, country: "إيطاليا" },
  { name: "ميلانو", fullName: "مدينة ميلانو، إيطاليا", lat: 45.4642, lng: 9.1900, country: "إيطاليا" },
  { name: "مدريد", fullName: "مدينة مدريد، عاصمة إسبانيا", lat: 40.4168, lng: -3.7038, country: "إسبانيا" },
  { name: "برشلونة", fullName: "مدينة برشلونة، إسبانيا", lat: 41.3879, lng: 2.1699, country: "إسبانيا" },
  { name: "أمستردام", fullName: "مدينة أمستردام، عاصمة هولندا", lat: 52.3676, lng: 4.9041, country: "هولندا" },
  { name: "بروكسل", fullName: "مدينة بروكسل، عاصمة بلجيكا", lat: 50.8503, lng: 4.3517, country: "بلجيكا" },
  { name: "فيينا", fullName: "مدينة فيينا، عاصمة النمسا", lat: 48.2082, lng: 16.3738, country: "النمسا" },
  { name: "جنيف", fullName: "مدينة جنيف، سويسرا", lat: 46.2044, lng: 6.1432, country: "سويسرا" },
  { name: "زيورخ", fullName: "مدينة زيورخ، سويسرا", lat: 47.3769, lng: 8.5417, country: "سويسرا" },
  { name: "نيويورك", fullName: "مدينة نيويورك، الولايات المتحدة الأمريكية", lat: 40.7128, lng: -74.0060, country: "أمريكا" },
  { name: "واشنطن", fullName: "مدينة واشنطن العاصمة، الولايات المتحدة الأمريكية", lat: 38.9072, lng: -77.0369, country: "أمريكا" },
  { name: "لوس أنجلوس", fullName: "مدينة لوس أنجلوس، كاليفورنيا، أمريكا", lat: 34.0522, lng: -118.2437, country: "أمريكا" },
  { name: "شيكاغو", fullName: "مدينة شيكاغو، إلينوي، أمريكا", lat: 41.8781, lng: -87.6298, country: "أمريكا" },
  { name: "هيوستن", fullName: "مدينة هيوستن، تكساس، أمريكا", lat: 29.7604, lng: -95.3698, country: "أمريكا" },
  { name: "تورونتو", fullName: "مدينة تورونتو، كندا", lat: 43.6532, lng: -79.3832, country: "كندا" },
  { name: "مونتريال", fullName: "مدينة مونتريال، كندا", lat: 45.5017, lng: -73.5673, country: "كندا" },
  { name: "طوكيو", fullName: "مدينة طوكيو، عاصمة اليابان", lat: 35.6762, lng: 139.6503, country: "اليابان" },
  { name: "بكين", fullName: "مدينة بكين، عاصمة الصين", lat: 39.9042, lng: 116.4074, country: "الصين" },
  { name: "شنغهاي", fullName: "مدينة شنغهاي، الصين", lat: 31.2304, lng: 121.4737, country: "الصين" },
  { name: "سيول", fullName: "مدينة سيول، عاصمة كوريا الجنوبية", lat: 37.5665, lng: 126.9780, country: "كوريا" },
  { name: "سنغافورة", fullName: "جمهورية سنغافورة", lat: 1.3521, lng: 103.8198, country: "سنغافورة" },
  { name: "كوالالمبور", fullName: "مدينة كوالالمبور، عاصمة ماليزيا", lat: 3.1390, lng: 101.6869, country: "ماليزيا" },
  { name: "جاكرتا", fullName: "مدينة جاكرتا، عاصمة إندونيسيا", lat: -6.2088, lng: 106.8456, country: "إندونيسيا" },
  { name: "سيدني", fullName: "مدينة سيدني، أستراليا", lat: -33.8688, lng: 151.2093, country: "أستراليا" },
  { name: "ملبورن", fullName: "مدينة ملبورن، أستراليا", lat: -37.8136, lng: 144.9631, country: "أستراليا" },
  { name: "موسكو", fullName: "مدينة موسكو، عاصمة روسيا", lat: 55.7558, lng: 37.6173, country: "روسيا" }
];

interface ScoredResult {
  display_name: string;
  lat: string;
  lon: string;
  score: number;
  source: string;
}

/**
 * GET /api/geocode/search?q=... (High-Precision Character-Sensitive & Normalized Worldwide Search)
 */
router.get("/search", async (req, res) => {
  try {
    const rawQuery = (req.query.q as string || "").trim();
    if (!rawQuery) {
      return res.json([]);
    }

    // 1. Direct coordinate format matching (e.g. "24.7136, 46.6753" or "15.3694 44.1910")
    const coordMatch = rawQuery.match(/^([-+]?\d+(\.\d+)?)[,\s]+([-+]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return res.json([
          {
            display_name: `إحداثيات محددة (${lat.toFixed(6)}, ${lon.toFixed(6)})`,
            lat: lat.toString(),
            lon: lon.toString(),
            source: "coordinates"
          }
        ]);
      }
    }

    const scoredResults: ScoredResult[] = [];
    const seenCoordinates = new Set<string>();

    const addResult = (item: { display_name: string; lat: string | number; lon: string | number; score?: number; source?: string }) => {
      const key = `${Number(item.lat).toFixed(4)},${Number(item.lon).toFixed(4)}`;
      if (!seenCoordinates.has(key)) {
        seenCoordinates.add(key);
        scoredResults.push({
          display_name: item.display_name,
          lat: item.lat.toString(),
          lon: item.lon.toString(),
          score: item.score ?? 50,
          source: item.source || "global_db"
        });
      }
    };

    // 2. High-precision character-sensitive matching against local stores in database
    try {
      const dbStores = await storage.getRestaurants();
      if (Array.isArray(dbStores)) {
        for (const store of dbStores) {
          if (!store.latitude || !store.longitude) continue;
          
          const nameScore = scoreArabicMatch(store.name, rawQuery);
          const addressScore = scoreArabicMatch(store.address, rawQuery);
          const maxScore = Math.max(nameScore, addressScore);

          if (maxScore > 0) {
            addResult({
              display_name: `${store.name} - ${store.address || "متجر مسجل في النظام"}`,
              lat: store.latitude,
              lon: store.longitude,
              score: maxScore + 500, // priority for registered stores
              source: "system_store"
            });
          }
        }
      }
    } catch (dbErr) {
      // Non-blocking
    }

    // 3. Search in instant global and regional locations database with deep Arabic scoring
    for (const place of KNOWN_PLACES) {
      const nameScore = scoreArabicMatch(place.name, rawQuery);
      const fullScore = scoreArabicMatch(place.fullName, rawQuery);
      const countryScore = scoreArabicMatch(place.country, rawQuery);
      const maxScore = Math.max(nameScore, fullScore, countryScore * 0.7);

      if (maxScore > 0) {
        addResult({
          display_name: place.fullName,
          lat: place.lat,
          lon: place.lng,
          score: maxScore + 200,
          source: "known_db"
        });
      }
    }

    // 4. Search Worldwide using OpenStreetMap Nominatim with multiple query variants
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Clean query variants: raw, normalized, and trimmed
      const cleanNorm = normalizeArabic(rawQuery);
      const queryVariants = Array.from(new Set([rawQuery, cleanNorm])).filter(Boolean);

      for (const qVar of queryVariants) {
        if (scoredResults.length >= 8) break;
        const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(qVar)}&accept-language=ar,en&addressdetails=1&limit=6`;
        const osmRes = await fetch(osmUrl, {
          headers: {
            "User-Agent": "SarieOne-Precision-App/1.0 (contact@sarieone.app)",
            "Accept-Language": "ar,en"
          },
          signal: controller.signal
        });

        if (osmRes.ok) {
          const osmData: any[] = await osmRes.json();
          if (Array.isArray(osmData)) {
            for (const item of osmData) {
              const relevance = scoreArabicMatch(item.display_name, rawQuery);
              addResult({
                display_name: item.display_name,
                lat: item.lat,
                lon: item.lon,
                score: relevance > 0 ? relevance + 100 : 75,
                source: "osm_global"
              });
            }
          }
        }
      }
      clearTimeout(timeoutId);
    } catch (osmErr) {
      // Non-blocking fallback
    }

    // 5. Search Worldwide using Photon (Komoot Global OpenStreetMap API)
    if (scoredResults.length < 6) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawQuery)}&lang=default&limit=6`;
        const photonRes = await fetch(photonUrl, { signal: controller.signal });
        if (photonRes.ok) {
          const photonData: any = await photonRes.json();
          if (photonData?.features && Array.isArray(photonData.features)) {
            for (const feat of photonData.features) {
              const coords = feat.geometry?.coordinates;
              const props = feat.properties;
              if (coords && coords.length >= 2) {
                const titleParts = [props.name, props.street, props.district, props.city, props.state, props.country]
                  .filter(Boolean);
                const title = titleParts.length > 0 ? titleParts.join("، ") : rawQuery;
                const relevance = scoreArabicMatch(title, rawQuery);
                addResult({
                  display_name: title,
                  lat: coords[1],
                  lon: coords[0],
                  score: relevance > 0 ? relevance + 50 : 50,
                  source: "photon_global"
                });
              }
            }
          }
        }
        clearTimeout(timeoutId);
      } catch (photonErr) {
        // Non-blocking fallback
      }
    }

    // Sort all results strictly by relevance score descending (most accurate on top)
    scoredResults.sort((a, b) => b.score - a.score);

    return res.json(scoredResults.map(({ display_name, lat, lon, source }) => ({ display_name, lat, lon, source })));
  } catch (err) {
    console.error("Global geocoding search error:", err);
    return res.status(500).json({ error: "Global search failed" });
  }
});

/**
 * GET /api/geocode/reverse?lat=...&lng=... (Worldwide Reverse Geocoding)
 */
router.get("/reverse", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat((req.query.lng || req.query.lon) as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // 1. Worldwide OpenStreetMap reverse geocoding
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ar,en`;
      const osmRes = await fetch(url, {
        headers: {
          "User-Agent": "SarieOne-Precision-App/1.0 (contact@sarieone.app)",
          "Accept-Language": "ar,en"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (osmRes.ok) {
        const data: any = await osmRes.json();
        if (data && data.display_name) {
          return res.json({
            display_name: data.display_name,
            address: data.address,
            lat,
            lng
          });
        }
      }
    } catch (e) {
      // Ignore and fallback
    }

    // 2. Find closest known landmark globally
    let closestPlace = null;
    let minDistance = Infinity;

    for (const place of KNOWN_PLACES) {
      const dLat = (place.lat - lat) * 111;
      const dLng = (place.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      if (distKm < minDistance) {
        minDistance = distKm;
        closestPlace = place;
      }
    }

    if (closestPlace && minDistance < 10) {
      return res.json({
        display_name: `بالقرب من ${closestPlace.fullName}`,
        lat,
        lng
      });
    }

    return res.json({
      display_name: `الموقع المحدد (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      lat,
      lng
    });
  } catch (err) {
    console.error("Reverse geocoding error:", err);
    return res.status(500).json({ error: "Reverse geocoding failed" });
  }
});

export default router;
