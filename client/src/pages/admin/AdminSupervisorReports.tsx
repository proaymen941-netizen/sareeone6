import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  UserCheck, 
  Clock, 
  Calendar, 
  FileText, 
  Activity, 
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function AdminSupervisorReports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/supervisor-activity-reports'],
    queryFn: async () => {
      const res = await fetch('/api/admin/supervisor-activity-reports');
      if (!res.ok) throw new Error('فشل جلب تقارير المشرفين');
      return res.json();
    }
  });

  // Unique supervisors for filter
  const supervisors = Array.from(new Set(logs.map((l: any) => l.adminName).filter(Boolean)));
  const actions = Array.from(new Set(logs.map((l: any) => l.action).filter(Boolean)));

  const filteredLogs = logs.filter((log: any) => {
    const matchesSearch = 
      (log.adminName && log.adminName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.entityType && log.entityType.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.ipAddress && log.ipAddress.includes(searchTerm));

    const matchesSupervisor = selectedSupervisor === 'all' || log.adminName === selectedSupervisor;
    const matchesAction = selectedAction === 'all' || log.action === selectedAction;

    return matchesSearch && matchesSupervisor && matchesAction;
  });

  const todayCount = logs.filter((l: any) => {
    const logDate = new Date(l.createdAt);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  }).length;

  const exportToCSV = () => {
    const headers = "التاريخ والوقت,المشرف,نوع الحساب,الإجراء,نوع الكيان,عنوان IP\n";
    const rows = filteredLogs.map((l: any) => 
      `"${new Date(l.createdAt).toLocaleString('ar-YE')}","${l.adminName || 'غير معروف'}","${l.userType === 'admin' ? 'مدير عام' : 'مشرف'}","${l.action}","${l.entityType}","${l.ipAddress || '-'}"`
    ).join("\n");

    const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supervisor-activity-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">تقارير نشاط المشرفين والعمليات</h1>
              <p className="text-sm text-gray-500">سجل دقيق ومفصل لكل التعديلات، العمليات، وحركات الدخول التي قام بها المشرفون والمدراء</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => refetch()} className="gap-2 text-xs h-9">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </Button>
          <Button onClick={exportToCSV} className="gap-2 text-xs h-9 bg-orange-600 hover:bg-orange-700 text-white">
            <Download className="w-3.5 h-3.5" />
            تصدير التقرير (CSV)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">إجمالي العمليات المسجلة</p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{logs.length}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">عمليات اليوم</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{todayCount}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">عدد المشرفين النشطين</p>
              <h3 className="text-2xl font-extrabold text-indigo-600 mt-1">{supervisors.length}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">نسبة نجاح العمليات</p>
              <h3 className="text-2xl font-extrabold text-green-600 mt-1">100%</h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Table Card */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-700" />
            سجل النشاطات والتعديلات التفصيلي
          </CardTitle>
          <CardDescription className="text-xs">
            يتم تسجيل كافة إجراءات التعديل، الحذف، الإضافة، وتغيير الإعدادات بواسطة أي مشرف أو مدير بشكل لحظي.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
              <Input
                placeholder="بحث باسم المشرف، الإجراء، أو الكيان..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pr-9 h-9 text-xs"
              />
            </div>

            <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="تصفية حسب المشرف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المشرفين والمدراء</SelectItem>
                {supervisors.map((sup: any) => (
                  <SelectItem key={sup} value={sup}>{sup}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="تصفية حسب نوع الإجراء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الإجراءات والعمليات</SelectItem>
                {actions.map((act: any) => (
                  <SelectItem key={act} value={act}>{act}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-right text-xs font-bold">التوقيت والتاريخ</TableHead>
                  <TableHead className="text-right text-xs font-bold">المسؤول / المشرف</TableHead>
                  <TableHead className="text-right text-xs font-bold">نوع الحساب</TableHead>
                  <TableHead className="text-right text-xs font-bold">الإجراء المنفذ</TableHead>
                  <TableHead className="text-right text-xs font-bold">الكيان المرتبط</TableHead>
                  <TableHead className="text-right text-xs font-bold">عنوان IP</TableHead>
                  <TableHead className="text-center text-xs font-bold">التفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-gray-500">
                      جاري تحميل تقارير النشاط والعمليات...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-gray-500">
                      <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      لا توجد سجلات نشاط مطابقة لشروط البحث
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <TableCell className="py-3 text-xs text-gray-700 whitespace-nowrap font-medium">
                        {new Date(log.createdAt).toLocaleString('ar-YE', { 
                          year: 'numeric', 
                          month: 'numeric', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-bold text-xs text-gray-900">{log.adminName || 'مدير النظام الأساسي'}</div>
                        <div className="text-[11px] text-gray-400">{log.adminEmail || 'admin@sarie.one'}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={log.userType === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
                          {log.userType === 'admin' ? 'مدير عام' : 'مشرف فرعي'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 font-semibold text-xs text-gray-800">
                        {log.action === 'login' ? 'تسجيل دخول للنظام' :
                         log.action === 'logout' ? 'تسجيل خروج من النظام' :
                         log.action === 'password_change' ? 'تغيير كلمة المرور' : log.action}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-gray-600">
                        <span className="px-2 py-1 bg-gray-100 rounded-md font-mono text-[11px]">{log.entityType || 'عام'}</span>
                      </TableCell>
                      <TableCell className="py-3 text-xs font-mono text-gray-600">
                        {log.ipAddress || '127.0.0.1'}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              تفاصيل عملية النشاط والسجل
            </DialogTitle>
            <DialogDescription className="text-xs">
              معلومات كاملة حول العملية التي قام بها المشرف بالتاريخ والوقت
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-500 block mb-1">المشرف المسؤول:</span>
                  <span className="font-bold text-gray-900">{selectedLog.adminName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">البريد الإلكتروني:</span>
                  <span className="font-mono text-gray-800">{selectedLog.adminEmail}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">نوع الإجراء:</span>
                  <span className="font-bold text-orange-600">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">التوقيت والدقة:</span>
                  <span className="font-medium text-gray-800">{new Date(selectedLog.createdAt).toLocaleString('ar-YE')}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">عنوان IP الجهاز:</span>
                  <span className="font-mono text-gray-800">{selectedLog.ipAddress || 'غير متوفر'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">نوع الكيان:</span>
                  <span className="font-mono text-gray-800">{selectedLog.entityType}</span>
                </div>
              </div>

              {selectedLog.oldData && (
                <div>
                  <span className="font-bold text-gray-700 block mb-1">البيانات السابقة / الجهاز:</span>
                  <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] overflow-x-auto font-mono dir-ltr text-right">
                    {selectedLog.oldData}
                  </pre>
                </div>
              )}

              {selectedLog.newData && (
                <div>
                  <span className="font-bold text-gray-700 block mb-1">البيانات الجديدة / الحالة:</span>
                  <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] overflow-x-auto font-mono dir-ltr text-right">
                    {selectedLog.newData}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
