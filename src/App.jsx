import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import PublicLanguageTranslator from './components/common/PublicLanguageTranslator';
import AppRoutes from './routes/AppRoutes';
import './styles/global.css';
import './styles/admin.css';
import './styles/customer.css';
import './styles/responsive.css';
import './styles/reservation.css';
import './styles/chatbot.css';
import './styles/delivery.css';
export default function App(){return <BrowserRouter><LanguageProvider><AuthProvider><ToastProvider><PublicLanguageTranslator/><AppRoutes/></ToastProvider></AuthProvider></LanguageProvider></BrowserRouter>}
