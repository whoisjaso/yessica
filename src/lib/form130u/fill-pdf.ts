/**
 * 130-U PDF Fill Engine
 *
 * Loads the blank TxDMV Form 130-U, fills AcroForm fields using the
 * field mapping, and returns the filled PDF as Uint8Array.
 *
 * The form is NOT flattened — fields remain editable so the tax office
 * can make corrections if needed.
 */

import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont, type PDFTextField } from 'pdf-lib';
import {
  ADDITIONAL_APPLICANT_NAME_FIELD_ID,
  APPLICANT_ADDRESS_FIELD_ID,
  APPLICANT_NAME_FIELD_ID,
  FIELD_MAPPINGS,
  FIRST_LIENHOLDER_FIELD_ID,
  PREVIOUS_OWNER_FIELD_ID,
  type AgreementData,
} from './field-mapping';


// Keep every filled 130-U text box on one print system: regular Helvetica,
// pure black, one weight everywhere, with size chosen from the physical field
// box. The owner's instruction, looking at a filled form: the same font in
// every box, neutral, not deliberately bold, legible to anybody who reads it.
const FONT_SIZE_DEFAULT = 10.5;
const FONT_SIZE_LONG = 9.5;
const FONT_SIZE_TINY = 8.5;
const MIN_FONT_SIZE = 7.25;
const FIELD_HORIZONTAL_PADDING = 4;
const FIELD_HEIGHT_RATIO = 0.62;
const APPLICANT_NAME_FONT_SIZE = 10.5;

// The official 130-U prints four labels inside one applicant-name field.
// These x positions are the visible label centers from the TxDMV PDF.
const NAME_COLUMN_CENTERS = {
  first: 93.56,
  middle: 266.13,
  last: 373.64,
  suffix: 526.28,
} as const;

// Fields that need smaller font to fit long content
const SMALL_FONT_FIELDS = new Set([
  '16 Applicant First Name or Entity Name Middle Name Last Name Suffix if any',
  '17 Additional Applicant First Name if applicable Middle Name Last Name Suffix if any',
  '18 Applicant Mailing Address City State Zip',
  '20 Previous Owner Name or Entity Name City State',
  '23 Renewal Recipient First Name or Entity Name if different Middle Name Last Name Suffix if any',
  '24 Renewal Notice Mailing Address if different City State Zip',
  '29 Vehicle Location Address if different City State Zip',
  '34 First Lienholder Name if any Mailing Address City State Zip',
  '36 TradeIn if any Year Make Vehicle Identification Number',
  'Seller  Name',
  'Applicant Owner',
  'Additional Applicant',
]);

const TINY_FONT_FIELDS = new Set([
  '26 Email optional',
  'Sales Tax Exemption Reason',
]);

function getFontSize(fieldId: string): number {
  if (TINY_FONT_FIELDS.has(fieldId)) return FONT_SIZE_TINY;
  if (SMALL_FONT_FIELDS.has(fieldId)) return FONT_SIZE_LONG;
  return FONT_SIZE_DEFAULT;
}

function fitFontSize(field: PDFTextField, value: string, font: PDFFont, maxSize: number): number {
  const widgets = field.acroField.getWidgets();
  const rect = widgets[0]?.getRectangle();
  if (!rect) return maxSize;

  const heightCap = Math.max(MIN_FONT_SIZE, rect.height * FIELD_HEIGHT_RATIO);
  const widthAtOnePoint = font.widthOfTextAtSize(value, 1);
  const usableWidth = Math.max(1, rect.width - FIELD_HORIZONTAL_PADDING);
  const widthCap = widthAtOnePoint > 0 ? usableWidth / widthAtOnePoint : maxSize;

  return Math.max(MIN_FONT_SIZE, Math.min(maxSize, heightCap, widthCap));
}

function applyPrintTypography(field: PDFTextField, font: PDFFont, fontSize: number) {
  const defaultAppearance = `0 0 0 rg\n/${font.name} ${fontSize} Tf`;
  field.acroField.setDefaultAppearance(defaultAppearance);

  for (const widget of field.acroField.getWidgets()) {
    widget.setDefaultAppearance(defaultAppearance);
  }

  field.updateAppearances(font);
}

