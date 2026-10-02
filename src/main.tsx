import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { loadImportedData, setDataProvider } from "./lib/data-provider";

// Restore a dataset the user imported in a previous session
const imported = loadImportedData();
if (imported) setDataProvider(imported);

createRoot(document.getElementById("root")!).render(<App />);
