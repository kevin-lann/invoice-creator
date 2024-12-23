import { Invoice } from "../models/Invoice";
import saveAs from 'file-saver'

export const toJson = (data: Invoice, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  saveAs(blob, filename + ".json" || "exportInvoice.json");
}

export const fromJson = async (file: File): Promise<Invoice | null> => {
  return new Promise((resolve, reject) => {
    if (file.type !== 'application/json') {
      alert('Please upload a valid JSON file');
      resolve(null); // Resolve with null for invalid file type
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const invoice: Invoice = JSON.parse(reader.result as string);
        console.log('Parsed JSON:', invoice);
        resolve(invoice); // Resolve with the parsed JSON object
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