function drawCenteredText(page: PDFPage, font: PDFFont, text: string | undefined, centerX: number, baselineY: number) {
  if (!text) return;
  const width = font.widthOfTextAtSize(text, APPLICANT_NAME_FONT_SIZE);
  page.drawText(text, {
    x: centerX - width / 2,
    y: baselineY,
    size: APPLICANT_NAME_FONT_SIZE,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawLeftFitText(
  page: PDFPage,
  font: PDFFont,
  text: string | undefined,
  x: number,
  baselineY: number,
  maxWidth: number,
  maxSize = APPLICANT_NAME_FONT_SIZE,
) {
  const value = (text || '').trim();
  if (!value) return;
  page.drawText(value, {
    x,
    y: baselineY,
    size: fitFontSizeForWidth(font, value, maxWidth, maxSize),
    font,
    color: rgb(0, 0, 0),
  });
}

function fitFontSizeForWidth(font: PDFFont, value: string, maxWidth: number, maxSize: number): number {
  const widthAtOnePoint = font.widthOfTextAtSize(value, 1);
  if (widthAtOnePoint <= 0) return maxSize;
  return Math.max(MIN_FONT_SIZE, Math.min(maxSize, maxWidth / widthAtOnePoint));
}

function splitName(fullName: string | undefined) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', middle: '', last: '', suffix: '' };
  if (parts.length === 1) return { first: parts[0], middle: '', last: '', suffix: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1], suffix: '' };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
    suffix: '',
  };
}

function clearOverlayField(field: PDFTextField, font: PDFFont) {
  field.setText('');
  applyPrintTypography(field, font, APPLICANT_NAME_FONT_SIZE);
}

function drawNameColumns(
  pdfDoc: PDFDocument,
  field: PDFTextField,
  font: PDFFont,
  parts: { first?: string; middle?: string; last?: string; suffix?: string },
) {
  const rect = field.acroField.getWidgets()[0]?.getRectangle();
  if (!rect) return;

  field.setText('');
  applyPrintTypography(field, font, APPLICANT_NAME_FONT_SIZE);

  const page = pdfDoc.getPages()[0];
  const baselineY = rect.y + 6.2;

  drawCenteredText(page, font, parts.first, NAME_COLUMN_CENTERS.first, baselineY);
  drawCenteredText(page, font, parts.middle, NAME_COLUMN_CENTERS.middle, baselineY);
  drawCenteredText(page, font, parts.last, NAME_COLUMN_CENTERS.last, baselineY);
  drawCenteredText(page, font, parts.suffix, NAME_COLUMN_CENTERS.suffix, baselineY);
}

function drawApplicantAddressColumns(pdfDoc: PDFDocument, field: PDFTextField, font: PDFFont, data: AgreementData) {
  const rect = field.acroField.getWidgets()[0]?.getRectangle();
  if (!rect) return;

  clearOverlayField(field, font);
  const page = pdfDoc.getPages()[0];
  const baselineY = rect.y + 6.2;

  drawLeftFitText(page, font, data.buyer_address, 31.8, baselineY, 204, 9.6);
  drawLeftFitText(page, font, data.buyer_city, 244.08, baselineY, 96, 9.6);
  drawLeftFitText(page, font, data.buyer_state.toUpperCase(), 356.52, baselineY, 34, 9.6);
  drawLeftFitText(page, font, data.buyer_zip, 441.0, baselineY, 36, 9.1);
}

function drawPreviousOwnerColumns(pdfDoc: PDFDocument, field: PDFTextField, font: PDFFont, data: AgreementData) {
  const rect = field.acroField.getWidgets()[0]?.getRectangle();
  if (!rect) return;

  clearOverlayField(field, font);
  const page = pdfDoc.getPages()[0];
  const baselineY = rect.y + 6.2;

  const DEALER = data.dealer;
  const useDealer = data.previous_owner_name === undefined;
  drawLeftFitText(page, font, useDealer ? DEALER.name : data.previous_owner_name, 31.8, baselineY, 204, 9.4);
  drawLeftFitText(page, font, useDealer ? DEALER.city : data.previous_owner_city, 244.08, baselineY, 96, 9.6);
  drawLeftFitText(page, font, useDealer ? DEALER.state : data.previous_owner_state, 356.52, baselineY, 24, 9.4);
}

