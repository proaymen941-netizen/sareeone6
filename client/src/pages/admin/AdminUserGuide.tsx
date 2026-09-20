import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Search,
  FileText,
  Printer,
  ChevronLeft,
  ArrowRight,
  HelpCircle,
  Lightbulb,
  ExternalLink,
  CheckCircle2,
  ListFilter,
  LayoutDashboard,
  ShoppingBag,
  Store,
  Package,
  Truck,
  Bike,
  Smartphone,
  Users,
  Settings,
  Sparkles,
  X
} from 'lucide-react';
import { GUIDE_CATEGORIES, GUIDE_TASKS, GuideTask } from '@/data/adminGuideData';
import { generateGuidePDF } from '@/lib/generateGuidePDF';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  orders: ShoppingBag,
  restaurants: Store,
  products: Package,
  drivers: Truck,
  wasalni: Bike,
  otp_whatsapp: Smartphone,
  users_hr: Users,
  settings_backup: Settings
};

export default function AdminUserGuide() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Filter tasks based on category and search query
  const filteredTasks = useMemo(() => {
    return GUIDE_TASKS.filter(task => {
      // Category check
      const matchesCategory = selectedCategory === 'all' || task.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const titleMatch = task.title.toLowerCase().includes(q);
      const descMatch = task.description.toLowerCase().includes(q);
      const locationMatch = task.location.toLowerCase().includes(q);
      const keywordsMatch = task.keywords.some(k => k.toLowerCase().includes(q));
      const stepsMatch = task.steps.some(s => s.toLowerCase().includes(q));

      return titleMatch || descMatch || locationMatch || keywordsMatch || stepsMatch;
    });
  }, [searchQuery, selectedCategory]);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await generateGuidePDF({
        tasks: filteredTasks,
        title: selectedCategory !== 'all' 
          ? `دليل استخدام: ${GUIDE_CATEGORIES.find(c => c.id === selectedCategory)?.title}`
          : 'دليل استخدام النظام الكامل ولائحة العمليات',
        appName: 'سريع ون'
      });
    } catch (err) {
      console.error('Error printing guide:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30">
              <BookOpen className="h-3.5 w-3.5" />
              المستند التوثيقي الرسمي لإدارة النظام
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              دليل استخدام النظام ولائحة المهام التفصيلية
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              مرجع شامل وبحث فوري لكافة الوظائف والعمليات في لوحة التحكم، يساعدك على إدارة المتاجر، الطلبات، السائقين، إعدادات الواتساب OTP، والتقارير المالية بسهولة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              size="lg"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 shadow-lg shadow-blue-600/30"
            >
              <FileText className="h-5 w-5" />
              {isGeneratingPDF ? 'جاري تجهيز PDF...' : 'تحميل الدليل (PDF)'}
            </Button>

            <Button
              onClick={() => window.print()}
              variant="outline"
              size="lg"
              className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white gap-2"
            >
              <Printer className="h-5 w-5" />
              طباعة
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-8 relative max-w-3xl">
          <div className="relative flex items-center">
            <Search className="absolute right-4 h-5 w-5 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن أية عملية أو أداة (مثال: طريقة إضافة سائق، كود الخصم، إعدادات الواتساب، طباعة الفاتورة)..."
              className="w-full pr-12 pl-10 h-14 bg-white/10 backdrop-blur-md border-white/20 text-white placeholder:text-slate-400 rounded-xl text-base focus:bg-white/20 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-4 p-1 text-slate-400 hover:text-white rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Search Tags */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
        <span className="font-bold text-gray-800 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          كلمات بحث سريعة:
        </span>
        {[
          'إضافة سائق',
          'إعدادات الواتساب',
          'رمز OTP',
          'طباعة الفاتورة',
          'إضافة متجر',
          'كود خصم',
          'وصل لي',
          'كشف حساب',
          'محفظة السائق',
          'نسخة احتياطية'
        ].map(tag => (
          <button
            key={tag}
            onClick={() => setSearchQuery(tag)}
            className="bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 transition-colors"
          >
            #{tag}
          </button>
        ))}
      </div>

      {/* Categories Filter Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-blue-600" />
            أقسام ومجالات الإدارة ({GUIDE_CATEGORIES.length})
          </h2>
          {searchQuery && (
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border border-blue-200">
              نتائج البحث: {filteredTasks.length} عملية
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>جميع الأقسام</span>
            <Badge variant="outline" className={`text-xs px-1.5 py-0.2 ${selectedCategory === 'all' ? 'bg-white/20 text-white border-none' : 'bg-gray-100'}`}>
              {GUIDE_TASKS.length}
            </Badge>
          </button>

          {GUIDE_CATEGORIES.map(cat => {
            const Icon = CATEGORY_ICONS[cat.id] || BookOpen;
            const count = GUIDE_TASKS.filter(t => t.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                <span>{cat.title}</span>
                <Badge variant="outline" className={`text-xs px-1.5 py-0.2 ${isSelected ? 'bg-white/20 text-white border-none' : 'bg-gray-100 text-gray-600'}`}>
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tasks Cards List */}
      {filteredTasks.length === 0 ? (
        <Card className="p-12 text-center bg-gray-50/50 border-dashed border-2 border-gray-200">
          <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">لم يتم العثور على أية نتائج لمطابقة بحثك</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            جرب البحث بكلمات أخرى أو اختر قسم آخر من التبويبات العلوية لاستعراض كافة العمليات.
          </p>
          <Button
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            variant="outline"
            className="gap-2"
          >
            إعادة ضبط الفلترة والبحث
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTasks.map((task) => {
            const categoryObj = GUIDE_CATEGORIES.find(c => c.id === task.category);
            const CatIcon = CATEGORY_ICONS[task.category] || BookOpen;

            return (
              <Card key={task.id} className="hover:shadow-lg transition-all duration-200 border-gray-200 flex flex-col h-full bg-white">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-700">
                        <CatIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-gray-900 leading-snug">
                          {task.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-gray-500 font-medium mt-0.5">
                          {categoryObj?.title || 'عام'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 bg-blue-50/80 text-blue-800 text-xs px-2.5 py-1 rounded-lg border border-blue-100 font-semibold flex items-center gap-1.5 w-fit">
                    <span className="text-gray-500">المكان:</span>
                    <span>{task.location}</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Task Description */}
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {task.description}
                  </p>

                  {/* Implementation Steps */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      خطوات التنفيذ المباشرة:
                    </h4>
                    <ol className="space-y-1.5 pr-1">
                      {task.steps.map((step, idx) => (
                        <li key={idx} className="text-xs text-gray-700 flex items-start gap-2 leading-relaxed">
                          <span className="bg-blue-100 text-blue-800 font-bold rounded-md text-[10px] w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tips Box if available */}
                  {task.tips && task.tips.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                        <Lightbulb className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        نصائح وإرشادات هامة:
                      </div>
                      {task.tips.map((tip, idx) => (
                        <p key={idx} className="text-xs text-amber-900 leading-relaxed pr-5">
                          • {tip}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Keywords & Direct Feature Link */}
                  <div className="pt-3 border-t flex items-center justify-between gap-2 mt-auto">
                    <div className="flex flex-wrap gap-1 max-w-[70%]">
                      {task.keywords.slice(0, 3).map((kw, i) => (
                        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          #{kw}
                        </span>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Resolve route path from location
                        const match = task.location.match(/\(([^)]+)\)/);
                        if (match && match[1]) {
                          setLocation(match[1]);
                        } else {
                          setLocation('/admin');
                        }
                      }}
                      className="text-xs text-blue-600 hover:bg-blue-50 gap-1 font-bold h-8"
                    >
                      الانتقال للوظيفة
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
