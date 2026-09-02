import { describe, it, expect } from "vitest";
import { numberToMarathiWords } from "./marathi-words";

describe("numberToMarathiWords", () => {
  it("converts single and double digit amounts", () => {
    expect(numberToMarathiWords(51)).toBe("रुपये एकावन्न मात्र");
    expect(numberToMarathiWords(100)).toBe("रुपये शंभर मात्र");
  });

  it("converts 501, 751, 1001 matching locked reference", () => {
    expect(numberToMarathiWords(501)).toBe("रुपये पाचशे एक मात्र");
    expect(numberToMarathiWords(751)).toBe("रुपये सातशे एकावन्न मात्र");
    expect(numberToMarathiWords(1001)).toBe("रुपये एक हजार एक मात्र");
  });

  it("converts even thousands and lakhs", () => {
    expect(numberToMarathiWords(2000)).toBe("रुपये दोन हजार मात्र");
    expect(numberToMarathiWords(5000)).toBe("रुपये पाच हजार मात्र");
    expect(numberToMarathiWords(11000)).toBe("रुपये अकरा हजार मात्र");
    expect(numberToMarathiWords(25000)).toBe("रुपये पंचवीस हजार मात्र");
    expect(numberToMarathiWords(100000)).toBe("रुपये एक लाख मात्र");
    expect(numberToMarathiWords(500000)).toBe("रुपये पाच लाख मात्र");
  });

  it("handles zero and negative gracefully", () => {
    expect(numberToMarathiWords(0)).toBe("रुपये शून्य मात्र");
    expect(numberToMarathiWords(-50)).toBe("रुपये शून्य मात्र");
  });
});
