import ReactDOM from "react-dom/client";

import App from "../../App";

export function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}
