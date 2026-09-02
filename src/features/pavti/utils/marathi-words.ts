const MARATHI_UNITS: Record<number, string> = {
  0: "शून्य",
  1: "एक",
  2: "दोन",
  3: "तीन",
  4: "चार",
  5: "पाच",
  6: "सहा",
  7: "सात",
  8: "आठ",
  9: "नऊ",
  10: "दहा",
  11: "अकरा",
  12: "बारा",
  13: "तेरा",
  14: "चौदा",
  15: "पंधरा",
  16: "सोळा",
  17: "सतरा",
  18: "अठरा",
  19: "एकोणीस",
  20: "वीस",
  21: "एकवीस",
  22: "बावीस",
  23: "तेवीस",
  24: "चोवीस",
  25: "पंचवीस",
  26: "सव्वीस",
  27: "सत्तावीस",
  28: "अठ्ठावीस",
  29: "एकोणतीस",
  30: "तीस",
  31: "एकतीस",
  32: "बत्तीस",
  33: "तेहतीस",
  34: "चौतीस",
  35: "पस्तीस",
  36: "छत्तीस",
  37: "सदतीस",
  38: "अडतीस",
  39: "एकेचाळीस",
  40: "चाळीस",
  41: "एक्केचाळीस",
  42: "बेचाळीस",
  43: "त्रेचाळीस",
  44: "चव्वेचाळीस",
  45: "पंचेचाळीस",
  46: "शेहेचाळीस",
  47: "सत्तेचाळीस",
  48: "अठ्ठेचाळीस",
  49: "एकोणपन्नास",
  50: "पन्नास",
  51: "एकावन्न",
  52: "बावन्न",
  53: "त्रेपन्न",
  54: "चौपन्न",
  55: "पंचावन्न",
  56: "छपन्न",
  57: "सत्तावन्न",
  58: "अठ्ठावन्न",
  59: "एकोणसाठ",
  60: "साठ",
  61: "एकसष्ठ",
  62: "बासष्ठ",
  63: "त्रेसष्ठ",
  64: "चौसष्ठ",
  65: "पासष्ठ",
  66: "सहासष्ठ",
  67: "सदुसष्ठ",
  68: "अडुसष्ठ",
  69: "एकोणसत्तर",
  70: "सत्तर",
  71: "एकाहत्तर",
  72: "बाहत्तर",
  73: "त्र्याहत्तर",
  74: "चौऱ्याहत्तर",
  75: "पंच्याहत्तर",
  76: "शहात्तर",
  77: "सत्त्याहत्तर",
  78: "अठ्ठ्याहत्तर",
  79: "एकोणऐंशी",
  80: "ऐंशी",
  81: "एक्याऐंशी",
  82: "ब्याऐंशी",
  83: "त्र्याऐंशी",
  84: "चौऱ्याऐंशी",
  85: "पंच्याऐंशी",
  86: "शहाऐंशी",
  87: "सत्त्याऐंशी",
  88: "अठ्ठ्याऐंशी",
  89: "एकोणनव्वद",
  90: "नव्वद",
  91: "एक्याण्णव",
  92: "ब्याण्णव",
  93: "त्र्याण्णव",
  94: "चौऱ्याण्णव",
  95: "पंच्याण्णव",
  96: "शहाण्णव",
  97: "सत्त्याण्णव",
  98: "अठ्ठ्याण्णव",
  99: "नव्व्याण्णव",
};

const MARATHI_HUNDREDS: Record<number, string> = {
  1: "एकशे",
  2: "दोनशे",
  3: "तीनशे",
  4: "चारशे",
  5: "पाचशे",
  6: "सहाशे",
  7: "सातशे",
  8: "आठशे",
  9: "नऊशे",
};

function convertTwoDigits(num: number): string {
  if (num === 0) return "";
  return MARATHI_UNITS[num] || "";
}

function convertThreeDigits(num: number): string {
  if (num === 0) return "";
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;

  const parts: string[] = [];
  if (hundred > 0) {
    if (hundred === 1 && remainder === 0) {
      parts.push("शंभर");
    } else {
      parts.push(MARATHI_HUNDREDS[hundred] || `${MARATHI_UNITS[hundred]} शे`);
    }
  }

  if (remainder > 0) {
    parts.push(convertTwoDigits(remainder));
  }

  return parts.join(" ");
}

/**
 * Converts a positive number up to 99,99,99,999 into Marathi words.
 * Example: 501 -> "रुपये पाचशे एक मात्र"
 */
export function numberToMarathiWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "रुपये शून्य मात्र";
  }

  const integerAmount = Math.floor(amount);
  if (integerAmount === 0) {
    return "रुपये शून्य मात्र";
  }

  const crores = Math.floor(integerAmount / 10000000);
  let remaining = integerAmount % 10000000;

  const lakhs = Math.floor(remaining / 100000);
  remaining %= 100000;

  const thousands = Math.floor(remaining / 1000);
  remaining %= 1000;

  const hundredsAndBelow = remaining;

  const parts: string[] = [];

  if (crores > 0) {
    parts.push(`${convertTwoDigits(crores)} कोटी`);
  }

  if (lakhs > 0) {
    parts.push(`${convertTwoDigits(lakhs)} लाख`);
  }

  if (thousands > 0) {
    parts.push(`${convertTwoDigits(thousands)} हजार`);
  }

  if (hundredsAndBelow > 0) {
    parts.push(convertThreeDigits(hundredsAndBelow));
  }

  const words = parts.filter(Boolean).join(" ");
  return `रुपये ${words} मात्र`;
}
