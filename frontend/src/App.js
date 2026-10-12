import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ProductPage from "@/pages/ProductPage";
import QuoteRequest from "@/pages/QuoteRequest";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminProductForm from "@/pages/admin/AdminProductForm";
import AdminQuotes from "@/pages/admin/AdminQuotes";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/produto/:id" element={<ProductPage />} />
            <Route path="/orcamento" element={<QuoteRequest />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/produtos" element={<AdminProducts />} />
            <Route path="/admin/produtos/novo" element={<AdminProductForm />} />
            <Route path="/admin/produtos/:id" element={<AdminProductForm />} />
            <Route path="/admin/orcamentos" element={<AdminQuotes />} />
          </Routes>
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;
