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
import {
  CHARGES,
  chargeAmounts,
  chargeNames,
  chargeTaxFlags,
  type ChargeKey,
} from '../models/charges'
import { invoiceStatusStyles } from '../constants/invoiceStatus'
import { contactInfo } from '../constants/contactInfo'
import { useForm } from 'react-hook-form'
import { Database, FileDown, Plus, Save, Upload, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { findUnpaidInvoicesForCustomer, getInvoice, saveInvoice } from '../db/invoiceRepository'
import { fromJson, toJson } from '../utils/jsonConverter'
import HstToggle from '../components/HstToggle'
import ResizeableTextArea from '../components/ResizeableTextArea'
import UnpaidCustomerWarning from '../components/UnpaidCustomerWarning'
import { COMPANY_NAME } from '../constants/constants'
import { invoiceFileName } from '../utils/invoiceFileName'
import { useAutosave } from '../hooks/useAutosave'
import { currencyFormatter } from '../utils/currency'

/** The clock time beside the save indicator: "2:31 p.m.", no seconds. */
const savedAtFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
})

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

  // The same id twice over. The state is what the buttons read; the ref is
  // what the writes read, because a blur handler built on an earlier render
  // would still be holding the id from then -- and on a new invoice, whose id
  // is undefined until its first write lands, that means filing it twice.
  const [savedId, setSavedId] = useState<number | undefined>(routeId)
  const savedIdRef = useRef<number | undefined>(routeId)
  /**
   * The invoice the form is actually holding, which is not the same as the one
   * the route names: between the two, the read is still in flight and the boxes
   * are empty.
   */
  const loadedIdRef = useRef<number | undefined>(undefined)

  const rememberSavedId = (id: number) => {
    savedIdRef.current = id
    loadedIdRef.current = id
    setSavedId(id)
  }

  /** Writes the form to the database, giving a new invoice its row and route. */
  const persistInvoice = async (data: Invoice) => {
    const id = await saveInvoice(data, savedIdRef.current)
    if (savedIdRef.current !== undefined)
      return
    rememberSavedId(id)
    // Now that it has a row, the editor moves onto it, so a reload comes back
    // to the invoice rather than to a blank form.
    navigate(`/invoices/${id}`, { replace: true })
  }

  const worthSaving = (data: Invoice, forced: boolean) => {
    // The route names an invoice the form has not been filled from yet. What
    // is in the boxes is an empty form, not an edit of that invoice, and
    // writing it would erase it -- so this one holds even for a save asked
    // for by hand.
    if (routeId !== undefined && loadedIdRef.current !== routeId)
      return false
    // An invoice with a row already keeps it up to date whatever it says.
    if (forced || savedIdRef.current !== undefined)
      return true
    // A new one earns its row once it says who it is for. Before that the
    // form is a blank the user may well walk away from, and autosaving it
    // would leave an empty invoice in the list. Address and city are what the
    // form itself insists on, so they are what counts as an invoice here too.
    return (data.customerInfo?.address ?? '').trim() !== ''
      && (data.customerInfo?.city ?? '').trim() !== ''
  }

  const { status: saveStatus, saveIfChanged, saveNow, markSaved } = useAutosave<Invoice>({
    read: getValues,
    write: persistInvoice,
    worthSaving,
  })

  useEffect(() => {
    // Nothing to load for a new invoice, and nothing to re-load for the one
    // already open: the first autosave of a new invoice moves the route onto
    // its id, and reading the database back here would overwrite whatever has
    // been typed since.
    if (routeId === undefined || routeId === loadedIdRef.current)
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
      rememberSavedId(stored.id)
      // The form now holds exactly what the database does, so the next blur
      // has nothing to write. Opening an invoice is not editing it.
      markSaved(getValues())
    }).catch(error => console.error('Failed to load invoice', error))

    return () => { cancelled = true }
  }, [routeId, reset, navigate, markSaved, getValues])

  // Effects run after paint, so this pulls the PDF chunk down in the background
  // without holding up the first render.
  useEffect(() => {
    import('../utils/pdfConverter').catch(() => {})
  }, [])

  const watchedItems = watch("items") ?? [];
  const watched = watch();
  const charges = chargeAmounts(watched);
  // The names typed for the fees that carry one, and which fees HST is being
  // charged on. Both come off the form rather than the registry: what a fee is
  // called and whether it is taxed are this invoice's answers, not the app's.
  const chargeLabels = chargeNames(watched);
  const taxedCharges = chargeTaxFlags(watched);
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
        // Read in, not typed in: an uploaded file lands in the editor to be
        // looked at, and only an edit of it goes on to the database.
        markSaved(getValues())
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
  const breakdown = breakdownOf({ items: watchedItems, ...charges, taxedCharges })
  const calculatedHST = breakdown.tax
  const calculatedTotal = breakdownTotal(breakdown)

  // The parts and the labour typed into the table, before any of the fees --
  // which is a different figure from the breakdown's parts, since a line item
  // named like labour is counted as labour there.
  const calculatedSubtotal = watchedItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  // Every figure the totals block prints, spelled the way it is printed: the
  // fees as their boxes hold them, and the three lines around them as the
  // formatter writes them, thousands separators and the total's dollar sign
  // included.
  const figures = [
    ...CHARGES.map(charge => charges[charge.key].toFixed(2)),
    currencyFormatter.format(calculatedSubtotal).slice(1),
    currencyFormatter.format(calculatedHST).slice(1),
    currencyFormatter.format(calculatedTotal),
  ]

  // One width for every figure in the block, taken from the longest of them,
  // rather than a fixed width: a four-figure charge is then neither clipped on
  // screen nor cut off in the exported PDF. Sizing them together is what puts
  // the colons in a column -- every row ends in a box this wide, so each label
  // stops at the same place, whatever the figure beside it happens to be. The
  // rows are right-justified, so the width they gain falls to the left and the
  // figures stay where they are. The spare character keeps the longest figure
  // off the colon, and the added 14px is each box's own right padding, which
  // holds every figure the same distance off the edge.
  const figureWidth = `calc(${Math.max(
    5,
    ...figures.map(figure => figure.length + 1),
  )}ch + 14px)`

  // How many line items HST is being charged on: what the subtotal's box
  // shows, and what clicking it flips.
  const taxedItemCount = watchedItems.filter(item => item.taxable === true).length
  const allItemsTaxed = watchedItems.length > 0 && taxedItemCount === watchedItems.length

  const taxTitle = (on: boolean, what: string) =>
    `${on ? 'Stop charging' : 'Charge'} HST on ${what}`

  const toggleItemTax = (index: number) =>
    setValue(`items.${index}.taxable`, watchedItems[index]?.taxable !== true, { shouldDirty: true })

  /** The subtotal's box covers every item beneath it: all on, or all off. */
  const toggleAllItemTax = () =>
    setValue(
      'items',
      (getValues('items') ?? []).map(item => ({ ...item, taxable: !allItemsTaxed })),
      { shouldDirty: true },
    )

  const toggleChargeTax = (key: ChargeKey) =>
    setValue(`taxedCharges.${key}`, !taxedCharges[key], { shouldDirty: true })

  const handleAddItem = () => {
    const currentList = getValues('items') || [];
    // Nothing is taxed until it is ticked, a new item included.
    setValue("items", [...currentList, {id: currentItemCount, name: "New item", amount: 0, taxable: false}])
    setCurrentItemCount(prev => prev + 1)
  }

  const handleRemoveItem = (index: number) => {
    const currentList = getValues('items');
    setValue('items', currentList.filter((_, i) => i !== index));
    setCurrentItemCount(prev => prev - 1)
    // Nothing blurs when a row is deleted: the X is not focusable, so focus
    // does not move, and the blur that mousedown does fire elsewhere carries
    // the row that is about to go. Without this the row is off the form but
    // still in the database until something else is edited. `setValue` has
    // already written the shortened list, so this reads it as it now stands.
    saveIfChanged()
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
      {/*
        * Autosave. React's onBlur is the native `focusout`, which bubbles, so
        * this one handler covers every box on the form -- the fees' own blur
        * handler included, since it has already rounded the figure into the
        * form by the time the event reaches here.
        */}
      <form onSubmit={onSubmit} onBlur={saveIfChanged}>
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
                  <p className="text-sm">Email: {contactInfo.email}</p>
                  <p className="text-sm">Phone: {contactInfo.phone}</p>
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
                      <th className="border p-2 text-left w-[42%]">Description</th> 
                      <th className="border p-2 text-right w-[14%]">Quantity</th>
                      <th className="border p-2 text-right w-[16%]">Unit Price</th>
                      <th className="border p-2 text-right w-[18%]">Total</th>
                      <th className="no-export border p-2 text-center w-[10%]">HST</th>
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
                        <td className="no-export border p-2">
                          <div className="flex justify-center">
                            <HstToggle
                              on={watchedItems[index]?.taxable === true}
                              title={taxTitle(
                                watchedItems[index]?.taxable === true,
                                item.name?.trim() || 'this item',
                              )}
                              onToggle={() => toggleItemTax(index)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  <div className="group w-full flex flex-col align-right">
                    <div className="text-sm pb-1 flex flex-row justify-end items-center">
                      <div className="no-export flex items-center pr-2">
                        <HstToggle
                          on={allItemsTaxed}
                          partial={taxedItemCount > 0 && !allItemsTaxed}
                          title={taxTitle(allItemsTaxed, 'every item above')}
                          onToggle={toggleAllItemTax}
                        />
                      </div>
                      <span>Subtotal:</span>
                      <span style={{ width: figureWidth }} className="label-padded text-right">
                        {currencyFormatter.format(calculatedSubtotal).slice(1)}
                      </span>
                    </div>
                {CHARGES.map(charge => {
                      const field = register(charge.key, { valueAsNumber: true })
                      // What this invoice calls the fee, falling back to the
                      // registry's name for it while nothing has been typed.
                      const name = 'nameKey' in charge ? chargeLabels[charge.nameKey].trim() : ''
                      // A fee the invoice names for itself, left both unnamed
                      // and at zero, is no part of this invoice: it is out of
                      // the printed copy, and out of sight on screen until the
                      // pointer is over the totals block, so an invoice that
                      // never needed it does not carry an empty row for it.
                      const unused = 'nameKey' in charge && name === '' && charges[charge.key] === 0
                      return (
                        <div
                          key={charge.key}
                          // `focus-within` outlives the hover: naming the fee
                          // is what stops it being unused, so clearing the name
                          // back to empty would otherwise pull the box out from
                          // under the cursor mid-edit. It also leaves the row
                          // reachable by tab, which hover alone would not.
                          className={`flex-row justify-end align-center ${
                            unused
                              ? 'no-export hidden group-hover:flex focus-within:flex'
                              : 'flex'
                          }`}
                        >
                          <div className="no-export flex items-center pr-2">
                            <HstToggle
                              on={taxedCharges[charge.key]}
                              title={taxTitle(
                                taxedCharges[charge.key],
                                `the ${(name || charge.label).toLowerCase()}`,
                              )}
                              onToggle={() => toggleChargeTax(charge.key)}
                            />
                          </div>
                          {'nameKey' in charge ? (
                            <>
                              <input
                                {...register(charge.nameKey)}
                                type="text"
                                placeholder={charge.label}
                                // Sized to the name it holds, the way the fee
                                // boxes are: the row is right-justified, so the
                                // box grows leftwards and the tick stays beside
                                // the name rather than out in white space.
                                style={{ width: `${Math.max(charge.label.length, name.length) + 1}ch` }}
                                className="h-[30px] max-w-[260px] text-right text-slate-800 text-sm outline-none py-1 rounded-md hover:bg-slate-100 placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                              />
                              <div className="pt-1 text-sm">:</div>
                            </>
                          ) : (
                            <div className="pt-1 text-sm text-right">{charge.label}:</div>
                          )}
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
                              style={{ width: figureWidth }}
                              className="charge-input label-padded h-[30px] max-w-[180px] text-right text-slate-800 text-sm outline-none py-1 hover:bg-slate-100  placeholder:italic placeholder:text-gray-500 autofill:bg-white"
                            />
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-sm pb-1 flex flex-row justify-end">
                      <span>HST:</span>
                      <span style={{ width: figureWidth }} className="label-padded text-right">
                        {currencyFormatter.format(calculatedHST).slice(1)}
                      </span>
                    </div>
                    {/*
                      * The bold sits on the words rather than the row: `ch` is
                      * the width of a digit in the element's own font, and a
                      * bold digit is the wider of the two, so a bold box would
                      * come out a couple of pixels broader than the boxes above
                      * it and carry this colon out of line with theirs.
                      */}
                    <div className="text-sm pt-1 flex flex-row justify-end">
                      <span className="font-bold">Total:</span>
                      <span style={{ width: figureWidth }} className="label-padded text-right">
                        <span className="font-bold">{currencyFormatter.format(calculatedTotal)}</span>
                      </span>
                    </div>
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

          {/*
            * Still here beside the autosave: it is what writes an invoice that
            * has no address yet, and what a user who does not trust an unasked
            * save reaches for. It is not disabled while a write is in flight --
            * the queue folds a second click into the one already running.
            */}
          <button 
            className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-4 align-center hover:bg-blue-500 hover:shadow-xl active:scale-[.8]" 
            onClick={saveNow}
            type="button"
            title={savedId === undefined ? 'Save invoice to database' : 'Update saved invoice'}
          >
            <div><Database size={20}/></div>
            <div>{savedId === undefined ? 'Save' : 'Update'}</div>
          </button>

          {/*
            * What autosave has managed, in the one place both it and the
            * button report to. Announced politely so it is not read out over
            * whatever is being typed.
            */}
          <div className="flex items-center text-sm" aria-live="polite">
            {saveStatus.state === 'saving' && (
              <span className="text-slate-500">Saving...</span>
            )}
            {saveStatus.state === 'saved' && (
              <span className="text-slate-500">
                Saved {savedAtFormatter.format(saveStatus.at)}
              </span>
            )}
            {saveStatus.state === 'error' && (
              <span
                className="text-red-600"
                title="This invoice could not be written to the database. Nothing typed has been lost -- it is still on the form, and the next change tries again."
              >
                Not saved
              </span>
            )}
          </div>
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
