import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { Invoice, baseInvoice, getCurrentDate } from './models/Invoice'
import { contactInfo } from './constants/contactInfo'
import { useForm } from 'react-hook-form'
import { FileDown, Plus, Save, Upload, X } from 'lucide-react'
import { toPdf } from './utils/pdfConverter'
import { fromJson, toJson } from './utils/jsonConverter'

const currencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

function App() {

  const [invoice] = useState<Invoice>(baseInvoice)
  const [currentItemCount, setCurrentItemCount] = useState(0)
  const {
    register, 
    handleSubmit, 
    watch, 
    getValues, 
    setValue,
    reset
  } = useForm<Invoice>()
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const amounts = watch("items")?.map(item => item.amount) ?? [];
  const other1Fee = watch("other1Fee") || 0;
  const other2Fee = watch("other2Fee") || 0;

  const printRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const invoice = await fromJson(file)
      if (invoice) {
        reset(invoice); 
        setCurrentItemCount(invoice.items.length)
      }
    }
  }

  const setDefaultsValues= () => {
    if (!getValues('date')) 
      setValue('date', new Date().toDateString().slice(4))
    if (!getValues('invoiceNo'))
      setValue('invoiceNo', getCurrentDate())
  }
  setDefaultsValues() 

  const handleExportJson = (invoice: Invoice) => {
    toJson(invoice, `invoice-${invoice.customerInfo?.name}-${invoice?.date?.replace(/\s/g, '-')}`)
  }

  const handleDownloadPdf = async (invoice: Invoice) => {
    const element = printRef.current
    if (!element)
      return;
    
    await toPdf(element, `invoice-${invoice.customerInfo?.name}-${invoice?.date?.replace(/\s/g, '-')}`)
  }

  // Method 3: Use both success and error callbacks
  const onSubmit = handleSubmit(
    (data: Invoice) => {
      setErrors({})
      console.log('Success handler called', data);
      handleDownloadPdf(data);
    },
    (errors) => {
      setErrors({})
      console.log('Form has errors:', errors);
      const newErrors: { [key: string]: string } = {}
      if (errors?.customerInfo?.address) {
        newErrors.address = "Please enter an address"
      }
      if (errors?.customerInfo?.city) {
        newErrors.city = "Please enter a city"
      }
      console.log("Errors: ", newErrors)
      setErrors(newErrors)
    }
  );

  // Calculate amount for each row
  const calculateAmount = (index: number) => {
    const values = getValues(`items.${index}`);
    const quantity = values?.quantity ?? 0;
    const unitPrice = values?.unitPrice ?? 0;
    return quantity * unitPrice;
  };

  const calculatedSubtotal = useMemo(() => {
    return amounts?.reduce((sum, amount) => sum + amount, 0) ?? 0
  }, [amounts])

  const calculatedTotal = useMemo(() => calculatedSubtotal + other1Fee + other2Fee, [other1Fee, other2Fee])

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

  // const handleUpdateItem = (index: number, field: string, newValue: string | number) => {
  //   const currentList = getValues('items');
  //   const newList = [...currentList];
  //   if (field === "name") {
  //     newList[index].name = newValue as string;
  //   }
  //   else if (field === "quantity") {
  //     newList[index].quantity = newValue as number;
  //   }
  //   else if (field === "unitPrice") {
  //     newList[index].unitPrice = newValue as number;
  //   }
  //   setValue('items', newList);
  // };

  // Watch specific fields for changes
  useEffect(() => {
    const subscription = watch((_, { name }) => {
        if (name?.includes('quantity') || name?.includes('unitPrice')) {
            const index = parseInt(name.split('.')[1]); // Get the row index
            const amount = calculateAmount(index);
            setValue(`items.${index}.amount`, amount, {
                shouldDirty: true,
                shouldTouch: true,
            });
        }
    });
    
    return () => subscription.unsubscribe();
}, [watch, setValue, getValues]);
                
              
  return (
    <>
      <div 
        className={`w-[100vw] absolute z-[-10] bg-grid top-0 left-0`}
        style={{ 
          height: `${Math.max(
            window.innerHeight,
            document.documentElement.scrollHeight,
            (printRef?.current?.offsetHeight ?? 0) + 200
          )}px` 
        }}
      ></div>
      <div className="w-full flex flex-col items-center min-h-screen">
        <form onSubmit={onSubmit}>
          <div ref={printRef} className="bg-white shadow-lg rounded-lg p-8 w-[8.5in] max-w-2xl flex flex-col">
            
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
                      className={`h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white`}
                      placeholder="Enter customer name"
                      {...register("customerInfo.name")}
                    />
                    <input 
                      type="text"
                      className={`h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white ${errors.address !== undefined ? "border border-2 border-red-500" : ""}`}
                      placeholder="Enter customer address"
                      {...register("customerInfo.address", {required: true})}
                    />
                    <input 
                      type="text"
                      className={`h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white ${errors.city !== undefined ? "border border-2 border-red-500" : ""}`}
                      placeholder="Enter city"
                      {...register("customerInfo.city", {required: true})}
                    />
                  </div>
                  <div className="flex flex-col">
                    <input 
                      type="tel"
                      className="h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                      placeholder="Enter customer phone number"
                      {...register("customerInfo.phone")}
                    />
                    <input 
                      type="email"
                      className="h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                      placeholder="Enter customer email"
                      {...register("customerInfo.email")}
                    />
                  </div>
                </div>
                
                <div className="flex flex-row justify-between mb-4">
                  <div className="text-sm flex flex-col w-[48%]">
                    <label className="mr-2 font-bold mb-2">Description of issues and service: </label>
                    <textarea 
                        className="hide-scrollbar text-slate-800 text-sm outline-none py-1 px-2 hover:bg-slate-100 hover:py-2 placeholder:italic placeholder:text-gray-500 border border-2 border-gray-100 resize-none"
                        placeholder=""
                        {...register("description")}
                      />
                  </div>
                  <div className="text-sm flex flex-col w-[48%]">
                    <label className="mr-2 font-bold mb-2">Recommendations: </label>
                    <textarea 
                        className="hide-scrollbar text-slate-800 text-sm outline-none py-1 px-2 hover:bg-slate-100 hover:py-2 placeholder:italic placeholder:text-gray-500 border border-2 border-gray-100 resize-none"
                        placeholder=""
                        {...register("recommendation")}
                      />
                  </div>
                </div>

                <label className="mr-2 text-sm font-bold text-lg mb-2">Materials and Parts: </label>
                <div className="w-full"> 
                  <table className="w-full text-sm mb-4 table-fixed"> 
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left w-1/2">Description</th> 
                        <th className="border p-2 text-right w-1/6">Quantity</th>
                        <th className="border p-2 text-right w-1/6">Unit Price</th>
                        <th className="border p-2 text-right w-1/6">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getValues("items")?.map((item, index) => (
                        <tr key={item.id} className="relative group">
                          <td className="border p-2">
                            <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity top-4 -right-5 cursor-pointer">
                              <X 
                                size={16} 
                                className="text-gray-500 hover:text-red-500"
                                onClick={() => handleRemoveItem(index)}
                              />
                            </div>
                            <input 
                              {...register(`items.${index}.name`)}
                              type="text"
                              className="h-[30px] w-full text-slate-800 text-sm outline-none py-1 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                              placeholder="Item description"
                            />
                          </td>
                          <td className="border p-2">
                            <input 
                              {...register(`items.${index}.quantity`, {valueAsNumber: true })}
                              type="number"
                              min="0"
                              step="any"
                              defaultValue={0}
                              className="h-[30px] w-full text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                            />
                          </td>
                          <td className="border p-2">
                            <input 
                              {...register(`items.${index}.unitPrice`, {valueAsNumber: true })}
                              type="number"
                              min="0"
                              step="any"
                              defaultValue={0}
                              className="h-[30px] w-full text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                            />
                          </td>
                          <td className="border p-2 text-right text-slate-800 text-sm py-1 hover:bg-slate-100 hover:pl-2 hover:py-2">
                            {currencyFormatter.format(calculateAmount(index))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    <div className="w-full flex flex-col align-right">
                      <div className="text-sm text-right pb-1 label-padded">Subtotal: {currencyFormatter.format(calculatedSubtotal).slice(1)}</div>
                      <div className="flex justify-end">
                        <input 
                          type="text"
                          className={`text-right h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white`}
                          placeholder=""
                          {...register("other1")}
                        />
                        <input 
                          {...register(`other1Fee`, {valueAsNumber: true })}
                          type="number"
                          min="0"
                          step="any"
                          className="w-[60px] h-[30px] text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100  placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                        />
                      </div>
                      <div className="flex justify-end">
                        <input 
                          type="text"
                          className={`text-right h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 placeholder:italic placeholder:text-gray-500 autofill:bg-white`}
                          placeholder=""
                          {...register("other2")}
                        />
                        <input 
                          {...register(`other2Fee`, {valueAsNumber: true })}
                          type="number"
                          min="0"
                          step="any"
                          className="w-[60px] h-[30px] text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100  placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                        />
                      </div>
                      <div className="text-sm font-bold text-right pt-1 label-padded">Total: {currencyFormatter.format(calculatedTotal)}</div>
                    </div>
                </div>

              </div>
          </div>

          <div className="relative w-full flex justify-center p-8 gap-4">
            <button 
              className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-4 align-center hover:bg-blue-500 hover:shadow-xl active:scale-[.8]" 
              type="submit"
            >
              <div><FileDown size={20}/></div>
              <div>Export to PDF</div>
            </button>

            <button 
              className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-4 align-center hover:bg-blue-500 hover:shadow-xl active:scale-[.8]" 
              onClick={() => handleAddItem()}
              type="button"
            >
              <div><Plus size={20}/></div>
              <div>Add new item</div>
            </button>
            <div className="absolute right-0 flex">
              <button
                className="p-2 text-gray-600"
                type="button"
                title='Save'
                onClick={() => handleExportJson(getValues())}
              >
                <Save size={20} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                className="p-2 text-gray-600"
                type="button"
                title='Import'
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} />
              </button>
            </div>
            
          </div>
        </form>
      </div>
    </>
  )
}

export default App
