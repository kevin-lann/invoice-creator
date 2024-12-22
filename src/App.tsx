import { useEffect, useState } from 'react'
import './App.css'
import { Invoice, baseInvoice } from './models/Invoice'
import { contactInfo } from './constants/contactInfo'
import { useForm, SubmitHandler, useFieldArray } from 'react-hook-form'
import { FileDown, Plus } from 'lucide-react'

function App() {

  const [invoice, setInvoice] = useState<Invoice>(baseInvoice)
  const [currentItemCount, setCurrentItemCount] = useState(0)
  const {register, handleSubmit, watch, formState: { errors }, getValues, setValue} = useForm<Invoice>()

  const items = watch("items");

  const onSubmit: SubmitHandler<Invoice> = (data) => {
    // export pdf
    console.log(data)
  }

  // Calculate amount for each row
  const calculateAmount = (index: number) => {
    const quantity = items[index]?.quantity ?? 0;
    const unitPrice = items[index]?.unitPrice ?? 0;
    return quantity * unitPrice;
  };

  const handleAddItem = () => {
    const currentList = getValues('items') || [];
    setValue("items", [...currentList, {id: currentItemCount, name: "New item", amount: 0}])
    setCurrentItemCount(prev => prev + 1)
  }

  const handleRemoveItem = (index: number) => {
    const currentList = getValues('items');
    setValue('items', currentList.filter((_, i) => i !== index));
    setCurrentItemCount(prev => prev - 1)
  };

  const handleUpdateItem = (index: number, field: string, newValue: string | number) => {
    const currentList = getValues('items');
    const newList = [...currentList];
    if (field === "name") {
      newList[index].name = newValue as string;
    }
    else if (field === "quantity") {
      newList[index].quantity = newValue as number;
    }
    else if (field === "unitPrice") {
      newList[index].unitPrice = newValue as number;
    }
    setValue('items', newList);
  };

  // Watch specific fields for changes
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name?.includes('quantity') || name?.includes('unitPrice')) {
        const index = parseInt(name.split('.')[1]); // Get the row index
        const amount = calculateAmount(index);
        setValue(`items.${index}.amount`, amount);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [watch, setValue])
                
              
  return (
    <>
      <div className="w-full flex flex-col items-center min-h-screen">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white shadow-lg rounded-lg p-8 w-[8.5in] max-w-2xl flex flex-col">
            
              <div id="export" className="flex flex-col pb-4">

                <div className="flex flex-row justify-between">
                  <div className="text-align-left">
                    <h1 className="text-2xl font-bold">INVOICE</h1>
                    <p className="text-sm">Invoice number: {invoice.invoiceNo}</p>
                    <p className="text-sm">{invoice.date}</p>
                  </div>
                  <div className="text-align-right flex flex-col gap-1">
                    <h2 className="font-bold">Barney's Home Repair</h2>
                    <p className="text-sm">Phone: {contactInfo.phone}</p>
                    <p className="text-sm">Email: {contactInfo.email}</p>
                    <p className="text-sm">Wechat ID: {contactInfo.weChatId}</p>
                  </div>
                </div>

                <h2 className="font-bold text-lg mb-2 pt-4">Bill To:</h2>
                <div className = "flex flex-row justify-between pb-4">
                  <div className="flex flex-col">
                    <input 
                      type="text"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                      placeholder="Enter customer name"
                      {...register("customerInfo.name")}
                    />
                    <input 
                      type="text"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                      placeholder="Enter customer address"
                      {...register("customerInfo.address", {required: true})}
                    />
                    <input 
                      type="text"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                      placeholder="Enter city"
                      {...register("customerInfo.city", {required: true})}
                    />
                  </div>
                  <div className="flex flex-col">
                    <input 
                      type="tel"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                      placeholder="Enter customer phone number"
                      {...register("customerInfo.phone")}
                    />
                    <input 
                      type="email"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                      placeholder="Enter customer phone number"
                      {...register("customerInfo.email")}
                    />
                  </div>
                </div>
                
                <div className="flex flex-row justify-between mb-4">
                  <div className="text-sm flex flex-col w-[48%]">
                    <label className="mr-2 font-bold mb-2">Description of issues and service: </label>
                    <textarea 
                        className="text-slate-800 text-sm outline-none py-1 px-2 hover:bg-slate-100 hover:py-2 placeholder:italic placeholder:text-gray-500 border border-2 border-gray-100 resize-none"
                        placeholder=""
                        {...register("description")}
                      />
                  </div>
                  <div className="text-sm flex flex-col w-[48%]">
                    <label className="mr-2 font-bold mb-2">Recommendations: </label>
                    <textarea 
                        className="text-slate-800 text-sm outline-none py-1 px-2 hover:bg-slate-100 hover:py-2 placeholder:italic placeholder:text-gray-500 border border-2 border-gray-100 resize-none"
                        placeholder=""
                        {...register("customerInfo.address")}
                      />
                  </div>
                </div>

                <label className="mr-2 text-sm font-bold text-lg mb-2">Materials and Parts: </label>
<div className="w-full overflow-x-auto"> {/* Add overflow handling */}
  <table className="w-full text-sm mb-4 table-fixed"> {/* Add table-fixed */}
    <thead>
      <tr className="bg-gray-100">
        <th className="border p-2 text-left w-1/2">Description</th> {/* Set relative widths */}
        <th className="border p-2 text-right w-1/6">Quantity</th>
        <th className="border p-2 text-right w-1/6">Unit Price</th>
        <th className="border p-2 text-right w-1/6">Total</th>
      </tr>
    </thead>
    <tbody>
      {getValues("items")?.map((item, index) => (
        <tr key={item.id}>
          <td className="border p-2">
            <input 
              {...register(`items.${index}.name`)}
              type="text"
              className="w-full text-slate-800 text-sm outline-none py-1 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
              placeholder="Item description"
            />
          </td>
          <td className="border p-2">
            <input 
              {...register(`items.${index}.quantity`)}
              type="number"
              className="w-full text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
            />
          </td>
          <td className="border p-2">
            <input 
              {...register(`items.${index}.unitPrice`)}
              type="number"
              className="w-full text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
            />
          </td>
          <td className="border p-2 text-right text-slate-800 text-sm py-1 hover:bg-slate-100 hover:pl-2 hover:py-2">
            ${calculateAmount(index).toLocaleString()}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

              </div>
          </div>
          <div className="w-full flex justify-center p-8 gap-4">
            <button 
              className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-4 align-center" 
              type="submit"
            >
              <div><FileDown size={20}/></div>
              <div>Export to PDF</div>
            </button>

            <button 
              className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-4 align-center" 
              type="submit"
              onClick={() => handleAddItem()}
            >
              <div><Plus size={20}/></div>
              <div>Add new item</div>
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default App
