import { useEffect, useRef, useState } from 'react'
import '../App.css'
import {
  DEFAULT_INVOICE_STATUS,
  INVOICE_STATUSES,
  Invoice,
  baseInvoice,
  getCurrentDate,
} from '../models/Invoice'
import { breakdownOf, breakdownTotal } from '../models/AmountType'
import { CHARGES, chargeAmounts, type ChargeKey } from '../models/charges'
import { invoiceStatusStyles } from '../constants/invoiceStatus'
import { contactInfo } from '../constants/contactInfo'
import { useForm } from 'react-hook-form'
import { Database, FileDown, Plus, Save, Upload, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { findUnpaidInvoicesForCustomer, getInvoice, saveInvoice } from '../db/invoiceRepository'
import { fromJson, toJson } from '../utils/jsonConverter'
import ResizeableTextArea from '../components/ResizeableTextArea'
import UnpaidCustomerWarning from '../components/UnpaidCustomerWarning'
import { COMPANY_NAME } from '../constants/constants'
import { invoiceFileName } from '../utils/invoiceFileName'
import { currencyFormatter } from '../utils/currency'

function InvoiceEditor() {

  const [invoice] = useState<Invoice>(baseInvoice)
  const [currentItemCount, setCurrentItemCount] = useState(0)

  // Which fee is being typed into, and the text keyed into it. Only one input
  // can hold the caret, so one slot covers them all. While a fee is being typed
  // the box shows exactly what was keyed; every other time -- including the
  // moment an invoice is loaded off the database or out of a file -- it shows
  // the stored number at two decimal places.
  const [typedCharge, setTypedCharge] = useState<{ key: ChargeKey, text: string } | null>(null)
  const {
    register, 
    handleSubmit, 
    watch, 
    getValues, 
    setValue,
    reset
  } = useForm<Invoice>()
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // When the route carries an id we are editing an invoice out of IndexedDB,
  // otherwise this is a brand new one that gets an id on its first save.
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const routeId = id !== undefined && /^\d+$/.test(id) ? Number(id) : undefined
  const [savedId, setSavedId] = useState<number | undefined>(routeId)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (routeId === undefined)
      return

    let cancelled = false
    getInvoice(routeId).then(stored => {
      if (cancelled)
        return
      if (!stored) {
        navigate('/invoices', { replace: true })
        return
      }
      reset(stored)
      setCurrentItemCount(stored.items.length)
      setSavedId(stored.id)
    }).catch(error => console.error('Failed to load invoice', error))

    return () => { cancelled = true }
  }, [routeId, reset, navigate])

  // Effects run after paint, so this pulls the PDF chunk down in the background
  // without holding up the first render.
  useEffect(() => {
    import('../utils/pdfConverter').catch(() => {})
  }, [])

  // Let the "Saved!" confirmation fade back to the normal label.
  useEffect(() => {
    if (saveState !== 'saved')
      return
    const timeout = setTimeout(() => setSaveState('idle'), 2000)
    return () => clearTimeout(timeout)
  }, [saveState])

  const handleSaveToDatabase = async (data: Invoice) => {
    setSaveState('saving')
    try {
      const id = await saveInvoice(data, savedId)
      setSavedId(id)
      setSaveState('saved')
      if (savedId === undefined)
        navigate(`/invoices/${id}`, { replace: true })
    } catch (error) {
      console.error('Failed to save invoice', error)
      setSaveState('error')
    }
  }

  const watchedItems = watch("items") ?? [];
  const charges = chargeAmounts(watch());
  const date = watch("date") || new Date();
  const invoiceNo = watch("invoiceNo") || "";
  const status = watch("status") ?? DEFAULT_INVOICE_STATUS;

  const customerName = watch("customerInfo.name");
  const customerAddress = watch("customerInfo.address");
  const customerCity = watch("customerInfo.city");

  // Re-runs when the billing details change and when the invoices table does,
  // so the warning follows what is being typed and clears as soon as the debt
  // it is warning about is marked paid. The invoice being edited is left out,
  // since an unpaid invoice should not warn about itself.
  const unpaidForCustomer = useLiveQuery(
    () => findUnpaidInvoicesForCustomer(
      { name: customerName, address: customerAddress, city: customerCity },
      savedId,
    ),
    [customerName, customerAddress, customerCity, savedId],
    [],
  );

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
    if (!getValues('status'))
      setValue('status', DEFAULT_INVOICE_STATUS)
  }
  setDefaultsValues() 

  const handleExportJson = (invoice: Invoice) => {
    toJson(invoice, invoiceFileName(invoice))
  }

  const handleDownloadPdf = async (invoice: Invoice) => {
    const element = printRef.current
    if (!element)
      return;

    // jspdf and html2canvas are ~600kB between them and nothing renders until
    // the entry chunk has parsed, so they are fetched at the click instead.
    const { toPdf } = await import('../utils/pdfConverter')
    await toPdf(element, invoiceFileName(invoice))
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
    const quantity = values?.quantity || 0;
    const unitPrice = values?.unitPrice || 0;
    return quantity * unitPrice;
  };

  // Every figure in the totals block comes out of the same breakdown the list
  // and the reports read, so the editor cannot drift away from them -- which
  // fee is taxed and which is not is settled once, in the charge registry.
  // It is a handful of additions over items already in memory, so it costs
  // less than the dependency list memoising it would need.
  const breakdown = breakdownOf({ items: watchedItems, ...charges })
  const calculatedHST = breakdown.tax
  const calculatedTotal = breakdownTotal(breakdown)

  // The parts and the labour typed into the table, before any of the fees --
  // which is a different figure from the breakdown's parts, since a line item
  // named like labour is counted as labour there.
  const calculatedSubtotal = watchedItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  // One width for every fee's box, taken from the longest figure among them,
  // rather than a fixed width: a four-figure charge is then neither clipped on
  // screen nor cut off in the exported PDF. Sizing them together is what keeps
  // the labels in a column -- widening one box alone would leave its label
  // sitting out to the left of its neighbours. The rows are right-justified, so
  // the width they gain falls to the left and the figures stay where they are.
  // The added 14px is the box's own right padding, which holds its figure the
  // same distance off the edge as the Subtotal, HST and Total lines.
  const chargeWidth = `calc(${Math.max(
    5,
    ...CHARGES.map(charge => charges[charge.key].toFixed(2).length + 1),
  )}ch + 14px)`

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
        if (name === "date") {
          const date = getValues("date")
          setValue("invoiceNo", date.replace(/-/g, ""))
        }
    });
    
    return () => subscription.unsubscribe();
}, [watch, setValue, getValues]);
                
              
  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      <form onSubmit={onSubmit}>
        <div ref={printRef} className="bg-white shadow-lg rounded-lg p-8 w-[8.5in] max-w-2xl flex flex-col">
          
            <div id="export" className="flex flex-col pb-4">

              <div className="flex flex-row justify-between">
                <div className="text-align-left">
                  <h1 className="text-2xl font-bold">INVOICE</h1>
                  <div className="flex flex-row gap-3 items-center">
                    <p className="text-sm">Invoice number:
                    </p>
                    <input 
                      type="text"
                      id='invoiceNo'
                      className={`p-0 h-[30px] w-[90px] text-slate-800 text-sm outline-none rounded-md hover:bg-slate-100 placeholder:italic placeholder:text-gray-500 autofill:bg-white`}
                      placeholder="Date"
                      {...register("invoiceNo")}
                    />
                  </div>
                  <input 
                    type="date"
                    className={`h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white`}
                    placeholder="Date"
                    {...register("date")}
                  />
                </div>
                <div className="text-align-right flex items-end flex-col gap-1">
                  <h2 className="font-bold">{COMPANY_NAME}</h2>
                  <p className="text-sm">Phone: {contactInfo.phone}</p>
                  {/* <p className="text-sm">Email: {contactInfo.email}</p> */}
                  <p className="text-sm">Wechat ID: {contactInfo.weChatId}</p>
                </div>
              </div>

              <div className="flex flex-row items-center gap-3 mb-2 pt-4">
                <h2 className="font-bold text-lg">Bill To:</h2>
                <UnpaidCustomerWarning invoices={unpaidForCustomer} />
              </div>
              <div className = "flex flex-row justify-between pb-4">
                <div className="flex flex-col w-[60%]">
                  <input 
                    type="text"
                    className={`h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white`}
                    placeholder="Customer Name"
                    {...register("customerInfo.name")}
                  />
                  <input 
                    type="text"
                    className={`h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white ${errors.address !== undefined ? "border border-2 border-red-500" : ""}`}
                    placeholder="Customer Address"
                    {...register("customerInfo.address", {required: true})}
                  />
                  <input 
                    type="text"
                    className={`h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 rounded-md hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white ${errors.city !== undefined ? "border border-2 border-red-500" : ""}`}
                    placeholder="City"
                    {...register("customerInfo.city", {required: true})}
                  />
                </div>
                <div className="flex flex-col">
                  <input 
                    type="tel"
                    className="h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                    placeholder="Customer phone"
                    {...register("customerInfo.phone")}
                  />
                  <input 
                    type="email"
                    className="h-[30px] text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                    placeholder="Customer email"
                    {...register("customerInfo.email")}
                  />
                </div>
              </div>
              
              
                <div className="flex flex-col justify-between mb-4">
                  <div className="text-sm flex flex-col w-full">
                    <label className="mr-2 font-bold mb-2">Description of issues and service: </label>
                      <ResizeableTextArea
                        register={register}
                        registerValue='description'
                      />
                  </div>
                  <div className="text-sm flex flex-col w-full">
                    <label className="mr-2 font-bold mb-2">Recommendations: </label>
                      <ResizeableTextArea
                        register={register}
                        registerValue='recommendation'
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
                    <div className="text-sm text-right pb-1 label-padded">Subtotal: &nbsp;&nbsp; {currencyFormatter.format(calculatedSubtotal).slice(1)}</div>
                {CHARGES.map(charge => {
                      const field = register(charge.key, { valueAsNumber: true })
                      return (
                        <div key={charge.key} className="flex flex-row justify-end align-center">
                          <div className="pt-1 text-sm text-right">{charge.label}:</div>
                          <div>
                            <input
                              {...field}
                              value={typedCharge?.key === charge.key
                                ? typedCharge.text
                                : charges[charge.key].toFixed(2)}
                              onChange={event => {
                                setTypedCharge({ key: charge.key, text: event.target.value })
                                field.onChange(event)
                              }}
                              onBlur={event => {
                                const typed = event.target.valueAsNumber
                                const cents = Number.isFinite(typed) ? Math.round(typed * 100) / 100 : 0
                                setTypedCharge(null)
                                setValue(charge.key, cents, { shouldDirty: true })
                                field.onBlur(event)
                              }}
                              type="number"
                              min="0"
                              step="0.01"
                              style={{ width: chargeWidth }}
                              className="charge-input label-padded h-[30px] max-w-[180px] text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100  placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                            />
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-sm text-right pb-1 label-padded">HST: &nbsp;&nbsp; {currencyFormatter.format(calculatedHST).slice(1)}</div>
                    <div className="text-sm font-bold text-right pt-1 label-padded">Total: {currencyFormatter.format(calculatedTotal)}</div>
                  </div>
              </div>

            </div>
        </div>

        <div className="w-full flex justify-center pt-6">
          <div className="flex flex-row gap-2 items-center bg-white rounded-md shadow p-2">
            <span className="text-sm text-slate-600 px-2">Payment status</span>
            {INVOICE_STATUSES.map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={status === option}
                title={`Mark this invoice as ${invoiceStatusStyles[option].label.toLowerCase()}`}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                  status === option
                    ? invoiceStatusStyles[option].selected
                    : `${invoiceStatusStyles[option].badge} opacity-60 hover:opacity-100`
                }`}
                onClick={() => setValue('status', option, { shouldDirty: true })}
              >
                {invoiceStatusStyles[option].label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full flex justify-center p-8 pr-20 gap-4">
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

          <button 
            className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-4 align-center hover:bg-blue-500 hover:shadow-xl active:scale-[.8] disabled:opacity-60" 
            onClick={() => handleSaveToDatabase(getValues())}
            type="button"
            title={savedId === undefined ? 'Save invoice to database' : 'Update saved invoice'}
            disabled={saveState === 'saving'}
          >
            <div><Database size={20}/></div>
            <div>
              {saveState === 'saving' ? 'Saving...'
                : saveState === 'saved' ? 'Saved!'
                : saveState === 'error' ? 'Failed'
                : savedId === undefined ? 'Save' : 'Update'}
            </div>
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
  )
}

export default InvoiceEditor
