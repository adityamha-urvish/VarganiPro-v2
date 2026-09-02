import { describe, it, expect } from 'vitest';
import {
  normalizeIndianMobile,
  checkShareEligibility,
  formatPaymentModeLabel,
  formatWhatsAppReceiptMessage,
  buildWhatsAppShareUrl,
  type WhatsAppReceiptInput,
} from './whatsapp-share';

describe('WhatsApp Receipt Sharing Utility (whatsapp-share.ts)', () => {
  const baseReceipt: WhatsAppReceiptInput = {
    receiptNumber: 1042,
    receiptPrefix: 'VPA-',
    amount: 501,
    paymentMode: 'cash',
    donorName: 'राहुल शिंदे',
    donorMobile: '9820012345',
    createdAt: '2026-08-30T10:30:00.000Z',
    syncStatus: 'synced',
    serverReceiptId: 'd3d58d02-5cc6-4243-bf33-12e9fbd1abf2',
    mandalName: 'श्री गणेश मित्र मंडळ',
  };

  // ---------------------------------------------------------------------------
  // 1. Share Eligibility Tests
  // ---------------------------------------------------------------------------
  describe('Share Eligibility (checkShareEligibility)', () => {
    it('1. valid synced receipt is shareable', () => {
      const res = checkShareEligibility(baseReceipt);
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
      expect(res.reason).toBeNull();
    });

    it('2. unsynced pending receipt is not shareable', () => {
      const res = checkShareEligibility({ ...baseReceipt, syncStatus: 'pending' });
      expect(res.isShareable).toBe(false);
      expect(res.code).toBe('UNSYNCED');
      expect(res.reason).toContain('Sync झाल्यावर उपलब्ध होईल');
    });

    it('3. syncing receipt is not shareable', () => {
      const res = checkShareEligibility({ ...baseReceipt, syncStatus: 'syncing' });
      expect(res.isShareable).toBe(false);
      expect(res.code).toBe('SYNCING');
      expect(res.reason).toContain('Sync होत आहे');
    });

    it('4. conflict receipt is not shareable', () => {
      const res = checkShareEligibility({ ...baseReceipt, syncStatus: 'conflict' });
      expect(res.isShareable).toBe(false);
      expect(res.code).toBe('CONFLICT');
      expect(res.reason).toContain('Sync त्रुटी');
    });

    it('5. voided receipt (by status or voidedAt) is not shareable', () => {
      const res1 = checkShareEligibility({ ...baseReceipt, status: 'voided' });
      expect(res1.isShareable).toBe(false);
      expect(res1.code).toBe('VOIDED');
      expect(res1.reason).toContain('रद्द केलेली पावती');

      const res2 = checkShareEligibility({
        ...baseReceipt,
        voidedAt: '2026-08-30T11:00:00Z',
        voidReason: 'Mistake',
      });
      expect(res2.isShareable).toBe(false);
      expect(res2.code).toBe('VOIDED');
    });

    it('6. cancelled receipt is not shareable', () => {
      const res = checkShareEligibility({ ...baseReceipt, status: 'cancelled' });
      expect(res.isShareable).toBe(false);
      expect(res.code).toBe('CANCELLED');
    });

    it('7. issued + synced receipt is shareable', () => {
      const res = checkShareEligibility({
        ...baseReceipt,
        status: 'issued',
        syncStatus: 'synced',
      });
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
    });

    it('8. valid + synced receipt is shareable', () => {
      const res = checkShareEligibility({
        ...baseReceipt,
        status: 'valid',
        syncStatus: 'synced',
      });
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
    });

    it('9. server-fetched receipt without syncStatus field but with id is shareable', () => {
      const res = checkShareEligibility({
        receiptNumber: 1050,
        amount: 1000,
        paymentMode: 'cash',
        donorName: 'Test',
        createdAt: '2026-08-30T10:00:00Z',
        id: 'rec-uuid-1234',
        status: 'issued',
      });
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Indian Mobile Normalization Tests
  // ---------------------------------------------------------------------------
  describe('Indian Mobile Normalization (normalizeIndianMobile)', () => {
    it('10. Indian 10-digit number normalization (9820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('9820012345')).toBe('919820012345');
    });

    it('11. +91 prefix normalization (+919820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('+919820012345')).toBe('919820012345');
      expect(normalizeIndianMobile('+91 98200 12345')).toBe('919820012345');
    });

    it('12. 91 prefix without plus (919820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('919820012345')).toBe('919820012345');
    });

    it('13. leading-zero normalization (09820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('09820012345')).toBe('919820012345');
    });

    it('14. spaces, hyphens, and brackets stripped (098-200 12345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('(098) 200-12345')).toBe('919820012345');
    });

    it('15. malformed / short numbers return null', () => {
      expect(normalizeIndianMobile('12345')).toBeNull();
      expect(normalizeIndianMobile('022-24301234')).toBeNull();
      expect(normalizeIndianMobile('abcdefghij')).toBeNull();
      expect(normalizeIndianMobile(null)).toBeNull();
      expect(normalizeIndianMobile('')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Payment Mode Labels
  // ---------------------------------------------------------------------------
  describe('Payment Mode Labels (formatPaymentModeLabel)', () => {
    it('16. formats all payment modes correctly', () => {
      expect(formatPaymentModeLabel('cash')).toBe('रोख / Cash');
      expect(formatPaymentModeLabel('upi')).toBe('UPI');
      expect(formatPaymentModeLabel('cheque')).toBe('धनादेश / Cheque');
      expect(formatPaymentModeLabel('bank_transfer')).toBe('बँक ट्रान्सफर / Bank Transfer');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Message Content & Privacy Tests
  // ---------------------------------------------------------------------------
  describe('Message Content & Privacy (formatWhatsAppReceiptMessage)', () => {
    it('17. builds compact message with exact required fields', () => {
      const msg = formatWhatsAppReceiptMessage(baseReceipt);
      expect(msg).toContain('🚩 *श्री गणेश मित्र मंडळ* 🚩');
      expect(msg).toContain('*वर्गणी पावती / Donation Receipt*');
      expect(msg).toContain('*पावती क्र. / Receipt No.:* VPA-1042');
      expect(msg).toContain('*देणगीदार / Donor:* राहुल शिंदे');
      expect(msg).toContain('*रक्कम / Amount:* ₹501.00 (रोख / Cash)');
      expect(msg).toContain('आपल्या सहकार्याबद्दल धन्यवाद!');
      expect(msg).toContain('गणपती बाप्पा मोरया! 🌺');
    });

    it('18. includes property line for residential flat', () => {
      const msg = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        buildingName: 'गोकुळ धाम',
        buildingWing: 'A',
        unitNumber: '402',
        propertyType: 'residential',
      });
      expect(msg).toContain('*पत्ता / Property:* गोकुळ धाम (A), फ्लॅट क्र. 402');
    });

    it('19. includes shop line for commercial property without showing fake flat', () => {
      const msg = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        buildingName: 'मार्केट प्लाझा',
        unitNumber: 'S-12',
        propertyType: 'commercial',
      });
      expect(msg).toContain('*पत्ता / Property:* मार्केट प्लाझा, गाळा क्र. S-12');
      expect(msg).not.toContain('फ्लॅट');
    });

    it('20. omits property line when building/flat is null', () => {
      const msg = formatWhatsAppReceiptMessage(baseReceipt);
      expect(msg).not.toContain('*पत्ता / Property:*');
    });

    it('21. conditionally includes payment reference ONLY for UPI/bank transfer (A-E)', () => {
      // A. Cash + reference -> reference is NOT included
      const cashWithRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'cash',
        paymentReference: 'CASH-REF-1234',
      });
      expect(cashWithRef).toContain('*रक्कम / Amount:* ₹501.00 (रोख / Cash)');
      expect(cashWithRef).not.toContain('*संदर्भ / Ref:*');
      expect(cashWithRef).not.toContain('CASH-REF-1234');

      // B. Cheque + reference -> reference is NOT included
      const chequeWithRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'cheque',
        paymentReference: 'CHQ-987654',
      });
      expect(chequeWithRef).toContain('*रक्कम / Amount:* ₹501.00 (धनादेश / Cheque)');
      expect(chequeWithRef).not.toContain('*संदर्भ / Ref:*');
      expect(chequeWithRef).not.toContain('CHQ-987654');

      // C. UPI + reference -> reference IS included
      const upiWithRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'upi',
        paymentReference: 'UPI-TXN-9988',
      });
      expect(upiWithRef).toContain('*रक्कम / Amount:* ₹501.00 (UPI)');
      expect(upiWithRef).toContain('*संदर्भ / Ref:* UPI-TXN-9988');

      // D. Bank Transfer + reference -> reference IS included
      const bankWithRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'bank_transfer',
        paymentReference: 'IMPS-55443322',
      });
      expect(bankWithRef).toContain('*रक्कम / Amount:* ₹501.00 (बँक ट्रान्सफर / Bank Transfer)');
      expect(bankWithRef).toContain('*संदर्भ / Ref:* IMPS-55443322');

      // E. UPI/Bank transfer without reference -> reference line omitted
      const upiNoRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'upi',
        paymentReference: null,
      });
      expect(upiNoRef).toContain('*रक्कम / Amount:* ₹501.00 (UPI)');
      expect(upiNoRef).not.toContain('*संदर्भ / Ref:*');

      const bankNoRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'bank_transfer',
        paymentReference: '',
      });
      expect(bankNoRef).toContain('*रक्कम / Amount:* ₹501.00 (बँक ट्रान्सफर / Bank Transfer)');
      expect(bankNoRef).not.toContain('*संदर्भ / Ref:*');
    });

    it('22. PRIVACY: donor mobile is NOT embedded in the message text body', () => {
      const msg = formatWhatsAppReceiptMessage(baseReceipt);
      expect(msg).not.toContain('9820012345');
      expect(msg).not.toContain('Mobile');
    });

    it('23. PRIVACY: volunteer name, ID, PIN, session ID, UUIDs are NOT embedded', () => {
      const msg = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        serverReceiptId: 'd3d58d02-5cc6-4243-bf33-12e9fbd1abf2',
      });
      expect(msg).not.toContain('d3d58d02');
      expect(msg).not.toContain('PIN');
      expect(msg).not.toContain('volunteer');
      expect(msg).not.toContain('session');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. WhatsApp URL Construction Tests
  // ---------------------------------------------------------------------------
  describe('WhatsApp URL Construction (buildWhatsAppShareUrl)', () => {
    it('24. targeted URL when valid donor mobile exists', () => {
      const details = buildWhatsAppShareUrl(baseReceipt);
      expect(details.isTargeted).toBe(true);
      expect(details.targetMobile).toBe('919820012345');
      expect(details.url.startsWith('https://wa.me/919820012345?text=')).toBe(true);
      expect(details.url).toContain(encodeURIComponent('राहुल शिंदे'));
    });

    it('25. generic URL when donor mobile is null or empty', () => {
      const details = buildWhatsAppShareUrl({ ...baseReceipt, donorMobile: null });
      expect(details.isTargeted).toBe(false);
      expect(details.targetMobile).toBeNull();
      expect(details.url.startsWith('https://wa.me/?text=')).toBe(true);
      expect(details.url).toContain(encodeURIComponent('VPA-1042'));
    });

    it('26. generic URL when donor mobile is malformed', () => {
      const details = buildWhatsAppShareUrl({ ...baseReceipt, donorMobile: '123' });
      expect(details.isTargeted).toBe(false);
      expect(details.url.startsWith('https://wa.me/?text=')).toBe(true);
    });

    it('27. preserves Marathi Unicode in encoded URL', () => {
      const details = buildWhatsAppShareUrl(baseReceipt);
      const decoded = decodeURIComponent(details.url);
      expect(decoded).toContain('राहुल शिंदे');
      expect(decoded).toContain('गणपती बाप्पा मोरया! 🌺');
    });
  });
});
