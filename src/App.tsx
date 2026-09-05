import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import StorageWarning from './components/StorageWarning'
import InvoiceEditor from './pages/InvoiceEditor'
import InvoiceReports from './pages/InvoiceReports'
import InvoicesList from './pages/InvoicesList'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm px-4 py-2 rounded-md no-underline transition-colors ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'bg-white text-slate-700 shadow hover:bg-slate-100'
  }`

function App() {
  return (
    <div className="w-full flex flex-col items-center">
      <nav className="flex gap-2 pb-6">
        <NavLink to="/" end className={navLinkClass}>Editor</NavLink>
        <NavLink to="/invoices" end className={navLinkClass}>All invoices</NavLink>
        <NavLink to="/reports" end className={navLinkClass}>Reports</NavLink>
      </nav>
      <StorageWarning />
      <Routes>
        <Route path="/" element={<InvoiceEditor />} />
        <Route path="/invoices" element={<InvoicesList />} />
        <Route path="/invoices/:id" element={<InvoiceEditor />} />
        <Route path="/reports" element={<InvoiceReports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