function drawLienholderColumns(pdfDoc: PDFDocument, field: PDFTextField, font: PDFFont, data: AgreementData) {
  if (!data.has_lien) return;
  const rect = field.acroField.getWidgets()[0]?.getRectangle();
  if (!rect) return;

  clearOverlayField(field, font);
  const page = pdfDoc.getPages()[0];
  const baselineY = rect.y + 6.2;

  /*
    The dealership's address completes the dealership's own lien and no
    other. A bank-funded sale names the lender and leaves its address for
    webDEALER, where the lender record lives; completing those boxes with
    our own street drew the bank's name over the dealership's address on a
    filed state form. Empty boxes are ones a clerk completes; wrong ones are
    ones a clerk trusts.
  */
  const DEALER = data.dealer;
  const name = data.lienholder_name || DEALER.name;
  const ours = name === DEALER.name;
  drawLeftFitText(page, font, name, 31.8, baselineY, 116, 8.8);
  drawLeftFitText(page, font, data.lienholder_address || (ours ? DEALER.street : ''), 158.52, baselineY, 118, 8.8);
  drawLeftFitText(page, font, data.lienholder_city || (ours ? DEALER.city : ''), 289.08, baselineY, 112, 8.8);
  drawLeftFitText(page, font, (data.lienholder_state || (ours ? DEALER.state : '')).toUpperCase(), 415.08, baselineY, 72, 8.8);
  drawLeftFitText(page, font, data.lienholder_zip || (ours ? DEALER.zip : ''), 505.08, baselineY, 78, 8.8);
}

/**
 * Fill the official TxDMV Form 130-U. `templateBytes` is the blank form
 * (public/forms/130-U.pdf); the browser fetches it, so the buyer's details
 * never leave her device to make the paper.
 */
export async function fill130U(
  data: AgreementData,
  templateBytes: ArrayBuffer | Uint8Array,
  extras: { preserveInstructions?: boolean } = {},
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  /*
    Existing direct callers use the filing sheet alone. Original-form
    previews and deliveries opt into the unchanged state instruction page.
  */
  if (!extras.preserveInstructions) while (pdfDoc.getPageCount() > 1) pdfDoc.removePage(1);

  // Fill each mapped field
  for (const mapping of FIELD_MAPPINGS) {
    try {
      const value = mapping.getValue(data);

      // Skip undefined/empty values
      if (value === undefined || value === null || value === '') continue;

      if (mapping.type === 'text' && typeof value === 'string') {
        const field = form.getTextField(mapping.fieldId);
        field.setText(value);
        const fontSize = fitFontSize(field, value, font, getFontSize(mapping.fieldId));
        applyPrintTypography(field, font, fontSize);
      } else if (mapping.type === 'checkbox' && typeof value === 'boolean') {
        const field = form.getCheckBox(mapping.fieldId);
        if (value) {
          field.check();
        } else {
          field.uncheck();
        }
        field.defaultUpdateAppearances();
      }
    } catch (err) {
      // Field doesn't exist in PDF — log warning but don't crash
      console.warn(
        `[fill-130u] Warning: Could not fill field "${mapping.fieldId}":`,
        (err as Error).message
      );
    }
  }

  // Do NOT flatten — leave fields editable
  const applicantField = form.getTextField(APPLICANT_NAME_FIELD_ID);
  if (data.applicant_type !== 'individual' && data.buyer_entity_name) {
    // Entity names occupy the complete row. Splitting one into personal-name
    // columns either loses words or puts an invented person on a state form.
    applicantField.setText(data.buyer_entity_name);
    applyPrintTypography(applicantField, font, fitFontSize(applicantField, data.buyer_entity_name, font, FONT_SIZE_DEFAULT));
  } else {
    drawNameColumns(pdfDoc, applicantField, font, {
      first: data.buyer_first_name,
      middle: data.buyer_middle_name,
      last: data.buyer_last_name,
      suffix: data.buyer_suffix,
    });
  }
  drawApplicantAddressColumns(pdfDoc, form.getTextField(APPLICANT_ADDRESS_FIELD_ID), font, data);
  drawPreviousOwnerColumns(pdfDoc, form.getTextField(PREVIOUS_OWNER_FIELD_ID), font, data);
  drawLienholderColumns(pdfDoc, form.getTextField(FIRST_LIENHOLDER_FIELD_ID), font, data);

  if (data.co_buyer_name) {
    drawNameColumns(
      pdfDoc,
      form.getTextField(ADDITIONAL_APPLICANT_NAME_FIELD_ID),
      font,
      splitName(data.co_buyer_name),
    );
  }

  const filledPdf = await pdfDoc.save();
  return filledPdf;
}
