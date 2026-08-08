import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/auth/Login';
import ForgotPasswordOtp from '../pages/auth/ForgotPasswordOtp';
import Home from '../pages/Home';
import PublicReservation from '../pages/reservations/PublicReservation';
import AdminLayout from '../layouts/AdminLayout';
import WaiterLayout from '../layouts/WaiterLayout';
import KitchenLayout from '../layouts/KitchenLayout';
import CashierLayout from '../layouts/CashierLayout';
import CustomerLayout from '../layouts/CustomerLayout';
import AdminDashboard from '../pages/admin/Dashboard';
import EmployeeManage from '../pages/admin/EmployeeManage';
import TableManage from '../pages/admin/TableManage';
import MenuManage from '../pages/admin/MenuManage';
import CategoryManage from '../pages/admin/CategoryManage';
import PromotionManage from '../pages/admin/PromotionManage';
import Report from '../pages/admin/Report';
import AdminOrderManage from '../pages/admin/OrderManage';
import WaiterHome from '../pages/waiter/WaiterHome';
import TableStatus from '../pages/waiter/TableStatus';
import OrderDetail from '../pages/waiter/OrderDetail';
import WaiterHistory from '../pages/waiter/WaiterHistory';
import WaiterOrderEntry from '../pages/waiter/WaiterOrderEntry';
import WaiterAccount from '../pages/waiter/WaiterAccount';
import WaiterRequests from '../pages/waiter/WaiterRequests';
import KitchenBoard from '../pages/kitchen/KitchenBoard';
import KitchenOrderDetail from '../pages/kitchen/KitchenOrderDetail';
import KitchenMenuList from '../pages/kitchen/KitchenMenuList';
import KitchenHistory from '../pages/kitchen/KitchenHistory';
import KitchenNotifications from '../pages/kitchen/KitchenNotifications';
import KitchenAccount from '../pages/kitchen/KitchenAccount';
import CashierHome from '../pages/cashier/CashierHome';
import Payment from '../pages/cashier/Payment';
import Invoice from '../pages/cashier/Invoice';
import PrintInvoice from '../pages/cashier/PrintInvoice';
import CashierReport from '../pages/cashier/CashierReport';
import CashierNotifications from '../pages/cashier/CashierNotifications';
import CashierAccount from '../pages/cashier/CashierAccount';
import CustomerMenu from '../pages/customer/CustomerMenu';
import FoodDetail from '../pages/customer/FoodDetail';
import Cart from '../pages/customer/Cart';
import OrderSuccess from '../pages/customer/OrderSuccess';
import CustomerOrders from '../pages/customer/CustomerOrders';
import CustomerReviews from '../pages/customer/CustomerReviews';
import ReviewManage from '../pages/admin/ReviewManage';
import InventoryManage from '../pages/admin/InventoryManage';
import CustomerLoyaltyManage from '../pages/admin/CustomerLoyaltyManage';
import AdminAccount from '../pages/admin/Account';
import WaiterReservations from '../pages/waiter/WaiterReservations';
import ProtectedRoute from './ProtectedRoute';
import DeliveryLayout from '../layouts/DeliveryLayout';
import DeliveryMenu from '../pages/delivery/DeliveryMenu';
import DeliveryCheckout from '../pages/delivery/DeliveryCheckout';
import DeliveryLookup from '../pages/delivery/DeliveryLookup';
import DeliveryTracking from '../pages/delivery/DeliveryTracking';
import DeliveryOrderManage from '../pages/admin/DeliveryOrderManage';
import SystemSettings from '../pages/admin/SystemSettings';
export default function AppRoutes(){return <Routes>
  <Route path="/" element={<Home/>}/>
  <Route path="/login" element={<Login/>}/>
  <Route path="/reservations" element={<PublicReservation/>}/>
  <Route path="/forgot-password" element={<ForgotPasswordOtp/>}/>
  <Route path="/delivery" element={<DeliveryLayout/>}>
    <Route index element={<DeliveryMenu/>}/>
    <Route path="checkout" element={<DeliveryCheckout/>}/>
    <Route path="lookup" element={<DeliveryLookup/>}/>
    <Route path="orders/:trackingCode" element={<DeliveryTracking/>}/>
  </Route>
  <Route path="/reset-password" element={<Navigate to="/forgot-password" replace/>}/>
  <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout/></ProtectedRoute>}>
    <Route index element={<AdminDashboard/>}/><Route path="employees" element={<EmployeeManage/>}/><Route path="tables" element={<TableManage/>}/><Route path="categories" element={<CategoryManage/>}/><Route path="menu" element={<MenuManage/>}/><Route path="inventory" element={<InventoryManage/>}/><Route path="promotions" element={<PromotionManage/>}/><Route path="orders" element={<AdminOrderManage/>}/><Route path="delivery-orders" element={<DeliveryOrderManage/>}/><Route path="customers" element={<CustomerLoyaltyManage/>}/><Route path="reviews" element={<ReviewManage/>}/><Route path="reports" element={<Report/>}/><Route path="service-requests" element={<Navigate to="/admin" replace/>}/><Route path="cashier-shifts" element={<Navigate to="/admin" replace/>}/><Route path="reservations" element={<Navigate to="/admin/tables?tab=reservations" replace/>}/><Route path="account" element={<AdminAccount/>}/><Route path="settings" element={<SystemSettings/>}/>
  </Route>
  <Route path="/waiter" element={<ProtectedRoute roles={['WAITER','ADMIN']}><WaiterLayout/></ProtectedRoute>}>
    <Route index element={<Navigate to="orders" replace/>}/>
    <Route path="orders" element={<TableStatus/>}/>
    <Route path="orders/:orderId" element={<OrderDetail/>}/>
    <Route path="tables" element={<WaiterHome/>}/>
    <Route path="history" element={<WaiterHistory/>}/>
    <Route path="requests" element={<WaiterRequests/>}/>
    <Route path="reservations" element={<WaiterReservations/>}/>
    <Route path="notifications" element={<Navigate to="/waiter/orders" replace/>}/>
    <Route path="order-entry" element={<WaiterOrderEntry/>}/>
    <Route path="account" element={<WaiterAccount/>}/>
  </Route>
  <Route path="/kitchen" element={<ProtectedRoute roles={['KITCHEN','ADMIN']}><KitchenLayout/></ProtectedRoute>}>
    <Route index element={<KitchenBoard/>}/>
    <Route path="orders" element={<Navigate to="/kitchen" replace/>}/>
    <Route path="orders/:orderId" element={<KitchenOrderDetail/>}/>
    <Route path="menu" element={<KitchenMenuList/>}/>
    <Route path="out-of-stock" element={<Navigate to="/kitchen/menu" replace/>}/>
    <Route path="history" element={<KitchenHistory/>}/>
    <Route path="delivery-orders" element={<DeliveryOrderManage/>}/>
    <Route path="notifications" element={<KitchenNotifications/>}/>
    <Route path="account" element={<KitchenAccount/>}/>
  </Route>
  <Route path="/cashier" element={<ProtectedRoute roles={['CASHIER','ADMIN']}><CashierLayout/></ProtectedRoute>}>
    <Route index element={<CashierHome mode="queue"/>}/>
    <Route path="history" element={<CashierHome mode="history"/>}/>
    <Route path="delivery-orders" element={<DeliveryOrderManage/>}/>
    <Route path="invoices/:orderId" element={<Invoice/>}/>
    <Route path="payments" element={<Navigate to="/cashier" replace/>}/>
    <Route path="payment/:orderId" element={<Payment/>}/>
    <Route path="print" element={<Navigate to="/cashier/history" replace/>}/>
    <Route path="print/:orderId" element={<PrintInvoice/>}/>
    <Route path="reports" element={<CashierReport/>}/>
    <Route path="shifts" element={<Navigate to="/cashier" replace/>}/>
    <Route path="notifications" element={<CashierNotifications/>}/>
    <Route path="account" element={<CashierAccount/>}/>
  </Route>
  <Route path="/table/:qrToken" element={<CustomerLayout/>}>
    <Route index element={<CustomerMenu/>}/><Route path="foods/:foodId" element={<FoodDetail/>}/><Route path="cart" element={<Cart/>}/><Route path="orders" element={<CustomerOrders/>}/><Route path="reviews" element={<CustomerReviews/>}/><Route path="orders/:orderId" element={<OrderSuccess/>}/><Route path="success/:orderId" element={<OrderSuccess/>}/>
  </Route>
</Routes>}
