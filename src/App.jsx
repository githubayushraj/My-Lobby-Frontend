import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./components/HomePage";
import StreamPage from "./components/StreamPage";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/stream/:roomId/:userId" element={<StreamPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


