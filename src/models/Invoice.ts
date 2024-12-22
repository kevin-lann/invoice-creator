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
    id: number
    name: string,
    quantity?: number,
    unitPrice?: number,
    amount: number,
  }[]
}

export const baseInvoice: Invoice = {
  invoiceNo: 20241220,
  date: new Date().toDateString().slice(4),
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
      id: 0,
      name: "Aluminum duct tape",
      quantity: 1,
      unitPrice: 5.00,
      amount: 5.00,
    },
    {
      id: 1,
      name: "Lightbulb",
      quantity: 2,
      unitPrice: 8.00,
      amount: 16.00,
    },
    {
      id: 2,
      name: "Screws",
      quantity: 30,
      unitPrice: 0.60,
      amount: 18.00,
    },
    {
      id: 3,
      name: "Labor",
      amount: 200.00,
    }
  ]
}