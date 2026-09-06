import { Invoice } from "../models/Invoice";
import { normalizeImportedInvoice } from "../db/invoiceRepository";
import saveAs from 'file-saver'

export const saveJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  saveAs(blob, (filename || "exportInvoice") + ".json");
}

export const toJson = (data: Invoice, filename: string) => saveJson(data, filename)

/**
 * One invoice out of an uploaded file, read the same way the invoice list
 * reads a backup: the fields that fell out of the format along the way are
 * folded back in, so a file saved before parking replaced the two "other"
 * fees, or before HST became a per-line toggle, still opens totalling what it
 * was sent out for.
 */
export const fromJson = async (file: File): Promise<Invoice | null> =>
  normalizeImportedInvoice(await readJsonFile(file))

export const readJsonFile = async (file: File): Promise<unknown | null> => {
  return new Promise<unknown | null>((resolve, reject) => {
    if (file.type !== 'application/json') {
      alert('Please upload a valid JSON file');
      resolve(null); // Resolve with null for invalid file type
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(reader.result as string);
        console.log('Parsed JSON:', parsed);
        resolve(parsed); // Resolve with the parsed JSON object
      } catch (error) {
        alert('Invalid JSON file');
        console.error('Error parsing JSON:', error);
        resolve(null); // Resolve with null on parse error
      }
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      reject(error); // Reject on file read error
    };

    reader.readAsText(file);
  });
}