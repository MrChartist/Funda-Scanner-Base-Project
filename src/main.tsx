import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { restoreActiveProvider } from "./lib/data";

// Choose the data source before the first render: the sample data, or the dataset the user
// imported in an earlier visit (an import saved by an earlier version is migrated once).
restoreActiveProvider();

createRoot(document.getElementById("root")!).render(<App />);
