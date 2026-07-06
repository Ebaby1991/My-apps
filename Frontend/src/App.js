import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import CommandCenter from "./pages/CommandCenter";
import Nodes from "./pages/Nodes";
import Deploy from "./pages/Deploy";
import WalletPage from "./pages/Wallet";
import Setup from "./pages/Setup";
import Advisor from "./pages/Advisor";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<CommandCenter />} />
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/advisor" element={<Advisor />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/setup" element={<Setup />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
