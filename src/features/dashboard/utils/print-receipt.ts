import type { LocalReceipt } from "@/lib/offline/offline-db";

export type PrintReceiptSessionInfo = {
  prefix: string;
  bookNumber: string;
};

export type PrintReceiptResult =
  | { success: true }
  | { success: false; error: string };

export function printReceipt(
  receipt: LocalReceipt,
  session: PrintReceiptSessionInfo | null
): PrintReceiptResult {
  if (!session) {
    return {
      success: false,
      error: "Collection session is not available.",
    };
  }

  const printWindow = window.open(
    "",
    "_blank",
    "width=800,height=900"
  );

  if (!printWindow) {
    return {
      success: false,
      error:
        "Unable to open the print window. Please allow pop-ups for VarganiPro and try again.",
    };
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const receiptCode =
    `${session.prefix}${receipt.receiptNumber}`;

  const donorName =
    escapeHtml(receipt.donorName);

  const donorMobile =
    receipt.donorMobile
      ? escapeHtml(receipt.donorMobile)
      : "";

  const paymentMode =
    escapeHtml(
      receipt.paymentMode.replace("_", " ")
    );

  const paymentReference =
    receipt.paymentReference
      ? escapeHtml(receipt.paymentReference)
      : "";

  const notes =
    receipt.notes
      ? escapeHtml(receipt.notes)
      : "";

  const receiptDate =
    escapeHtml(
      new Date(
        receipt.createdAt
      ).toLocaleString()
    );

  const bookNumber =
    escapeHtml(session.bookNumber);

  printWindow.document.open();

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${escapeHtml(receiptCode)}</title>

        <style>
          @page {
            size: A4;
            margin: 15mm;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
          }

          .receipt {
            width: 100%;
            border: 1px solid #222;
            padding: 16mm;
          }

          .center {
            text-align: center;
          }

          .brand {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 1px;
          }

          .subtitle {
            margin: 6px 0 0;
            font-size: 14px;
            color: #555;
          }

          .number {
            margin: 20px 0;
            padding: 12px 0;
            border-top: 1px solid #222;
            border-bottom: 1px solid #222;
            text-align: center;
          }

          .number-label {
            font-size: 12px;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .number-value {
            margin-top: 5px;
            font-size: 30px;
            font-weight: 700;
          }

          .details {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }

          .details td {
            padding: 9px 0;
            vertical-align: top;
            border-bottom: 1px solid #ddd;
          }

          .details td:first-child {
            width: 40%;
            color: #666;
          }

          .details td:last-child {
            text-align: right;
            font-weight: 600;
          }

          .amount {
            font-size: 22px;
          }

          .notes {
            margin-top: 18px;
            padding-top: 12px;
            border-top: 1px solid #222;
          }

          .notes-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }

          .notes-value {
            margin-top: 6px;
            font-size: 14px;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #222;
            text-align: center;
            font-size: 11px;
            color: #666;
          }
        </style>
      </head>

      <body>
        <div class="receipt">

          <div class="center">
            <h1 class="brand">VARGANIPRO</h1>
            <p class="subtitle">
              Donation Receipt
            </p>
          </div>

          <div class="number">
            <div class="number-label">
              Receipt Number
            </div>

            <div class="number-value">
              ${escapeHtml(receiptCode)}
            </div>
          </div>

          <table class="details">
            <tbody>

              <tr>
                <td>Donor Name</td>
                <td>${donorName}</td>
              </tr>

              ${
                donorMobile
                  ? `
                    <tr>
                      <td>Mobile</td>
                      <td>${donorMobile}</td>
                    </tr>
                  `
                  : ""
              }

              <tr>
                <td>Amount</td>
                <td class="amount">
                  ₹${receipt.amount.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td>Payment Mode</td>
                <td style="text-transform: capitalize;">
                  ${paymentMode}
                </td>
              </tr>

              ${
                paymentReference
                  ? `
                    <tr>
                      <td>Payment Reference</td>
                      <td>${paymentReference}</td>
                    </tr>
                  `
                  : ""
              }

              <tr>
                <td>Date &amp; Time</td>
                <td>${receiptDate}</td>
              </tr>

              <tr>
                <td>Receipt Book</td>
                <td>${bookNumber}</td>
              </tr>

            </tbody>
          </table>

          ${
            notes
              ? `
                <div class="notes">
                  <div class="notes-label">
                    Notes
                  </div>

                  <div class="notes-value">
                    ${notes}
                  </div>
                </div>
              `
              : ""
          }

          <div class="footer">
            Thank you for your contribution.
          </div>

        </div>
      </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.focus();

  printWindow.onafterprint = () => {
    printWindow.close();
  };

  printWindow.onload = () => {
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return { success: true };
}
