export type itemType = "MATERIAL_AND_PARTS" | "DIAGNOSE_FEE_AND_LABOUR"

export type Invoice = {
  invoiceNo: number,
  date: string,
  customerInfo: {
    name?: string,
    address: string,
    city: string,
    phone?: string,
    email?: string,
  }
  description: string,
  recommendation: string,
  items: {
    name: string,
    quantity?: number,
    unitPrice?: number,
    amount: number,
    type: itemType,
  }[]
}

export const testInvoice: Invoice = {
  invoiceNo: 20241220,
  date: "Dec 20, 2024",
  customerInfo: {
    name: "John Doe",
    address: "42 Jump st.",
    city: "Toronto",
    phone: "123 456 7890",
    email: "johndoe@gmail.com",
  },
  description: "Malfuctioning microwave, Broken fridge light",
  recommendation: "Purchase replacement part xyz at partscanada.ca",
  items: [
    {
      name: "Aluminum duct tape",
      quantity: 1,
      unitPrice: 5.00,
      amount: 5.00,
      type: "MATERIAL_AND_PARTS",
    },
    {
      name: "Lightbulb",
      quantity: 2,
      unitPrice: 8.00,
      amount: 16.00,
      type: "MATERIAL_AND_PARTS",
    },
    {
      name: "Screws",
      quantity: 30,
      unitPrice: 0.60,
      amount: 18.00,
      type: "MATERIAL_AND_PARTS",
    },
    {
      name: "Labor",
      amount: 200.00,
      type: "DIAGNOSE_FEE_AND_LABOUR",
    }
  ]
}