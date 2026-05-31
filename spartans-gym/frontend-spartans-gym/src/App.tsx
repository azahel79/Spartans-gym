import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./router/AppRouter";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Al final de tu JSX


function App() {
  return (
      <BrowserRouter>
        <AppRouter />
        {/* El contenedor debe ir aquí para que las notificaciones floten sobre tu app */}
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark" // Puedes cambiarlo a "colored" para que combine con tu diseño rojo
       // Rojo global
      />
      </BrowserRouter>
  );
}

export default App;