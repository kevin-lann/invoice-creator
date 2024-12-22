import { useState } from 'react'
import './App.css'
import { Invoice, testInvoice } from './models/Invoice'
import { contactInfo } from './constants/contactInfo'
import { useForm, SubmitHandler } from 'react-hook-form'
import { FileDown } from 'lucide-react'

function App() {

  const [invoice, setInvoice] = useState<Invoice>(testInvoice)
  const {register, handleSubmit, watch, formState: { errors }} = useForm<Invoice>()
  const onSubmit: SubmitHandler<Invoice> = (data) => {
    console.log(data)
  }

  return (
    <>
      <div className="w-full flex flex-col items-center min-h-screen">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white shadow-lg rounded-lg p-8 w-[8.5in] max-w-2xl flex flex-col">
            
              <div id="export" className="flex flex-col pb-4">

                <div className="flex flex-row justify-between">
                  <div className="text-align-left">
                    <h1 className="text-2xl font-bold">INVOICE</h1>
                    <p className="text-slate-600 text-sm">Invoice number: {invoice.invoiceNo}</p>
                  </div>
                  <div className="text-align-right flex flex-col gap-1">
                    <h2 className="font-bold">Barney's Home Repair</h2>
                    <p className="text-slate-600 text-sm">Phone: {contactInfo.phone}</p>
                    <p className="text-slate-600 text-sm">Email: {contactInfo.email}</p>
                    <p className="text-slate-600 text-sm">Wechat ID: {contactInfo.weChatId}</p>
                  </div>
                </div>

                <h2 className="font-bold text-xl mb-2 pt-4">Bill To:</h2>
                <div className = "flex flex-row justify-between pb-4">
                  <div className="flex flex-col">
                    <input 
                      type="text"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500"
                      placeholder="Enter customer name"
                      {...register("customerInfo.name")}
                    />
                    <input 
                      type="text"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500"
                      placeholder="Enter customer address"
                      {...register("customerInfo.address")}
                    />
                    <input 
                      type="text"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500"
                      placeholder="Enter city"
                      {...register("customerInfo.address")}
                    />
                  </div>
                  <div className="flex flex-col">
                    <input 
                      type="tel"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500"
                      placeholder="Enter customer phone number"
                      {...register("customerInfo.address")}
                    />
                    <input 
                      type="email"
                      className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500"
                      placeholder="Enter customer phone number"
                      {...register("customerInfo.address")}
                    />
                  </div>
                </div>
                
                <div className="flex flex-row justify-between">
                  <div className="text-sm flex flex-col w-[48%]">
                    <label className="mr-2">Description of issues and service: </label>
                    <textarea 
                        className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 border border-2 border-gray-100"
                        placeholder="Enter Description"
                        {...register("customerInfo.address")}
                      />
                  </div>
                  <div className="text-sm flex flex-col w-[48%]">
                    <label className="mr-2">Recommendations: </label>
                    <textarea 
                        className="text-slate-800 text-sm outline-none py-1 pr-2 hover:bg-slate-100 hover:pl-2 hover:py-2 placeholder:italic placeholder:text-gray-500 border border-2 border-gray-100"
                        placeholder="Enter Recommendations"
                        {...register("customerInfo.address")}
                      />
                  </div>
                </div>

              </div>
          </div>
          <div className="w-full flex justify-center p-8">
            <button 
              className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-4 align-center" 
              type="submit"
            >
              <div><FileDown size={20}/></div>
              <div>Export to PDF</div>
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default App
