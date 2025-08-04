import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./components/homePage";
import StreamPage from "./components/streamPage";
import WatchPage from "./components/watchPage";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/stream/:roomId/:userId" element={<StreamPage />} />
        <Route path="/watch" element={<WatchPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


