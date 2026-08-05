import React, { useState, useEffect } from 'react';
import {
  Wallet, Plus, Minus, CreditCard, Search, DollarSign,
  Truck, User, CheckCircle, XCircle, RefreshCw, TrendingUp,
  ArrowDownLeft, ArrowUpRight, Clock, AlertCircle, Phone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CustomerWalletInfo {
  id: string;
  customerPhone: string;
  balance: string;
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: string;
}

interface CustomerWalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'loyalty';
  amount: string;
  description: string;
  orderId?: string;
  createdAt: string;
}

interface Customer {
  phone: string;
  name: string;
  address: string;
}

interface DriverFinanceSummary {
  id: string;
  name: string;
  phone: string;
  balance: {
    totalBalance: string;
    availableBalance: string;
    withdrawnAmount: string;
    pendingAmount: string;
  };
}

interface DriverDetailFinances {
  balance: {
    totalBalance: string;
    availableBalance: string;
    withdrawnAmount: string;
    pendingAmount: string;
  };
  transactions: Array<{
    id: string;
    type: string;
    amount: string;
    description: string;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    amount: string;
    status: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    adminNotes?: string;
    createdAt: string;
  }>;
}

export default function WalletManagement() {
  const { toast } = useToast();
  const [activeMainTab, setActiveMainTab] = useState<'drivers' | 'customers'>('drivers');

  // ===== Customer Wallets State =====
  const [customerWallets, setCustomerWallets] = useState<CustomerWalletInfo[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string>('');
  const [customerTransactions, setCustomerTransactions] = useState<CustomerWalletTransaction[]>([]);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerAddForm, setShowCustomerAddForm] = useState(false);
  const [customerTxForm, setCustomerTxForm] = useState({
    type: 'credit' as 'credit' | 'debit',
    amount: '',
    description: ''
  });

  // ===== Driver Wallets State =====
  const [driversFinances, setDriversFinances] = useState<DriverFinanceSummary[]>([]);
  const [isDriverLoading, setIsDriverLoading] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [driverDetails, setDriverDetails] = useState<DriverDetailFinances | null>(null);
  const [isDriverDetailLoading, setIsDriverDetailLoading] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);

  // Form for driver manual transaction
  const [showDriverTxForm, setShowDriverTxForm] = useState(false);
  const [driverTxForm, setDriverTxForm] = useState({
    type: 'bonus' as 'bonus' | 'deduction' | 'adjustment',
    amount: '',
    description: ''
  });
  const [isSubmittingDriverTx, setIsSubmittingDriverTx] = useState(false);

  useEffect(() => {
    if (activeMainTab === 'drivers') {
      fetchDriversFinances();
      fetchPendingWithdrawals();
    } else {
      fetchCustomers();
      fetchCustomerWallets();
    }
  }, [activeMainTab]);

  useEffect(() => {
    if (selectedCustomerPhone) {
      fetchCustomerTransactions(selectedCustomerPhone);
    }
  }, [selectedCustomerPhone]);

  useEffect(() => {
    if (selectedDriverId) {
      fetchDriverDetails(selectedDriverId);
    }
  }, [selectedDriverId]);

  // ===== CUSTOMER WALLETS API CALLS =====
  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      if (Array.isArray(data)) setCustomers(data);
    } catch (error) {
      console.error('خطأ في جلب العملاء:', error);
    }
  };

  const fetchCustomerWallets = async () => {
    setIsCustomerLoading(true);
    try {
      const response = await fetch('/api/wallets');
      const data = await response.json();
      if (Array.isArray(data)) setCustomerWallets(data);
    } catch (error) {
      console.error('خطأ في جلب المحافظ:', error);
    } finally {
      setIsCustomerLoading(false);
    }
  };

  const fetchCustomerTransactions = async (phone: string) => {
    try {
      const response = await fetch(`/api/wallets/${phone}/transactions`);
      const data = await response.json();
      if (Array.isArray(data)) setCustomerTransactions(data);
    } catch (error) {
      console.error('خطأ في جلب المعاملات:', error);
    }
  };

  const addCustomerTransaction = async () => {
    if (!selectedCustomerPhone || !customerTxForm.amount || !customerTxForm.description) {
      toast({ title: 'خطأ', description: 'يرجى تعبئة جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch(`/api/wallets/${selectedCustomerPhone}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: customerTxForm.type,
          amount: parseFloat(customerTxForm.amount),
          description: customerTxForm.description
        })
      });

      if (response.ok) {
        toast({ title: 'تمت الإضافة', description: 'تم تسجيل المعاملة بنجاح' });
        setCustomerTxForm({ type: 'credit', amount: '', description: '' });
        setShowCustomerAddForm(false);
        fetchCustomerTransactions(selectedCustomerPhone);
        fetchCustomerWallets();
      } else {
        toast({ title: 'خطأ', description: 'فشل في إضافة المعاملة', variant: 'destructive' });
      }
    } catch (error) {
      console.error('خطأ في إضافة المعاملة:', error);
    }
  };

  const getCustomerName = (phone: string) => {
    const customer = customers.find(c => c.phone === phone);
    return customer ? customer.name : 'غير محدد';
  };

  // ===== DRIVER WALLETS API CALLS =====
  const fetchDriversFinances = async () => {
    setIsDriverLoading(true);
    try {
      const response = await fetch('/api/admin/drivers/finances');
      const data = await response.json();
      if (Array.isArray(data)) {
        setDriversFinances(data);
        if (data.length > 0 && !selectedDriverId) {
          setSelectedDriverId(data[0].id);
        }
      }
    } catch (error) {
      console.error('خطأ في جلب ماليات السائقين:', error);
    } finally {
      setIsDriverLoading(false);
    }
  };

  const fetchPendingWithdrawals = async () => {
    try {
      const response = await fetch('/api/admin/withdrawals/pending');
      const data = await response.json();
      if (Array.isArray(data)) setPendingWithdrawals(data);
    } catch (error) {
      console.error('خطأ في جلب طلبات السحب:', error);
    }
  };

  const fetchDriverDetails = async (driverId: string) => {
    setIsDriverDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/drivers/${driverId}/finances`);
      const data = await response.json();
      setDriverDetails(data);
    } catch (error) {
      console.error('خطأ في جلب تفاصيل ماليات السائق:', error);
    } finally {
      setIsDriverDetailLoading(false);
    }
  };

  const handleAddDriverTransaction = async () => {
    if (!selectedDriverId || !driverTxForm.amount || !driverTxForm.description) {
      toast({ title: 'خطأ', description: 'يرجى إدخال المبلغ والوصف', variant: 'destructive' });
      return;
    }

    setIsSubmittingDriverTx(true);
    try {
      const response = await fetch(`/api/admin/drivers/${selectedDriverId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(driverTxForm.amount),
          type: driverTxForm.type,
          description: driverTxForm.description
        })
      });

      if (response.ok) {
        toast({ title: 'نجاح', description: 'تمت إضافة المعاملة بنجاح وتحديث محفظة السائق' });
        setDriverTxForm({ type: 'bonus', amount: '', description: '' });
        setShowDriverTxForm(false);
        fetchDriverDetails(selectedDriverId);
        fetchDriversFinances();
      } else {
        const err = await response.json();
        toast({ title: 'خطأ', description: err.error || 'فشل إضافة المعاملة', variant: 'destructive' });
      }
    } catch (error) {
      console.error('خطأ في إضافة معاملة السائق:', error);
    } finally {
      setIsSubmittingDriverTx(false);
    }
  };

  const handleProcessWithdrawal = async (withdrawalId: string, action: 'approve' | 'reject') => {
    try {
      const endpoint = action === 'approve'
        ? `/api/admin/withdrawals/${withdrawalId}/approve`
        : `/api/admin/withdrawals/${withdrawalId}`;
      
      const response = await fetch(endpoint, {
        method: action === 'approve' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ status: 'rejected', adminNotes: 'تم الرفض من الإدارة' }) : undefined
      });

      if (response.ok) {
        toast({
          title: action === 'approve' ? 'تمت الموافقة' : 'تم الرفض',
          description: action === 'approve' ? 'تم سداد المبلغ وقيده بنجاح' : 'تم رفض طلب السحب'
        });
        fetchPendingWithdrawals();
        fetchDriversFinances();
        if (selectedDriverId) fetchDriverDetails(selectedDriverId);
      } else {
        toast({ title: 'خطأ', description: 'فشل في إتمام العملية', variant: 'destructive' });
      }
    } catch (error) {
      console.error('خطأ في معالجة طلب السحب:', error);
    }
  };

  // Calculations for Customer Wallets
  const filteredCustomerWallets = customerWallets.filter(wallet => {
    const term = (customerSearch || '').toLowerCase().trim();
    if (!term) return true;
    const phone = wallet.customerPhone || '';
    const name = getCustomerName(phone) || '';
    return phone.toLowerCase().includes(term) || name.toLowerCase().includes(term);
  });
  const totalCustomerBalance = customerWallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance || '0'), 0);
  const totalCustomerPoints = customerWallets.reduce((sum, wallet) => sum + (wallet.loyaltyPoints || 0), 0);

  // Calculations for Driver Wallets
  const filteredDriverFinances = driversFinances.filter(d => {
    const term = (driverSearch || '').toLowerCase().trim();
    if (!term) return true;
    return (d.name || '').toLowerCase().includes(term) || (d.phone || '').toLowerCase().includes(term);
  });
  const totalDriverBalance = driversFinances.reduce((sum, d) => sum + parseFloat(d.balance?.availableBalance || '0'), 0);
  const totalDriverEarned = driversFinances.reduce((sum, d) => sum + parseFloat(d.balance?.totalBalance || '0'), 0);
  const totalDriverWithdrawn = driversFinances.reduce((sum, d) => sum + parseFloat(d.balance?.withdrawnAmount || '0'), 0);

  const selectedDriver = driversFinances.find(d => d.id === selectedDriverId);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Wallet className="text-orange-600 h-8 w-8" />
            إدارة المحافظ الإلكترونية
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            إدارة دقيقة ومباشرة لمحافظ السائقين والعملاء، السحوبات، والإيداعات المالية المرتبطة بقاعدة البيانات
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveMainTab('drivers')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              activeMainTab === 'drivers'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Truck size={18} />
            محافظ السائقين ({driversFinances.length})
          </button>
          <button
            onClick={() => setActiveMainTab('customers')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              activeMainTab === 'customers'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User size={18} />
            محافظ العملاء ({customerWallets.length})
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: DRIVER WALLETS                                  */}
      {/* ========================================================= */}
      {activeMainTab === 'drivers' && (
        <div className="space-y-6">
          {/* Top Driver Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                <Truck size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">إجمالي السائقين</span>
                <p className="text-2xl font-black text-gray-900">{driversFinances.length}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <DollarSign size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">إجمالي أرصدة السائقين المتاحة</span>
                <p className="text-2xl font-black text-emerald-600">
                  {totalDriverBalance.toLocaleString('ar-YE', { maximumFractionDigits: 0 })} ر.ي
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">إجمالي المستحقات المكتسبة</span>
                <p className="text-2xl font-black text-blue-600">
                  {totalDriverEarned.toLocaleString('ar-YE', { maximumFractionDigits: 0 })} ر.ي
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">طلبات السحب المعلقة</span>
                <p className="text-2xl font-black text-amber-600">{pendingWithdrawals.length}</p>
              </div>
            </div>
          </div>

          {/* Pending Driver Withdrawal Requests Bar */}
          {pendingWithdrawals.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
              <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2 mb-3">
                <AlertCircle className="text-amber-600" size={20} />
                طلبات سحب معلقة بانتظار موافقة الإدارة ({pendingWithdrawals.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingWithdrawals.map((pw) => (
                  <div key={pw.id} className="bg-white p-4 rounded-xl border border-amber-200 flex flex-col justify-between gap-3 shadow-xs">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-gray-900">{pw.userName}</span>
                        <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-sm">
                          {parseFloat(pw.amount || 0).toLocaleString('ar-YE')} ر.ي
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">البنك / الحساب: {pw.bankName || 'تحويل'} - {pw.accountNumber || 'لا يوجد'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(pw.createdAt).toLocaleString('ar-YE')}</p>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleProcessWithdrawal(pw.id, 'approve')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={14} /> موافقة وسداد
                      </button>
                      <button
                        onClick={() => handleProcessWithdrawal(pw.id, 'reject')}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                      >
                        <XCircle size={14} /> رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Driver Wallet Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left/Right Column: Drivers List (4/12) */}
            <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50 space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                    <Truck size={18} className="text-orange-600" />
                    سائقو المنصة
                  </h2>
                  <button onClick={fetchDriversFinances} className="text-xs text-orange-600 hover:underline flex items-center gap-1 font-bold">
                    <RefreshCw size={12} /> تحديث
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="ابحث باسم السائق أو الهاتف..."
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="divide-y max-h-[500px] overflow-y-auto">
                {isDriverLoading ? (
                  <div className="p-8 text-center text-gray-500">جاري تحميل حسابات السائقين...</div>
                ) : filteredDriverFinances.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">لا يوجد سائقون مطبقون للبحث</div>
                ) : (
                  filteredDriverFinances.map((driver) => {
                    const isSelected = selectedDriverId === driver.id;
                    const avail = parseFloat(driver.balance?.availableBalance || '0');
                    return (
                      <div
                        key={driver.id}
                        onClick={() => setSelectedDriverId(driver.id)}
                        className={`p-4 cursor-pointer transition-colors flex justify-between items-center ${
                          isSelected ? 'bg-orange-50/80 border-r-4 border-orange-600' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{driver.name}</h4>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone size={11} /> {driver.phone || 'لا يوجد رقم'}
                          </p>
                        </div>

                        <div className="text-left">
                          <span className={`text-sm font-black block ${avail >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {avail.toLocaleString('ar-YE', { maximumFractionDigits: 0 })} ر.ي
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">الرصيد المتاح</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Main Column: Selected Driver Wallet Details (7/12) */}
            <div className="lg:col-span-7 space-y-6">
              {selectedDriver ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Selected Driver Header */}
                  <div className="p-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">حساب محفظة سائق</span>
                        <h2 className="text-xl font-black">{selectedDriver.name}</h2>
                      </div>
                      <p className="text-xs text-orange-100 mt-1">📞 {selectedDriver.phone}</p>
                    </div>

                    <button
                      onClick={() => setShowDriverTxForm(!showDriverTxForm)}
                      className="bg-white text-orange-700 hover:bg-orange-50 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Plus size={16} />
                      إضافة/تسوية رصيد يدوية
                    </button>
                  </div>

                  {/* Driver Balance Overview Grid */}
                  <div className="p-5 grid grid-cols-3 gap-3 bg-gray-50 border-b">
                    <div className="bg-white p-3 rounded-xl border text-center">
                      <span className="text-xs text-gray-500 font-medium block mb-1">الرصيد المتاح للسحب</span>
                      <span className="text-lg font-black text-emerald-600">
                        {parseFloat(selectedDriver.balance?.availableBalance || '0').toLocaleString('ar-YE')} ر.ي
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border text-center">
                      <span className="text-xs text-gray-500 font-medium block mb-1">إجمالي المستحق المكتسب</span>
                      <span className="text-lg font-black text-blue-600">
                        {parseFloat(selectedDriver.balance?.totalBalance || '0').toLocaleString('ar-YE')} ر.ي
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border text-center">
                      <span className="text-xs text-gray-500 font-medium block mb-1">إجمالي المسحوب</span>
                      <span className="text-lg font-black text-gray-700">
                        {parseFloat(selectedDriver.balance?.withdrawnAmount || '0').toLocaleString('ar-YE')} ر.ي
                      </span>
                    </div>
                  </div>

                  {/* Manual Driver Transaction Form */}
                  {showDriverTxForm && (
                    <div className="p-5 border-b bg-orange-50/50 space-y-4">
                      <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <Plus size={16} className="text-orange-600" />
                        إضافة قيد / مكافأة / خصم يدوياً لمحفظة السائق
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">نوع المعاملة</label>
                          <select
                            value={driverTxForm.type}
                            onChange={(e) => setDriverTxForm({ ...driverTxForm, type: e.target.value as any })}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                          >
                            <option value="bonus">مكافأة / إيداع (+)</option>
                            <option value="deduction">خصم / غرامة (-)</option>
                            <option value="adjustment">تسوية حساب</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ (ريال)</label>
                          <input
                            type="number"
                            min="1"
                            value={driverTxForm.amount}
                            onChange={(e) => setDriverTxForm({ ...driverTxForm, amount: e.target.value })}
                            placeholder="مثال: 500"
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">بيان/سبب القيد</label>
                          <input
                            type="text"
                            value={driverTxForm.description}
                            onChange={(e) => setDriverTxForm({ ...driverTxForm, description: e.target.value })}
                            placeholder="سبب المعاملة..."
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowDriverTxForm(false)}
                          className="px-4 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={handleAddDriverTransaction}
                          disabled={isSubmittingDriverTx}
                          className="px-5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs"
                        >
                          {isSubmittingDriverTx ? 'جاري الحفظ...' : 'تأكيد وحفظ القيد'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Detailed Driver Transactions History Table */}
                  <div className="p-5">
                    <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center justify-between">
                      <span>كشف حساب معاملات السائق التفصيلية</span>
                      <span className="text-xs text-gray-400 font-normal">
                        سجل العمليات الإيداع والعمولات والسحب
                      </span>
                    </h3>

                    {isDriverDetailLoading ? (
                      <div className="p-6 text-center text-gray-400 text-sm">جاري جلب سجل المعاملات...</div>
                    ) : !driverDetails || driverDetails.transactions.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm border rounded-xl bg-gray-50">
                        لا توجد معاملات مسجلة في محفظة هذا السائق حتى الآن
                      </div>
                    ) : (
                      <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-gray-100 text-gray-700 font-bold border-b">
                            <tr>
                              <th className="p-3">#</th>
                              <th className="p-3">النوع</th>
                              <th className="p-3">البيان / الوصف</th>
                              <th className="p-3">المبلغ</th>
                              <th className="p-3">التاريخ والوقت</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {driverDetails.transactions.map((tx, idx) => {
                              const isPositive = tx.type === 'bonus' || tx.type === 'commission' || tx.type === 'earning';
                              return (
                                <tr key={tx.id || idx} className="hover:bg-gray-50">
                                  <td className="p-3 text-gray-400">{idx + 1}</td>
                                  <td className="p-3 font-bold">
                                    <span className={`px-2 py-0.5 rounded text-[11px] ${
                                      isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {tx.type === 'bonus' ? 'مكافأة' : tx.type === 'commission' ? 'عمولة توصيل' : tx.type === 'deduction' ? 'خصم' : tx.type}
                                    </span>
                                  </td>
                                  <td className="p-3 text-gray-700 font-medium">{tx.description || '-'}</td>
                                  <td className={`p-3 font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isPositive ? '+' : '-'}{parseFloat(tx.amount || '0').toLocaleString('ar-YE')} ر.ي
                                  </td>
                                  <td className="p-3 text-gray-400 text-[11px] whitespace-nowrap">
                                    {tx.createdAt ? new Date(tx.createdAt).toLocaleString('ar-YE') : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border text-gray-400">
                  اختر سائقاً من القائمة الجانبية لعرض تفاصيل كشف حساب محفظته الإلكترونية
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: CUSTOMER WALLETS                                */}
      {/* ========================================================= */}
      {activeMainTab === 'customers' && (
        <div className="space-y-6">
          {/* Customer Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Wallet size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">إجمالي محافظ العملاء</span>
                <p className="text-2xl font-black text-gray-900">{customerWallets.length}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <DollarSign size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">إجمالي الأرصدة المودعة</span>
                <p className="text-2xl font-black text-emerald-600">
                  {totalCustomerBalance.toLocaleString('ar-YE', { maximumFractionDigits: 0 })} ر.ي
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                <Plus size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">إجمالي نقاط الولاء</span>
                <p className="text-2xl font-black text-purple-600">{totalCustomerPoints}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                <CreditCard size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium font-medium">المحافظ النشطة</span>
                <p className="text-2xl font-black text-orange-600">
                  {customerWallets.filter(w => w.isActive).length}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Wallets List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 space-y-3">
                <h2 className="text-base font-bold text-gray-800">قائمة محافظ العملاء</h2>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="ابحث برقم الهاتف أو اسم العميل..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="max-h-[450px] overflow-y-auto divide-y">
                {isCustomerLoading ? (
                  <div className="p-8 text-center text-gray-500">جاري تحميل محافظ العملاء...</div>
                ) : filteredCustomerWallets.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">لا توجد محافظ عملاء مطابقة للبحث</div>
                ) : (
                  filteredCustomerWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      onClick={() => setSelectedCustomerPhone(wallet.customerPhone)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedCustomerPhone === wallet.customerPhone
                          ? 'bg-orange-50/80 border-r-4 border-orange-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">
                            {getCustomerName(wallet.customerPhone)}
                          </h4>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">📞 {wallet.customerPhone}</p>
                          <p className="text-[11px] text-purple-600 font-medium mt-1">
                            ⭐ نقاط الولاء: {wallet.loyaltyPoints || 0}
                          </p>
                        </div>

                        <div className="text-left">
                          <p className="text-base font-black text-emerald-600">
                            {parseFloat(wallet?.balance || '0').toLocaleString('ar-YE')} ر.ي
                          </p>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full inline-block mt-1 ${
                            wallet.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {wallet.isActive ? 'نشط' : 'غير نشط'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Customer Wallet Transactions & Add Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="text-base font-bold text-gray-800">
                  {selectedCustomerPhone
                    ? `حساب محفظة: ${getCustomerName(selectedCustomerPhone)}`
                    : 'اختر محفظة عميل'}
                </h2>

                {selectedCustomerPhone && (
                  <button
                    onClick={() => setShowCustomerAddForm(!showCustomerAddForm)}
                    className="bg-orange-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 hover:bg-orange-700"
                  >
                    <Plus size={14} /> إضافة/سحب رصيد
                  </button>
                )}
              </div>

              {showCustomerAddForm && selectedCustomerPhone && (
                <div className="p-4 border-b bg-orange-50/60 space-y-3">
                  <h3 className="font-bold text-xs text-gray-800">تسجيل معاملة رصيد للعميل</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">النوع</label>
                      <select
                        value={customerTxForm.type}
                        onChange={(e) => setCustomerTxForm({ ...customerTxForm, type: e.target.value as 'credit' | 'debit' })}
                        className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white"
                      >
                        <option value="credit">إيداع (+)</option>
                        <option value="debit">سحب (-)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">المبلغ (ريال)</label>
                      <input
                        type="number"
                        min="1"
                        value={customerTxForm.amount}
                        onChange={(e) => setCustomerTxForm({ ...customerTxForm, amount: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white font-bold"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">الوصف</label>
                      <input
                        type="text"
                        value={customerTxForm.description}
                        onChange={(e) => setCustomerTxForm({ ...customerTxForm, description: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white"
                        placeholder="سبب شحن المحفظة..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCustomerAddForm(false)}
                      className="px-3 py-1 text-xs rounded-lg border text-gray-600"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={addCustomerTransaction}
                      className="px-4 py-1 text-xs rounded-lg bg-emerald-600 text-white font-bold"
                    >
                      تأكيد وحفظ
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-[450px] overflow-y-auto p-4">
                {!selectedCustomerPhone ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    اختر عميلاً من القائمة لعرض كشف المعاملات
                  </div>
                ) : customerTransactions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    لا توجد معاملات سابقة لملاذ محفظة هذا العميل
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerTransactions.map((tx) => (
                      <div key={tx.id} className="p-3 border rounded-xl flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            {tx.type === 'credit' ? (
                              <ArrowDownLeft className="text-emerald-600" size={16} />
                            ) : (
                              <ArrowUpRight className="text-rose-600" size={16} />
                            )}
                            <span>{tx.type === 'credit' ? 'إيداع رصيد' : 'سحب / شراء'}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">{tx.description}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(tx.createdAt).toLocaleString('ar-YE')}
                          </p>
                        </div>

                        <div className="text-left font-black text-sm">
                          <span className={tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}>
                            {tx.type === 'credit' ? '+' : '-'}{parseFloat(tx.amount || '0').toLocaleString('ar-YE')} ر.ي
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
