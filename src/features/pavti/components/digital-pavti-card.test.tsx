// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DigitalPavtiCard } from "./digital-pavti-card";
import type { PavtiTemplateConfig, PavtiReceiptData } from "../types/pavti.types";

const baseConfig: PavtiTemplateConfig = {
  festivalType: "ganpati",
  mandalName: "श्री गणेशा मित्र मंडळ",
  eventName: "सार्वजनिक गणेशोत्सव २०२६",
  yearText: "12 वा वर्ष",
  secretaryName: "अक्षय जोशी",
  secretaryDesignation: "अध्यक्ष / खजिनदार",
};

const baseReceipt: PavtiReceiptData = {
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

describe("DigitalPavtiCard Component Tests", () => {
  afterEach(() => {
    cleanup();
  });

  // 1, 2, 3: Ganpati specific behavior
  it("1, 2, 3: Ganpati configuration renders Ganesha artwork, top mantra, and bottom greeting", () => {
    render(<DigitalPavtiCard config={{ ...baseConfig, festivalType: "ganpati" }} receipt={baseReceipt} />);

    // Ganesha artwork
    expect(screen.getByRole("img", { name: /Lord Ganesha/i })).toBeDefined();
    // Top devotional line
    expect(screen.getByText(/॥ श्री गणेशाय नमः ॥/i)).toBeDefined();
    // Bottom devotional greeting
    expect(screen.getByText(/गणपती बाप्पा मोरया ! 🙏/i)).toBeDefined();
  });

  // 4, 5, 6: Navratri specific behavior
  it("4, 5, 6: Navratri configuration renders Durga Maa artwork, top mantra, and bottom greeting", () => {
    render(
      <DigitalPavtiCard
        config={{
          ...baseConfig,
          festivalType: "navratri",
          mandalName: "श्री शक्ती मित्र मंडळ",
          eventName: "नवरात्रोत्सव २०२६",
        }}
        receipt={baseReceipt}
      />
    );

    // Durga artwork
    expect(screen.getByRole("img", { name: /Goddess Durga/i })).toBeDefined();
    // Top devotional line
    expect(screen.getByText(/॥ जय माता दी ॥/i)).toBeDefined();
    // Bottom devotional greeting
    expect(screen.getByText(/जय माता दी! 🙏/i)).toBeDefined();
  });

  // 7, 8, 9: Other festival specific behavior
  it("7, 8, 9: Other configuration renders neutral mandala, no religious idols, no top mantra, and no devotional greeting", () => {
    render(
      <DigitalPavtiCard
        config={{
          ...baseConfig,
          festivalType: "other",
          mandalName: "प्रगती युवा मंडळ",
          eventName: "सामाजिक उपक्रम २०२६",
        }}
        receipt={baseReceipt}
      />
    );

    // Neutral Mandala artwork
    expect(screen.getByRole("img", { name: /Mandala Crest/i })).toBeDefined();
    expect(screen.queryByRole("img", { name: /Lord Ganesha/i })).toBeNull();
    expect(screen.queryByRole("img", { name: /Goddess Durga/i })).toBeNull();

    // No devotional lines
    expect(screen.queryByText(/॥ श्री गणेशाय नमः ॥/i)).toBeNull();
    expect(screen.queryByText(/॥ जय माता दी ॥/i)).toBeNull();
    expect(screen.queryByText(/गणपती बाप्पा मोरया/i)).toBeNull();
    expect(screen.queryByText(/जय माता दी/i)).toBeNull();
  });

  // 10, 11: Dynamic Mandal and Event Names
  it("10, 11: Dynamically renders configured Mandal name and Event name", () => {
    render(
      <DigitalPavtiCard
        config={{
          ...baseConfig,
          mandalName: "बाल गोपाळ मित्र मंडळ, पुणे",
          eventName: "भव्य गणेशोत्सव २०२६",
        }}
        receipt={baseReceipt}
      />
    );

    expect(screen.getByText("बाल गोपाळ मित्र मंडळ, पुणे")).toBeDefined();
    expect(screen.getByText("भव्य गणेशोत्सव २०२६")).toBeDefined();
  });

  // 12: Optional Anniversary Badge
  it("12: Renders anniversary badge when provided, and hides it completely when empty", () => {
    const { rerender } = render(
      <DigitalPavtiCard config={{ ...baseConfig, yearText: "25 वा वर्ष" }} receipt={baseReceipt} />
    );
    expect(screen.getByText("25")).toBeDefined();
    expect(screen.getByText("वा वर्ष")).toBeDefined();

    // Re-render with empty yearText
    rerender(<DigitalPavtiCard config={{ ...baseConfig, yearText: null }} receipt={baseReceipt} />);
    expect(screen.queryByText("वा वर्ष")).toBeNull();
  });

  // 13: Secretary Name
  it("13: Secretary designation and name render accurately", () => {
    render(
      <DigitalPavtiCard
        config={{ ...baseConfig, secretaryName: "प्रशांत तांबडे", secretaryDesignation: "मानद सचिव" }}
        receipt={baseReceipt}
      />
    );

    expect(screen.getByText("मानद सचिव")).toBeDefined();
    expect(screen.getByText("प्रशांत तांबडे")).toBeDefined();
  });

  // 14: Dynamic Amount
  it("14: Amount and Marathi words come from actual receipt data", () => {
    render(<DigitalPavtiCard config={baseConfig} receipt={{ ...baseReceipt, amount: 1001 }} />);

    expect(screen.getByText("₹1,001/-")).toBeDefined();
    expect(screen.getByText(/रुपये एक हजार एक मात्र/i)).toBeDefined();
  });

  // 15: Residential Property Info
  it("15: Displays building, wing, and flat number for residential properties", () => {
    render(
      <DigitalPavtiCard
        config={baseConfig}
        receipt={{
          ...baseReceipt,
          buildingName: "साई कृपा हाइट्स",
          buildingWing: "B",
          unitNumber: "704",
          propertyType: "residential",
        }}
      />
    );

    expect(screen.getByText(/साई कृपा हाइट्स \(B\)/i)).toBeDefined();
    expect(screen.getByText("704")).toBeDefined();
    expect(screen.getByText(/फ्लॅट क्र. :/i)).toBeDefined();
  });

  // 16: Commercial Property Info
  it("16: Displays shop/gala number for commercial properties", () => {
    render(
      <DigitalPavtiCard
        config={baseConfig}
        receipt={{
          ...baseReceipt,
          buildingName: "गोकुळ आर्केड",
          buildingWing: null,
          unitNumber: "Shop 12",
          propertyType: "commercial",
        }}
      />
    );

    expect(screen.getByText("गोकुळ आर्केड")).toBeDefined();
    expect(screen.getByText("Shop 12")).toBeDefined();
    expect(screen.getByText(/गाळा क्र. :/i)).toBeDefined();
  });

  // 17: General / Non-Property Donation
  it("17: Displays General Donation badge without fake property fields", () => {
    render(
      <DigitalPavtiCard
        config={baseConfig}
        receipt={{
          ...baseReceipt,
          buildingName: null,
          buildingWing: null,
          unitNumber: null,
          propertyType: null,
        }}
      />
    );

    expect(screen.getByText(/सामान्य देणगी \/ General Donation/i)).toBeDefined();
    expect(screen.queryByText(/फ्लॅट क्र./i)).toBeNull();
    expect(screen.queryByText(/गाळा क्र./i)).toBeNull();
  });

  // 18: Payment Reference
  it("18: Displays payment reference when non-cash and provided", () => {
    render(
      <DigitalPavtiCard
        config={baseConfig}
        receipt={{
          ...baseReceipt,
          paymentMode: "upi",
          paymentReference: "UPI-TXN-998877",
        }}
      />
    );

    expect(screen.getByText("UPI")).toBeDefined();
    expect(screen.getByText("UPI-TXN-998877")).toBeDefined();
  });

  // 19: 16:9 Aspect Ratio & Long Content Invariants
  it("19: Guarantees fixed 16:9 aspect ratio across normal, long names, and all festival variants", () => {
    // 1. Normal receipt
    const { container: normalContainer } = render(
      <DigitalPavtiCard config={baseConfig} receipt={baseReceipt} />
    );
    const normalCard = normalContainer.querySelector("#digital-pavti-card");
    expect(normalCard?.className).toContain("aspect-[16/9]");

    cleanup();

    // 2. Long Marathi Mandal Name
    const { container: longMandalContainer } = render(
      <DigitalPavtiCard
        config={{
          ...baseConfig,
          mandalName: "अखिल भारतीय बाल गोपाळ सार्वजनिक गणेशोत्सव मित्र मंडळ ट्रस्ट, ठाणे (पश्चिम)",
        }}
        receipt={baseReceipt}
      />
    );
    const longMandalCard = longMandalContainer.querySelector("#digital-pavti-card");
    expect(longMandalCard?.className).toContain("aspect-[16/9]");
    expect(longMandalContainer.querySelector("h1")?.className).toContain("line-clamp-2");

    cleanup();

    // 3. Long Building / Address
    const { container: longAddressContainer } = render(
      <DigitalPavtiCard
        config={baseConfig}
        receipt={{
          ...baseReceipt,
          buildingName: "श्री स्वामी समर्थ कृपा को-ऑपरेटिव्ह हाउसिंग सोसायटी लि.",
          buildingWing: "Wing-B2",
        }}
      />
    );
    const longAddressCard = longAddressContainer.querySelector("#digital-pavti-card");
    expect(longAddressCard?.className).toContain("aspect-[16/9]");

    cleanup();

    // 4. Long Donor Name
    const { container: longDonorContainer } = render(
      <DigitalPavtiCard
        config={baseConfig}
        receipt={{
          ...baseReceipt,
          donorName: "श्रीमती अनुराधा चंद्रशेखर कुलकर्णी-देशपांडे",
        }}
      />
    );
    const longDonorCard = longDonorContainer.querySelector("#digital-pavti-card");
    expect(longDonorCard?.className).toContain("aspect-[16/9]");

    cleanup();

    // 5. All three festival variants
    for (const festivalType of ["ganpati", "navratri", "other"] as const) {
      const { container } = render(
        <DigitalPavtiCard
          config={{ ...baseConfig, festivalType }}
          receipt={baseReceipt}
        />
      );
      const card = container.querySelector("#digital-pavti-card");
      expect(card?.className).toContain("aspect-[16/9]");
      cleanup();
    }
  });
});
