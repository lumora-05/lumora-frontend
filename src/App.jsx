import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppRoutes from './routes/AppRoutes';
import './styles/global.css';
import './styles/admin.css';
import './styles/customer.css';
import './styles/responsive.css';
import './styles/reservation.css';
import './styles/chatbot.css';
import './styles/delivery.css';
export default function App(){return <BrowserRouter><AuthProvider><ToastProvider><AppRoutes/></ToastProvider></AuthProvider></BrowserRouter>}
