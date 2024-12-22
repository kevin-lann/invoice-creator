import { Invoice } from "../models/Invoice";
import saveAs from 'file-saver'

export const toJson = (data: Invoice, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  saveAs(blob, filename + ".json" || "exportInvoice.json");
}