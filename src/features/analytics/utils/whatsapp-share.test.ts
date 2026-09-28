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
    receiptNumber: 262,
    receiptPrefix: 'NU-',
    amount: 501,
    paymentMode: 'cash',
    donorName: 'राहुल शिंदे',
    donorMobile: '9820012345',
    createdAt: '2026-08-30T10:30:00.000Z',
    syncStatus: 'synced',
    serverReceiptId: 'd3d58d02-5cc6-4243-bf33-12e9fbd1abf2',
    mandalName: 'श्री गणेश मित्र मंडळ',
    eventName: 'सार्वजनिक गणेशोत्सव २०२६',
  };

  // ---------------------------------------------------------------------------
  // 1. Share Eligibility Tests
  // ---------------------------------------------------------------------------
  describe('Share Eligibility (checkShareEligibility)', () => {
    it('1. valid synced receipt with physical prefix is shareable', () => {
      const res = checkShareEligibility(baseReceipt);
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
      expect(res.reason).toBeNull();
    });

    it('2. pending local receipt is shareable at donor doorstep', () => {
      const res = checkShareEligibility({ ...baseReceipt, syncStatus: 'pending' });
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
    });

    it('3. syncing receipt is shareable at donor doorstep', () => {
      const res = checkShareEligibility({ ...baseReceipt, syncStatus: 'syncing' });
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
    });

    it('4. receipt with missing prefix is NOT shareable (never synthesize synthetic numbers)', () => {
      const res1 = checkShareEligibility({ ...baseReceipt, receiptPrefix: undefined });
      expect(res1.isShareable).toBe(false);
      expect(res1.reason).toContain('पावती क्रमांक उपलब्ध नाही');

      const res2 = checkShareEligibility({ ...baseReceipt, receiptPrefix: '' });
      expect(res2.isShareable).toBe(false);
    });

    it('5. conflict receipt is not shareable', () => {
      const res = checkShareEligibility({ ...baseReceipt, syncStatus: 'conflict' });
      expect(res.isShareable).toBe(false);
      expect(res.code).toBe('CONFLICT');
      expect(res.reason).toContain('Sync त्रुटी');
    });

    it('6. voided receipt (by status or voidedAt) is not shareable', () => {
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

    it('7. cancelled receipt is not shareable', () => {
      const res = checkShareEligibility({ ...baseReceipt, status: 'cancelled' });
      expect(res.isShareable).toBe(false);
      expect(res.code).toBe('CANCELLED');
    });

    it('8. issued + synced receipt is shareable', () => {
      const res = checkShareEligibility({
        ...baseReceipt,
        status: 'issued',
        syncStatus: 'synced',
      });
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
    });

    it('9. valid + synced receipt is shareable', () => {
      const res = checkShareEligibility({
        ...baseReceipt,
        status: 'valid',
        syncStatus: 'synced',
      });
      expect(res.isShareable).toBe(true);
      expect(res.code).toBe('ELIGIBLE');
    });

    it('10. server-fetched receipt without syncStatus field but with id and prefix is shareable', () => {
      const res = checkShareEligibility({
        receiptNumber: 1050,
        receiptPrefix: 'NU-',
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
    it('11. Indian 10-digit number normalization (9820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('9820012345')).toBe('919820012345');
    });

    it('12. +91 prefix normalization (+919820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('+919820012345')).toBe('919820012345');
      expect(normalizeIndianMobile('+91 98200 12345')).toBe('919820012345');
    });

    it('13. 91 prefix without plus (919820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('919820012345')).toBe('919820012345');
    });

    it('14. leading-zero normalization (09820012345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('09820012345')).toBe('919820012345');
    });

    it('15. spaces, hyphens, and brackets stripped (098-200 12345 -> 919820012345)', () => {
      expect(normalizeIndianMobile('(098) 200-12345')).toBe('919820012345');
    });

    it('16. malformed / short numbers return null', () => {
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
    it('17. formats all payment modes correctly', () => {
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
    it('18. builds compact message with exact required fields and Ganesh closing', () => {
      const msg = formatWhatsAppReceiptMessage(baseReceipt);
      expect(msg).toContain('🚩 *श्री गणेश मित्र मंडळ* 🚩');
      expect(msg).toContain('*वर्गणी पावती / Donation Receipt*');
      expect(msg).toContain('*पावती क्र. / Receipt No.:* NU-262');
      expect(msg).toContain('*देणगीदार / Donor:* राहुल शिंदे');
      expect(msg).toContain('*रक्कम / Amount:* ₹501.00 (रोख / Cash)');
      expect(msg).toContain('आपल्या सहकार्याबद्दल धन्यवाद!');
      expect(msg).toContain('गणपती बाप्पा मोरया! 🌺');
    });

    it('19. builds Navratri message with Jai Mata Di closing', () => {
      const navratriReceipt: WhatsAppReceiptInput = {
        ...baseReceipt,
        mandalName: 'श्री दुर्गा माता उत्सव मंडळ',
        eventName: 'Navratri Utsav 2026',
        receiptPrefix: 'NU-',
        receiptNumber: 262,
      };
      const msg = formatWhatsAppReceiptMessage(navratriReceipt);
      expect(msg).toContain('🚩 *श्री दुर्गा माता उत्सव मंडळ* 🚩');
      expect(msg).toContain('*पावती क्र. / Receipt No.:* NU-262');
      expect(msg).toContain('जय माता दी! 🙏🌺');
      expect(msg).not.toContain('गणपती बाप्पा मोरया');
    });

    it('20. builds neutral message for other festivals without Ganesh defaults', () => {
      const neutralReceipt: WhatsAppReceiptInput = {
        ...baseReceipt,
        mandalName: 'समाज सेवा संस्था',
        eventName: 'वार्षिक उत्सव २०२६',
        receiptPrefix: 'VP-',
      };
      const msg = formatWhatsAppReceiptMessage(neutralReceipt);
      expect(msg).toContain('🚩 *समाज सेवा संस्था* 🚩');
      expect(msg).toContain('आपल्या सहकार्याबद्दल धन्यवाद! 🙏');
      expect(msg).not.toContain('गणपती बाप्पा मोरया');
      expect(msg).not.toContain('जय माता दी');
    });

    it('21. includes property line for residential flat', () => {
      const msg = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        buildingName: 'गोकुळ धाम',
        buildingWing: 'A',
        unitNumber: '402',
        propertyType: 'residential',
      });
      expect(msg).toContain('*पत्ता / Property:* गोकुळ धाम (A), फ्लॅट क्र. 402');
    });

    it('22. includes shop line for commercial property without showing fake flat', () => {
      const msg = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        buildingName: 'मार्केट प्लाझा',
        unitNumber: 'S-12',
        propertyType: 'commercial',
      });
      expect(msg).toContain('*पत्ता / Property:* मार्केट प्लाझा, गाळा क्र. S-12');
      expect(msg).not.toContain('फ्लॅट');
    });

    it('23. omits property line when building/flat is null', () => {
      const msg = formatWhatsAppReceiptMessage(baseReceipt);
      expect(msg).not.toContain('*पत्ता / Property:*');
    });

    it('24. conditionally includes payment reference ONLY for UPI/bank transfer', () => {
      const cashWithRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'cash',
        paymentReference: 'CASH-REF-1234',
      });
      expect(cashWithRef).not.toContain('*संदर्भ / Ref:*');

      const upiWithRef = formatWhatsAppReceiptMessage({
        ...baseReceipt,
        paymentMode: 'upi',
        paymentReference: 'UPI-TXN-9988',
      });
      expect(upiWithRef).toContain('*संदर्भ / Ref:* UPI-TXN-9988');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. WhatsApp Share URL Generation
  // ---------------------------------------------------------------------------
  describe('WhatsApp Share URL (buildWhatsAppShareUrl)', () => {
    it('25. builds targeted wa.me URL for valid Indian mobile', () => {
      const res = buildWhatsAppShareUrl(baseReceipt);
      expect(res.isTargeted).toBe(true);
      expect(res.targetMobile).toBe('919820012345');
      expect(res.url).toContain('https://wa.me/919820012345?text=');
      expect(res.url).toContain(encodeURIComponent('NU-262'));
    });

    it('26. builds generic wa.me URL when donor mobile is absent', () => {
      const res = buildWhatsAppShareUrl({ ...baseReceipt, donorMobile: null });
      expect(res.isTargeted).toBe(false);
      expect(res.targetMobile).toBeNull();
      expect(res.url).toContain('https://wa.me/?text=');
    });
  });
});
