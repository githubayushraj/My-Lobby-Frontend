import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./components/HomePage";
import StreamPage from "./components/StreamPage";
import WatchPage from "./components/WatchPage"


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/stream/:roomId/:userId" element={<StreamPage />} />
        <Route path="/watch/:roomId/:userId" element={<WatchPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


