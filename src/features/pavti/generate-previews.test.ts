// @vitest-environment jsdom

import { describe, it } from "vitest";
import { render } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { DigitalPavtiCard } from "./components/digital-pavti-card";

const ganpatiConfig = {
  festivalType: "ganpati" as const,
  mandalName: "श्री गणेशा मित्र मंडळ",
  eventName: "सार्वजनिक गणेशोत्सव २०२६",
  yearText: "12 वा वर्ष",
  secretaryName: "अक्षय जोशी",
  secretaryDesignation: "अध्यक्ष / खजिनदार",
};

const ganpatiReceipt = {
  receiptNumber: 1042,
  receiptPrefix: "VP-",
  donorName: "श्री. राहुल शिंदे",
  amount: 501,
  paymentMode: "cash",
  paymentReference: null,
  createdAt: "2026-08-31T13:45:00.000Z",
  buildingName: "गोकुळ धाम",
  buildingWing: "A",
  unitNumber: "402",
  propertyType: "residential",
};

const navratriConfig = {
  festivalType: "navratri" as const,
  mandalName: "श्री शक्ती मित्र मंडळ",
  eventName: "नवरात्रोत्सव २०२६",
  yearText: "12 वा वर्ष",
  secretaryName: "अक्षय जोशी",
  secretaryDesignation: "अध्यक्ष / खजिनदार",
};

const navratriReceipt = {
  receiptNumber: 2081,
  receiptPrefix: "VS-",
  donorName: "सौ. पूजा पाटील",
  amount: 751,
  paymentMode: "upi",
  paymentReference: "UPI-TXN-9922",
  createdAt: "2026-10-05T15:10:00.000Z",
  buildingName: "साई नगर, प्लॉट नं. 15",
  buildingWing: null,
  unitNumber: "Shop 12",
  propertyType: "commercial",
};

const otherConfig = {
  festivalType: "other" as const,
  mandalName: "प्रगती युवा मंडळ",
  eventName: "सामाजिक उपक्रम २०२६",
  yearText: null,
  secretaryName: "अक्षय जोशी",
  secretaryDesignation: "अध्यक्ष / खजिनदार",
};

const otherReceipt = {
  receiptNumber: 3055,
  receiptPrefix: "PYM-",
  donorName: "श्री. अमोल देशमुख",
  amount: 2000,
  paymentMode: "bank_transfer",
  paymentReference: "IMPS-55443322",
  createdAt: "2026-09-12T13:00:00.000Z",
  buildingName: null,
  buildingWing: null,
  unitNumber: null,
  propertyType: null,
};

const longNameConfig = {
  festivalType: "ganpati" as const,
  mandalName: "अखिल भारतीय बाल गोपाळ सार्वजनिक गणेशोत्सव मित्र मंडळ ट्रस्ट, ठाणे (पश्चिम)",
  eventName: "भव्य हीरक महोत्सवी सार्वजनिक गणेशोत्सव सोहळा २०२६",
  yearText: "75 वा वर्ष",
  secretaryName: "अध्यक्ष: ॲड. प्रशांत तांबडे / खजिनदार: विजयराव जगताप",
  secretaryDesignation: "मानद अध्यक्ष व खजिनदार",
};

const longNameReceipt = {
  receiptNumber: 5501,
  receiptPrefix: "ABGM-",
  donorName: "श्रीमती अनुराधा चंद्रशेखर कुलकर्णी-देशपांडे",
  amount: 51000,
  paymentMode: "cheque",
  paymentReference: "CHQ-SBIN-0099882211",
  createdAt: "2026-08-31T14:30:00.000Z",
  buildingName: "श्री स्वामी समर्थ कृपा को-ऑपरेटिव्ह हाउसिंग सोसायटी लि.",
  buildingWing: "Wing-B2",
  unitNumber: "Flat No. 1204-B",
  propertyType: "residential",
};

describe("Generate Visual QA Previews", () => {
  it("generates standalone HTML files for headless browser capture", () => {
    const assetsDir = "c:/VarganiPro-v2/dist/assets";
    const cssFile = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).find((f) => f.startsWith("index-") && f.endsWith(".css"))
      : null;
    const css = cssFile ? fs.readFileSync(path.join(assetsDir, cssFile), "utf8") : "";

    function renderFullHtml(title: string, component: ReactElement) {
      const { container } = render(component);
      const innerHtml = container.innerHTML;
      return `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800;900&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    ${css}
    * { box-sizing: border-box; }
    body {
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      display: inline-block;
      font-family: 'Noto Sans Devanagari', 'Mukta', sans-serif;
    }
    .preview-container {
      width: 864px;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    ${innerHtml}
  </div>
</body>
</html>`;
    }

    const scratchDir = "C:/Users/adity/.gemini/antigravity/brain/c7b28cb3-d5dd-441f-85c7-a73ddab920fd/scratch";
    fs.writeFileSync(path.join(scratchDir, "preview-ganpati.html"), renderFullHtml("Ganpati Pavti", createElement(DigitalPavtiCard, { config: ganpatiConfig, receipt: ganpatiReceipt })));
    fs.writeFileSync(path.join(scratchDir, "preview-navratri.html"), renderFullHtml("Navratri Pavti", createElement(DigitalPavtiCard, { config: navratriConfig, receipt: navratriReceipt })));
    fs.writeFileSync(path.join(scratchDir, "preview-other.html"), renderFullHtml("Other Pavti", createElement(DigitalPavtiCard, { config: otherConfig, receipt: otherReceipt })));
    fs.writeFileSync(path.join(scratchDir, "preview-longname.html"), renderFullHtml("Long Name Stress Test", createElement(DigitalPavtiCard, { config: longNameConfig, receipt: longNameReceipt })));
  });
});
