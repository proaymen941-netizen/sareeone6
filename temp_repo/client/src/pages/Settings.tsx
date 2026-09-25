import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Bell, Globe, Moon, Sun, Lock, CreditCard, Smartphone, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PermissionsManager } from '@/components/PermissionsManager';

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: 'switch' | 'theme' | 'select';
  value: boolean | string;
  onChange: (value: any) => void;
  options?: Array<{ value: string; label: string }>;
}

interface SettingsGroup {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  items: SettingItem[];
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [settings, setSettings] = useState({
    notifications: {
      orderUpdates: true,
      promotions: true,
      sound: true,
    },
    currency: 'YER',
    autoLocation: true,
  });

  const handleNotificationChange = (setting: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [setting]: value,
      },
    }));
    
    toast({
      title: language === 'ar' ? "تم حفظ الإعدادات" : "Settings Saved",
      description: language === 'ar' ? "تم تحديث إعداداتك بنجاح" : "Your settings have been updated successfully",
    });
  };

  const handleSimpleSettingChange = (setting: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value,
    }));
    
    toast({
      title: language === 'ar' ? "تم حفظ الإعدادات" : "Settings Saved",
      description: language === 'ar' ? "تم تحديث إعداداتك بنجاح" : "Your settings have been updated successfully",
    });
  };

  const settingsGroups: SettingsGroup[] = [
    {
      title: language === 'ar' ? 'الإشعارات' : 'Notifications',
      icon: Bell,
      items: [
        {
          key: 'orderUpdates',
          label: language === 'ar' ? 'تحديثات الطلبات' : 'Order Updates',
          description: language === 'ar' ? 'إشعارات حول حالة طلباتك' : 'Notifications about your order status',
          type: 'switch',
          value: settings.notifications.orderUpdates,
          onChange: (value: boolean) => handleNotificationChange('orderUpdates', value),
        },
        {
          key: 'promotions',
          label: language === 'ar' ? 'العروض والتخفيضات' : 'Offers & Promotions',
          description: language === 'ar' ? 'إشعارات حول العروض الجديدة' : 'Notifications about new discounts and offers',
          type: 'switch',
          value: settings.notifications.promotions,
          onChange: (value: boolean) => handleNotificationChange('promotions', value),
        },
        {
          key: 'sound',
          label: language === 'ar' ? 'الأصوات' : 'Sounds',
          description: language === 'ar' ? 'تشغيل أصوات الإشعارات' : 'Play notification audio',
          type: 'switch',
          value: settings.notifications.sound,
          onChange: (value: boolean) => handleNotificationChange('sound', value),
        },
      ],
    },
    {
      title: language === 'ar' ? 'العرض واللغة' : 'Display & Language',
      icon: Globe,
      items: [
        {
          key: 'theme',
          label: language === 'ar' ? 'المظهر' : 'Appearance',
          description: language === 'ar' ? 'اختيار المظهر الفاتح أو الداكن' : 'Choose light or dark appearance',
          type: 'theme',
          value: theme,
          onChange: toggleTheme,
        },
        {
          key: 'language',
          label: language === 'ar' ? 'اللغة' : 'Language',
          description: language === 'ar' ? 'اختيار لغة التطبيق' : 'Select application language',
          type: 'select',
          value: language,
          options: [
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' },
          ],
          onChange: (value: 'ar' | 'en') => {
            setLanguage(value);
            toast({
              title: value === 'ar' ? "تم تغيير اللغة" : "Language Changed",
              description: value === 'ar' ? "تم تحويل التطبيق للغة العربية" : "App has been switched to English",
            });
          },
        },
        {
          key: 'currency',
          label: language === 'ar' ? 'العملة' : 'Currency',
          description: language === 'ar' ? 'وحدة العملة المستخدمة' : 'Currency unit used in app',
          type: 'select',
          value: settings.currency,
          options: [
            { value: 'YER', label: language === 'ar' ? 'الريال اليمني (YER)' : 'Yemeni Rial (YER)' },
          ],
          onChange: (value: string) => handleSimpleSettingChange('currency', value),
        },
      ],
    },
    {
      title: language === 'ar' ? 'الموقع والخصوصية' : 'Location & Privacy',
      icon: Lock,
      items: [
        {
          key: 'autoLocation',
          label: language === 'ar' ? 'تحديد الموقع تلقائياً' : 'Automatic Location',
          description: language === 'ar' ? 'السماح للتطبيق بتحديد موقعك' : 'Allow app to detect your location',
          type: 'switch',
          value: settings.autoLocation,
          onChange: (value: boolean) => handleSimpleSettingChange('autoLocation', value),
        },
      ],
    },
  ];

  const quickActions = [
    {
      icon: CreditCard,
      label: language === 'ar' ? 'طرق الدفع' : 'Payment Methods',
      description: language === 'ar' ? 'إدارة طرق الدفع المحفوظة' : 'Manage saved payment methods',
      action: () => setLocation('/payment-methods'),
      testId: 'settings-payment-methods',
    },
    {
      icon: Smartphone,
      label: language === 'ar' ? 'حول التطبيق' : 'About App',
      description: language === 'ar' ? 'معلومات النسخة والتحديثات' : 'Version info & updates',
      action: () => setLocation('/about'),
      testId: 'settings-about',
    },
  ];

  return (
    <div>
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/profile')}
            data-testid="button-settings-back"
          >
            <ArrowRight className={`h-5 w-5 ${language === 'en' ? 'rotate-180' : ''}`} />
          </Button>
          <h2 className="text-xl font-bold text-foreground">{t('settings')}</h2>
        </div>
      </header>

      <section className="p-4">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              {language === 'ar' ? 'إعدادات عامة' : 'General Settings'}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-6 mt-6">
            {/* Settings Groups */}
            {settingsGroups.map((group) => {
          const Icon = group.icon;
          return (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Icon className="h-6 w-6 text-primary" />
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2">
                    <div className="flex-1">
                      <Label 
                        htmlFor={item.key} 
                        className="text-foreground font-medium cursor-pointer"
                        data-testid={`setting-label-${item.key}`}
                      >
                        {item.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    </div>
                    
                    <div className="ml-4">
                      {item.type === 'switch' && (
                        <Switch
                          id={item.key}
                          checked={item.value as boolean}
                          onCheckedChange={item.onChange}
                          data-testid={`switch-${item.key}`}
                        />
                      )}
                      
                      {item.type === 'theme' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={item.onChange}
                          data-testid="button-toggle-theme"
                        >
                          {theme === 'dark' ? (
                            <Sun className="h-4 w-4 ml-2" />
                          ) : (
                            <Moon className="h-4 w-4 ml-2" />
                          )}
                          {theme === 'dark' ? (language === 'ar' ? 'فاتح' : 'Light') : (language === 'ar' ? 'داكن' : 'Dark')}
                        </Button>
                      )}
                      
                      {item.type === 'select' && item.options && (
                        <Select 
                          value={item.value as string} 
                          onValueChange={item.onChange}
                        >
                          <SelectTrigger className="w-40" data-testid={`select-${item.key}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {item.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{language === 'ar' ? 'إعدادات إضافية' : 'Additional Settings'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.testId}
                      variant="ghost"
                      className="w-full h-auto p-4 justify-between hover:bg-accent"
                      onClick={action.action}
                      data-testid={action.testId}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-6 w-6 text-primary" />
                        <div className={language === 'ar' ? 'text-right' : 'text-left'}>
                          <div className="font-medium text-foreground">{action.label}</div>
                          <div className="text-sm text-muted-foreground">{action.description}</div>
                        </div>
                      </div>
                      <ArrowRight className={`h-5 w-5 text-muted-foreground ${language === 'ar' ? 'rotate-180' : ''}`} />
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Sign Out */}
            <Button
              variant="destructive"
              className="w-full font-bold h-12 rounded-xl text-base gap-2 mt-4"
              data-testid="button-sign-out"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="w-5 h-5" />
              {t('logout')}
            </Button>
          </TabsContent>
          
          <TabsContent value="permissions" className="mt-6">
            <PermissionsManager onPermissionUpdate={(permission, granted) => {
              console.log(`Permission ${permission} ${granted ? 'granted' : 'denied'}`);
              toast({
                title: granted ? (language === 'ar' ? 'تم منح الإذن' : 'Permission Granted') : (language === 'ar' ? 'تم رفض الإذن' : 'Permission Denied'),
                description: `${permission}: ${granted ? (language === 'ar' ? 'مُمنوح' : 'Granted') : (language === 'ar' ? 'مرفوض' : 'Denied')}`,
                variant: granted ? 'default' : 'destructive',
              });
            }} />
          </TabsContent>
        </Tabs>
      </section>

      {/* نافذة تأكيد الخروج المنبثقة */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className={`${language === 'ar' ? 'text-right' : 'text-left'} text-lg font-black text-red-600 flex items-center gap-2`}>
              <LogOut className="w-5 h-5" />
              {t('logout_confirm_title')}
            </AlertDialogTitle>
            <AlertDialogDescription className={`${language === 'ar' ? 'text-right' : 'text-left'} text-sm font-semibold text-gray-700 py-3 leading-relaxed`}>
              {t('logout_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center gap-2 justify-end">
            <AlertDialogCancel className="font-bold rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLogoutConfirm(false);
                logout();
                toast({
                  title: t('logout'),
                  description: language === 'ar' ? "تم تسجيل الخروج وتفريغ البيانات المتعلقة بالحساب بنجاح" : "Successfully logged out",
                });
                setLocation('/auth');
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
            >
              {t('logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}