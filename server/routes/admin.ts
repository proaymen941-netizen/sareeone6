// @ts-nocheck
import express from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { broadcastSettingsChanged, broadcastEvent } from "../broadcast";
import { z } from "zod";
import { eq, and, desc, sql, or, like, asc, inArray } from "drizzle-orm";
import {
  insertRestaurantSchema,
  insertCategorySchema,
  insertSpecialOfferSchema,
  insertAdminUserSchema,
  insertDriverSchema,
  insertMenuItemSchema,
  insertEmployeeSchema,
  insertAttendanceSchema,
  insertLeaveRequestSchema,
  insertDriverBalanceSchema,
  insertDriverTransactionSchema,
  insertDriverCommissionSchema,
  insertDriverWithdrawalSchema,
  adminUsers,
  // تم حذف adminSessions
  categories,
  restaurantSections,
  restaurants,
  menuItems,
  users,
  customers,
  userAddresses,
  orders,
  specialOffers,
  notifications,
  ratings,
  systemSettings,
  drivers,
  orderTracking,
  cart,
  favorites,
  employees,
  attendance,
  leaveRequests,
  driverBalances,
  driverTransactions,
  driverCommissions,
  driverWithdrawals,
  auditLogs,
  wasalniRequests
} from "@shared/schema";
import { DatabaseStorage } from "../db";
import { coerceRequestData } from "../utils/coercion";

const router = express.Router();
const dbStorage = storage as any;
const db = (storage as any).db;

// Schema object for direct database operations
const schema = {
  adminUsers,
  // تم حذف adminSessions من schema object
  categories,
  restaurantSections,
  restaurants,
  menuItems,
  users,
  customers,
  userAddresses,
  orders,
  specialOffers,
  notifications,
  ratings,
  systemSettings,
  drivers,
  orderTracking,
  cart,
  favorites,
  employees,
  attendance,
  leaveRequests,
  driverBalances,
  driverTransactions,
  driverCommissions,
  driverWithdrawals
};

// Middleware للمصادقة - يُضيف req.admin إذا كان التوكن صحيحاً
router.use(async (req: any, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const adminUser = await dbStorage.getAdminById(token);
      if (adminUser && adminUser.isActive) {
        req.admin = adminUser;
        // تحليل الصلاحيات للمدير الفرعي
        if (adminUser.userType === 'sub_admin') {
          try {
            req.adminPermissions = adminUser.permissions ? JSON.parse(adminUser.permissions) : [];
          } catch {
            req.adminPermissions = [];
          }
        } else {
          req.adminPermissions = null; // null = all permissions (main admin)
        }
      }
    }
  } catch (e) {
    // ignore auth errors - proceed without admin context
  }
  next();
});

// دالة للتحقق من صلاحيات المدير الفرعي
function requirePermission(permission: string) {
  return (req: any, res: any, next: any) => {
    // إذا لم يكن هناك مدير مسجل دخوله، تجاوز (لا توجد مصادقة إلزامية)
    if (!req.admin) return next();
    // المدير الرئيسي له جميع الصلاحيات
    if (req.admin.userType === 'admin') return next();
    // المدير الفرعي: التحقق من الصلاحية
    const perms: string[] = req.adminPermissions || [];
    if (!perms.includes(permission)) {
      return res.status(403).json({ error: "ليس لديك صلاحية للوصول إلى هذه الوظيفة" });
    }
    next();
  };
}

// لوحة المعلومات
router.get("/dashboard", async (req, res) => {
  try {
    // جلب البيانات من قاعدة البيانات
    const [restaurants, orders, drivers, users] = await Promise.all([
      storage.getRestaurants(),
      storage.getOrders(),
      storage.getDrivers(),
      storage.getUsers ? storage.getUsers() : []
    ]);

    const today = new Date().toDateString();
    
    // حساب الإحصائيات باستخدام عمليات المصفوفات
    const totalRestaurants = restaurants.length;
    const totalOrders = orders.length;
    const totalDrivers = drivers.length;
    const totalCustomers = users.length; // أو 0 إذا لم تكن متوفرة
    
    const todayOrders = orders.filter(order => 
      order.createdAt.toDateString() === today
    ).length;
    
    const pendingOrders = orders.filter(order => 
      order.status === "pending"
    ).length;
    
    const activeDrivers = drivers.filter(driver => 
      driver.isActive === true
    ).length;

    // حساب الإيرادات
    const deliveredOrders = orders.filter(order => order.status === "delivered");
    const totalRevenue = deliveredOrders.reduce((sum, order) => 
      sum + parseFloat(order.totalAmount || order.total || "0"), 0
    );
    
    const todayDeliveredOrders = deliveredOrders.filter(order => 
      order.createdAt.toDateString() === today
    );
    const todayRevenue = todayDeliveredOrders.reduce((sum, order) => 
      sum + parseFloat(order.totalAmount || order.total || "0"), 0
    );

    // الطلبات الأخيرة (أحدث 10 طلبات)
    const recentOrders = orders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    res.json({
      stats: {
        totalRestaurants,
        totalOrders,
        totalDrivers,
        totalCustomers,
        todayOrders,
        pendingOrders,
        activeDrivers,
        totalRevenue,
        todayRevenue
      },
      recentOrders
    });
  } catch (error) {
    console.error("خطأ في لوحة المعلومات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إدارة التصنيفات
router.get("/categories", async (req, res) => {
  try {
    const categories = await storage.getCategories();
    // ترتيب التصنيفات حسب sortOrder ثم الاسم
    const sortedCategories = categories.sort((a, b) => {
      const aOrder = a.sortOrder ?? 0;
      const bOrder = b.sortOrder ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    });
    res.json(sortedCategories);
  } catch (error) {
    console.error("خطأ في جلب التصنيفات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // التحقق من صحة البيانات مع الحقول المطلوبة
    const validatedData = insertCategorySchema.parse({
      ...coercedData,
      // التأكد من وجود الحقول المطلوبة
      sortOrder: coercedData.sortOrder || 0,
      isActive: coercedData.isActive !== undefined ? coercedData.isActive : true
    });
    
    const newCategory = await storage.createCategory(validatedData);
    broadcastEvent('category_update', { action: 'create', category: newCategory });
    broadcastSettingsChanged('restaurants');
    res.status(201).json(newCategory);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "بيانات التصنيف غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في إضافة التصنيف:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // التحقق من صحة البيانات المحدثة (جزئي)
    const validatedData = insertCategorySchema.partial().parse(coercedData);
    
    const updatedCategory = await storage.updateCategory(id, {
      ...validatedData, 
      updatedAt: new Date()
    });
    
    if (!updatedCategory) {
      return res.status(404).json({ error: "التصنيف غير موجود" });
    }
    
    broadcastEvent('category_update', { action: 'update', category: updatedCategory });
    broadcastSettingsChanged('restaurants');
    res.json(updatedCategory);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "بيانات تحديث التصنيف غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في تحديث التصنيف:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await storage.deleteCategory(id);
    
    if (!success) {
      return res.status(404).json({ error: "التصنيف غير موجود" });
    }
    
    broadcastEvent('category_update', { action: 'delete', id });
    broadcastSettingsChanged('restaurants');
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف التصنيف:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إدارة المطاعم
router.get("/restaurants", async (req, res) => {
  try {
    const { page = 1, limit = 10, search, categoryId } = req.query;
    
    // جلب المطاعم باستخدام المرشحات
    const filters: any = {};
    if (categoryId) {
      filters.categoryId = categoryId as string;
    }
    if (search) {
      filters.search = search as string;
    }
    
    const allRestaurants = await storage.getRestaurants(filters);
    
    // ترتيب المطاعم حسب تاريخ الإنشاء (الأحدث أولاً)
    const sortedRestaurants = allRestaurants.sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
    
    // تطبيق التصفح (pagination)
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedRestaurants = sortedRestaurants.slice(startIndex, endIndex);

    res.json({
      restaurants: paginatedRestaurants,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: sortedRestaurants.length,
        pages: Math.ceil(sortedRestaurants.length / Number(limit))
      }
    });
  } catch (error) {
    console.error("خطأ في جلب المطاعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/restaurants", async (req, res) => {
  try {
    console.log("Restaurant creation request data:", req.body);
    
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // تقديم قيم افتراضية للحقول المطلوبة
    const restaurantData = {
      // الحقول المطلوبة
      name: coercedData.name || "مطعم جديد",
      description: coercedData.description || "وصف المطعم",
      image: coercedData.image || "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg",
      deliveryTime: coercedData.deliveryTime || "30-45 دقيقة",
      
      // الحقول الاختيارية مع قيم افتراضية
      rating: coercedData.rating || "0.0",
      reviewCount: coercedData.reviewCount || 0,
      minimumOrder: coercedData.minimumOrder || "0",
      deliveryFee: coercedData.deliveryFee || "0",
      perKmFee: coercedData.perKmFee || "0",
      commissionRate: coercedData.commissionRate || "10",
      categoryId: coercedData.categoryId,
      
      // أوقات العمل
      openingTime: coercedData.openingTime || "08:00",
      closingTime: coercedData.closingTime || "23:00",
      workingDays: coercedData.workingDays || "0,1,2,3,4,5,6",
      
      // حالات المطعم (الآن مع تحويل صحيح للبوليان)
      isOpen: coercedData.isOpen !== undefined ? coercedData.isOpen : true,
      isActive: coercedData.isActive !== undefined ? coercedData.isActive : true,
      isFeatured: coercedData.isFeatured !== undefined ? coercedData.isFeatured : false,
      isNew: coercedData.isNew !== undefined ? coercedData.isNew : false,
      isTemporarilyClosed: coercedData.isTemporarilyClosed !== undefined ? coercedData.isTemporarilyClosed : false,
      temporaryCloseReason: coercedData.temporaryCloseReason,
      
      // الموقع (الآن مع تحويل صحيح للأرقام العشرية)
      latitude: coercedData.latitude,
      longitude: coercedData.longitude,
      address: coercedData.address,
      
      // حقول التوقيت (سيتم إضافتها تلقائياً بواسطة قاعدة البيانات)
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log("Processed restaurant data:", restaurantData);
    
    const validatedData = insertRestaurantSchema.parse(restaurantData);
    
    const newRestaurant = await storage.createRestaurant(validatedData);
    broadcastSettingsChanged('restaurants');
    res.status(201).json(newRestaurant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Restaurant validation errors:", error.errors);
      return res.status(400).json({ 
        error: "بيانات المطعم غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في إضافة المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const coercedData = coerceRequestData(req.body);

    const updateFields: any = {};
    if (coercedData.name !== undefined) updateFields.name = String(coercedData.name);
    if (coercedData.description !== undefined) updateFields.description = coercedData.description ? String(coercedData.description) : null;
    if (coercedData.image !== undefined) updateFields.image = String(coercedData.image);
    if (coercedData.phone !== undefined) updateFields.phone = coercedData.phone ? String(coercedData.phone) : null;
    if (coercedData.deliveryTime !== undefined) updateFields.deliveryTime = String(coercedData.deliveryTime);
    if (coercedData.isOpen !== undefined) updateFields.isOpen = Boolean(coercedData.isOpen);
    if (coercedData.isActive !== undefined) updateFields.isActive = Boolean(coercedData.isActive);
    if (coercedData.isFeatured !== undefined) updateFields.isFeatured = Boolean(coercedData.isFeatured);
    if (coercedData.isNew !== undefined) updateFields.isNew = Boolean(coercedData.isNew);
    if (coercedData.isTemporarilyClosed !== undefined) updateFields.isTemporarilyClosed = Boolean(coercedData.isTemporarilyClosed);
    if (coercedData.temporaryCloseReason !== undefined) updateFields.temporaryCloseReason = coercedData.temporaryCloseReason ? String(coercedData.temporaryCloseReason) : null;
    if (coercedData.openingTime !== undefined) updateFields.openingTime = coercedData.openingTime ? String(coercedData.openingTime) : null;
    if (coercedData.closingTime !== undefined) updateFields.closingTime = coercedData.closingTime ? String(coercedData.closingTime) : null;
    if (coercedData.workingDays !== undefined) updateFields.workingDays = coercedData.workingDays ? String(coercedData.workingDays) : null;
    if (coercedData.address !== undefined) updateFields.address = coercedData.address ? String(coercedData.address) : null;

    if (coercedData.categoryId !== undefined) {
      const catId = coercedData.categoryId;
      updateFields.categoryId = (catId === '' || catId === 'null' || catId === 'undefined' || catId === null) ? null : String(catId);
    }

    if (coercedData.latitude !== undefined) {
      const lat = coercedData.latitude;
      updateFields.latitude = (lat === '' || lat === 'null' || lat === null) ? null : String(lat);
    }

    if (coercedData.longitude !== undefined) {
      const lng = coercedData.longitude;
      updateFields.longitude = (lng === '' || lng === 'null' || lng === null) ? null : String(lng);
    }

    if (coercedData.deliveryFee !== undefined) {
      updateFields.deliveryFee = String(coercedData.deliveryFee);
    }

    if (coercedData.perKmFee !== undefined) {
      updateFields.perKmFee = String(coercedData.perKmFee);
    }

    if (coercedData.minimumOrder !== undefined) {
      updateFields.minimumOrder = String(coercedData.minimumOrder);
    }

    if (coercedData.rating !== undefined) {
      updateFields.rating = String(coercedData.rating);
    }

    if (coercedData.reviewCount !== undefined) {
      updateFields.reviewCount = parseInt(coercedData.reviewCount) || 0;
    }

    let updatedRestaurant;
    try {
      const validatedData = insertRestaurantSchema.partial().parse(coercedData);
      updatedRestaurant = await storage.updateRestaurant(id, {
        ...validatedData,
        ...updateFields,
        updatedAt: new Date()
      });
    } catch (zodErr) {
      console.warn("⚠️ Zod parse fallback for updateRestaurant:", zodErr);
      updatedRestaurant = await storage.updateRestaurant(id, {
        ...updateFields,
        updatedAt: new Date()
      });
    }
    
    if (!updatedRestaurant) {
      return res.status(404).json({ error: "المطعم غير موجود" });
    }
    
    broadcastSettingsChanged('restaurants');
    res.json(updatedRestaurant);
  } catch (error) {
    console.error("خطأ في تحديث المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم عند تحديث بيانات المطعم" });
  }
});

router.delete("/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await storage.deleteRestaurant(id);
    
    if (!success) {
      return res.status(404).json({ error: "المطعم غير موجود" });
    }
    
    broadcastEvent('restaurant_update', { action: 'delete', id });
    broadcastSettingsChanged('restaurants');
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إدارة عناصر القائمة
router.get("/menu-items", async (req, res) => {
  try {
    const items = await storage.getAllMenuItems();
    res.json(items);
  } catch (error) {
    console.error("خطأ في جلب المنتجات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ── Restaurant Sections CRUD ───────────────────────────────────────────────
router.get("/restaurants/:restaurantId/sections", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const sections = await storage.getRestaurantSections(restaurantId);
    res.json(sections);
  } catch (error) {
    console.error("خطأ في جلب أقسام المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/restaurant-sections", async (req, res) => {
  try {
    const section = await storage.createRestaurantSection(req.body);
    broadcastEvent('section_update', { action: 'create', section });
    broadcastEvent('menu_update', { restaurantId: section.restaurantId });
    broadcastSettingsChanged('restaurants');
    res.status(201).json(section);
  } catch (error) {
    console.error("خطأ في إضافة قسم المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/restaurant-sections/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const section = await storage.updateRestaurantSection(id, req.body);
    if (!section) return res.status(404).json({ error: "القسم غير موجود" });
    broadcastEvent('section_update', { action: 'update', section });
    broadcastEvent('menu_update', { restaurantId: section.restaurantId });
    broadcastSettingsChanged('restaurants');
    res.json(section);
  } catch (error) {
    console.error("خطأ في تحديث قسم المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/restaurant-sections/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteRestaurantSection(id);
    if (!success) return res.status(404).json({ error: "القسم غير موجود" });
    broadcastEvent('section_update', { action: 'delete', id });
    broadcastEvent('menu_update', {});
    broadcastSettingsChanged('restaurants');
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف قسم المطعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/restaurants/:restaurantId/menu", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const menuItems = await storage.getMenuItems(restaurantId);
    
    // ترتيب العناصر حسب الاسم
    const sortedItems = menuItems.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(sortedItems);
  } catch (error) {
    console.error("خطأ في جلب عناصر القائمة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/menu-items", async (req, res) => {
  try {
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // التحقق من صحة البيانات
    const validatedData = insertMenuItemSchema.parse({
      ...coercedData,
      // إضافة صورة افتراضية إذا لم تكن موجودة
      image: coercedData.image || "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg"
    });
    
    const newMenuItem = await storage.createMenuItem(validatedData);
    broadcastEvent('menu_update', { action: 'create', menuItem: newMenuItem, restaurantId: newMenuItem.restaurantId });
    res.status(201).json(newMenuItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "بيانات عنصر القائمة غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في إضافة عنصر القائمة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/menu-items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // التحقق من صحة البيانات المحدثة (جزئي)
    const validatedData = insertMenuItemSchema.partial().parse(coercedData);
    
    const updatedMenuItem = await storage.updateMenuItem(id, validatedData);
    
    if (!updatedMenuItem) {
      return res.status(404).json({ error: "عنصر القائمة غير موجود" });
    }
    
    broadcastEvent('menu_update', { action: 'update', menuItem: updatedMenuItem, restaurantId: updatedMenuItem.restaurantId });
    res.json(updatedMenuItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "بيانات تحديث عنصر القائمة غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في تحديث عنصر القائمة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/menu-items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await storage.deleteMenuItem(id);
    
    if (!success) {
      return res.status(404).json({ error: "عنصر القائمة غير موجود" });
    }
    
    broadcastEvent('menu_update', { action: 'delete', id });
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف عنصر القائمة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إدارة الطلبات
router.get("/orders", async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    let allOrders = await storage.getOrders();
    
    // تطبيق مرشحات البحث
    if (status && status !== 'all') {
      allOrders = allOrders.filter(order => order.status === status);
    }
    
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      allOrders = allOrders.filter(order => 
        order.orderNumber?.toLowerCase().includes(searchTerm) ||
        order.customerName?.toLowerCase().includes(searchTerm) ||
        order.customerPhone?.toLowerCase().includes(searchTerm)
      );
    }

    // ترتيب حسب تاريخ الإنشاء (الأحدث أولاً)
    const sortedOrders = allOrders.sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
    
    // تطبيق التصفح (pagination)
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

    res.json({
      orders: paginatedOrders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: sortedOrders.length,
        pages: Math.ceil(sortedOrders.length / Number(limit))
      }
    });
  } catch (error) {
    console.error("خطأ في جلب الطلبات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/orders/:id/status", async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, driverId } = req.body;
    
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (driverId) {
      updateData.driverId = driverId;
    }
    
    const updatedOrder = await storage.updateOrder(id, updateData);
    
    if (!updatedOrder) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }
    
    // بث التحديث عبر WebSocket - مستهدف فقط لأطراف الطلب
    const ws = req.app.get('ws');
    if (ws) {
      const payload = { 
        orderId: id, 
        status,
        orderNumber: updatedOrder.orderNumber,
        driverId: updatedOrder.driverId,
        type: 'regular'
      };
      if (typeof ws.notifyOrder === 'function') {
        ws.notifyOrder('order_update', payload, {
          customerId: updatedOrder.customerId,
          customerPhone: updatedOrder.customerPhone,
          driverId: updatedOrder.driverId,
          orderId: id,
        });
      }

      // إشعار السائق عند التعيين بطلب جديد
      if (driverId && updatedOrder.driverId) {
        ws.sendToDriver(updatedOrder.driverId, 'new_order_assigned', { orderId: id, orderNumber: updatedOrder.orderNumber });
      }
    }

    // إنشاء رسالة الحالة للتتبع والإشعارات
    let statusMessage = '';
    switch (status) {
      case 'confirmed': statusMessage = 'تم تأكيد الطلب'; break;
      case 'preparing': statusMessage = 'جاري تحضير الطلب'; break;
      case 'ready': statusMessage = 'الطلب جاهز للاستلام'; break;
      case 'picked_up': statusMessage = 'تم استلام الطلب من المطعم'; break;
      case 'on_way': statusMessage = 'السائق في الطريق إليك'; break;
      case 'delivered': statusMessage = 'تم تسليم الطلب بنجاح'; break;
      case 'cancelled': statusMessage = 'تم إلغاء الطلب من قبل الإدارة'; break;
      default: statusMessage = `تم تحديث حالة الطلب إلى ${status}`;
    }

    try {
      // إنشاء قيد تتبع
      await storage.createOrderTracking({
        orderId: id,
        status,
        message: statusMessage,
        createdBy: req.admin?.id || 'admin',
        createdByType: 'admin'
      });

      // إشعار للعميل
      await storage.createNotification({
        type: 'order_status_update',
        title: 'تحديث حالة الطلب',
        message: `طلبك رقم ${updatedOrder.orderNumber}: ${statusMessage}`,
        recipientType: 'customer',
        recipientId: updatedOrder.customerId || updatedOrder.customerPhone,
        orderId: id,
        isRead: false
      });
    } catch (err) {
      console.error("Error creating tracking/notification in admin update:", err);
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error("خطأ في تحديث حالة الطلب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب إحصائيات تقارير المطاعم
router.get("/reports/restaurants", async (req, res) => {
  try {
    const { startDate, endDate, categoryId } = req.query;
    
    const allRestaurants = await storage.getRestaurants({ categoryId: categoryId as string });
    const allOrders = await storage.getOrders();
    
    const reports = allRestaurants.map(restaurant => {
      const restaurantOrders = allOrders.filter(order => 
        order.restaurantId === restaurant.id &&
        (order.status === 'delivered') &&
        (!startDate || new Date(order.createdAt) >= new Date(startDate as string)) &&
        (!endDate || new Date(order.createdAt) <= new Date(endDate as string))
      );
      
      const totalSales = restaurantOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount || order.total || "0"), 0);
      const totalOrders = restaurantOrders.length;
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      const commissionRate = 0.15; // 15% عمولة افتراضية
      const totalCommission = totalSales * commissionRate;
      const amountDue = totalSales - totalCommission;
      
      return {
        id: restaurant.id,
        name: restaurant.name,
        category: restaurant.categoryId,
        totalOrders,
        totalSales,
        avgOrderValue,
        commissionRate: commissionRate * 100,
        amountDue
      };
    });
    
    res.json(reports);
  } catch (error) {
    console.error("Error in restaurant reports:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// تقارير الطلبات
router.get("/reports/orders", async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = to ? new Date(to as string) : new Date();

    const orders = await storage.getOrders();
    const filteredOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= fromDate && orderDate <= toDate;
    });

    const statusCounts = filteredOrders.reduce((acc: any, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    const totalRevenue = filteredOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + parseFloat(o.totalAmount || "0"), 0);

    res.json({
      total: filteredOrders.length,
      revenue: totalRevenue,
      statusBreakdown: statusCounts,
      orders: filteredOrders.slice(0, 100) // أحدث 100 طلب
    });
  } catch (error) {
    console.error("خطأ في تقارير الطلبات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تقارير المنتجات
router.get("/reports/products", async (req, res) => {
  try {
    const orders = await storage.getOrders();
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    
    const productSales: any = {};
    
    deliveredOrders.forEach(order => {
      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const id = item.id || item.menuItemId;
            if (!id) return;
            if (!productSales[id]) {
              productSales[id] = {
                id,
                name: item.name || 'منتج غير معروف',
                quantity: 0,
                revenue: 0
              };
            }
            productSales[id].quantity += item.quantity || 1;
            productSales[id].revenue += (item.price || 0) * (item.quantity || 1);
          });
        }
      } catch (e) {
        console.error("Error parsing order items for report:", e);
      }
    });

    const sortedProducts = Object.values(productSales)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 50);

    res.json(sortedProducts);
  } catch (error) {
    console.error("خطأ في تقارير المنتجات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تقارير المستخدمين
router.get("/reports/users", async (req, res) => {
  try {
    const [users, orders] = await Promise.all([
      storage.getUsers(),
      storage.getOrders()
    ]);

    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    
    const userStats = users.map(user => {
      const userOrders = deliveredOrders.filter(o => o.customerId === user.id);
      const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || "0"), 0);
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        orderCount: userOrders.length,
        totalSpent,
        createdAt: user.createdAt
      };
    });

    const topUsers = [...userStats].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 50);
    const newUsersCount = users.filter(u => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(u.createdAt) >= thirtyDaysAgo;
    }).length;

    res.json({
      totalUsers: users.length,
      newUsersLast30Days: newUsersCount,
      topUsers
    });
  } catch (error) {
    console.error("خطأ في تقارير المستخدمين:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ملخص السائقين للتقارير المتقدمة
router.get("/drivers-summary", async (req, res) => {
  try {
    const driversList = await storage.getDrivers();
    const allOrders = await storage.getOrders();

    const summary = await Promise.all(
      driversList.map(async (driver) => {
        const driverOrders = allOrders.filter(o => o.driverId === driver.id && o.status === 'delivered');
        const totalEarnings = driverOrders.reduce((sum, o) => sum + parseFloat(o.deliveryFee || "0"), 0);
        const balance = await storage.getDriverBalance(driver.id).catch(() => null);
        return {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          isAvailable: driver.isAvailable,
          stats: {
            totalOrders: driverOrders.length,
            totalEarnings: balance ? parseFloat(balance.totalBalance || "0") : totalEarnings,
            averageRating: parseFloat(driver.rating || "0"),
            availableBalance: balance ? parseFloat(balance.availableBalance || "0") : 0
          }
        };
      })
    );

    res.json(summary);
  } catch (error) {
    console.error("خطأ في ملخص السائقين:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ملخص المطاعم للتقارير المتقدمة
router.get("/restaurants-summary", async (req, res) => {
  try {
    const allRestaurants = await storage.getRestaurants({});
    const allOrders = await storage.getOrders();

    const summary = allRestaurants.map(restaurant => {
      const restaurantOrders = allOrders.filter(o => o.restaurantId === restaurant.id && o.status === 'delivered');
      const totalRevenue = restaurantOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || o.total || "0"), 0);
      const commissionRate = 0.15;
      const totalCommission = totalRevenue * commissionRate;

      return {
        id: restaurant.id,
        name: restaurant.name,
        phone: restaurant.phone,
        isOpen: restaurant.isOpen,
        stats: {
          totalOrders: restaurantOrders.length,
          totalRevenue,
          totalCommission,
          netEarnings: totalRevenue - totalCommission,
          avgOrderValue: restaurantOrders.length > 0 ? totalRevenue / restaurantOrders.length : 0
        }
      };
    });

    res.json(summary);
  } catch (error) {
    console.error("خطأ في ملخص المطاعم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/reports/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await storage.getRestaurant(id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
    
    const allOrders = await storage.getOrders();
    const restaurantOrders = allOrders.filter(order => order.restaurantId === id);
    const deliveredOrders = restaurantOrders.filter(order => order.status === 'delivered');
    
    const totalSales = deliveredOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount || order.total || "0"), 0);
    const commissionRate = 0.15;
    const totalCommission = totalSales * commissionRate;
    
    // تحليل المبيعات (يومي، أسبوعي، شهري)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const salesToday = deliveredOrders.filter(o => new Date(o.createdAt) >= todayStart).reduce((s, o) => s + parseFloat(o.totalAmount || o.total || "0"), 0);
    const salesWeek = deliveredOrders.filter(o => new Date(o.createdAt) >= weekStart).reduce((s, o) => s + parseFloat(o.totalAmount || o.total || "0"), 0);
    const salesMonth = deliveredOrders.filter(o => new Date(o.createdAt) >= monthStart).reduce((s, o) => s + parseFloat(o.totalAmount || o.total || "0"), 0);
    
    const cancelledCount = restaurantOrders.filter(o => o.status === 'cancelled').length;
    const cancellationRate = restaurantOrders.length > 0 ? (cancelledCount / restaurantOrders.length) * 100 : 0;
    
    res.json({
      restaurant,
      financials: {
        totalSales,
        totalCommission,
        netAmount: totalSales - totalCommission,
        salesToday,
        salesWeek,
        salesMonth,
        deliveryFees: deliveredOrders.reduce((s, o) => s + parseFloat(o.deliveryFee || "0"), 0),
      },
      analytics: {
        totalOrders: restaurantOrders.length,
        deliveredOrders: deliveredOrders.length,
        cancellationRate,
        avgDeliveryTime: restaurant.deliveryTime
      },
      transactions: deliveredOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt,
        total: parseFloat(o.totalAmount || o.total || "0"),
        commission: parseFloat(o.totalAmount || o.total || "0") * commissionRate,
        net: parseFloat(o.totalAmount || o.total || "0") * (1 - commissionRate),
        status: 'paid'
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}); // <-- قوس الإغلاق الصحيح

// إدارة الموظفين والموارد البشرية
router.get("/employees", async (req, res) => {
  try {
    const employees = await storage.getEmployees();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/employees", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertEmployeeSchema.parse(coercedData);
    const newEmployee = await storage.createEmployee(validatedData);
    res.status(201).json(newEmployee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error creating employee:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/employees/:id", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertEmployeeSchema.partial().parse(coercedData);
    const updated = await storage.updateEmployee(req.params.id, validatedData);
    if (!updated) return res.status(404).json({ error: "Employee not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error updating employee:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/employees/:id", async (req, res) => {
  try {
    const success = await storage.deleteEmployee(req.params.id);
    if (!success) return res.status(404).json({ error: "Employee not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// إدارة الحضور
router.get("/attendance", async (req, res) => {
  try {
    const { employeeId, date } = req.query;
    const attendance = await storage.getAttendance(
      employeeId as string,
      date ? new Date(date as string) : undefined
    );
    res.json(attendance);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attendance", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertAttendanceSchema.parse(coercedData);
    const newAttendance = await storage.createAttendance(validatedData);
    res.status(201).json(newAttendance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error creating attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// طلبات الإجازة
router.get("/leave-requests", async (req, res) => {
  try {
    const { employeeId } = req.query;
    const requests = await storage.getLeaveRequests(employeeId as string);
    res.json(requests);
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/leave-requests", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertLeaveRequestSchema.parse(coercedData);
    const newRequest = await storage.createLeaveRequest(validatedData);
    res.status(201).json(newRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error creating leave request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/leave-requests/:id", async (req, res) => {
  try {
    const coercedData = coerceRequestData(req.body);
    const validatedData = insertLeaveRequestSchema.partial().parse(coercedData);
    const updated = await storage.updateLeaveRequest(req.params.id, validatedData);
    if (!updated) return res.status(404).json({ error: "Leave request not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error updating leave request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/drivers", async (req, res) => {
  try {
    const drivers = await storage.getDrivers();
    res.json(drivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: "فشل في جلب بيانات السائقين" });
  }
});

router.get("/drivers/:id/stats", async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await storage.getDriver(id);
    if (!driver) return res.status(404).json({ error: "السائق غير موجود" });
    const orders = await storage.getOrders();
    const driverOrders = orders.filter((o: any) => o.driverId === id);
    const completedOrders = driverOrders.filter((o: any) => o.status === 'delivered');
    const totalEarnings = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.deliveryFee || '0'), 0);
    res.json({
      totalOrders: driverOrders.length,
      completedOrders: completedOrders.length,
      totalEarnings: totalEarnings.toFixed(2),
      rating: driver.rating || 0,
    });
  } catch (error) {
    console.error("Error fetching driver stats:", error);
    res.status(500).json({ error: "فشل في جلب إحصائيات السائق" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const orders = await storage.getOrders();
    const drivers = await storage.getDrivers();
    const categories = await storage.getCategories();
    const restaurants = await storage.getRestaurants();
    const users = await storage.getUsers();
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayOrders = orders.filter((o: any) => new Date(o.createdAt) >= today);
    const totalRevenue = orders.filter((o: any) => o.status === 'delivered')
      .reduce((sum: number, o: any) => sum + parseFloat(o.totalAmount || '0'), 0);
    res.json({
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      totalDrivers: drivers.length,
      activeDrivers: drivers.filter((d: any) => d.isAvailable).length,
      totalCategories: categories.length,
      totalRestaurants: restaurants.length,
      totalUsers: users.length,
      totalRevenue: totalRevenue.toFixed(2),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "فشل في جلب الإحصائيات" });
  }
});

router.post("/drivers", async (req, res) => {
  try {
    console.log("Driver creation request data:", req.body);
    
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // التحقق من البيانات المطلوبة
    if (!coercedData.name || !coercedData.phone || !coercedData.password) {
      return res.status(400).json({ 
        error: "البيانات المطلوبة ناقصة", 
        details: "الاسم ورقم الهاتف وكلمة المرور مطلوبة"
      });
    }
    
    // التحقق من صحة البيانات مع الحقول المطلوبة
    const driverData = {
      ...coercedData,
      // التأكد من وجود الحقول الافتراضية
      isAvailable: coercedData.isAvailable !== undefined ? coercedData.isAvailable : true,
      isActive: coercedData.isActive !== undefined ? coercedData.isActive : true,
      earnings: coercedData.earnings || "0",
      userType: "driver",
      currentLocation: coercedData.currentLocation || null
    };
    
    console.log("Processed driver data:", driverData);
    
    const validatedData = insertDriverSchema.parse(driverData);
    
    const newDriver = await dbStorage.createDriver(validatedData);
    res.status(201).json(newDriver);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Driver validation errors:", error.errors);
      return res.status(400).json({ 
        error: "بيانات السائق غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في إضافة السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/drivers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // التحقق من صحة البيانات المحدثة (جزئي)
    const validatedData = insertDriverSchema.partial().parse(coercedData);
    
    const updatedDriver = await dbStorage.updateDriver(id, validatedData);
    
    if (!updatedDriver) {
      return res.status(404).json({ error: "السائق غير موجود" });
    }
    
    res.json(updatedDriver);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "بيانات تحديث السائق غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في تحديث السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/drivers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await dbStorage.deleteDriver(id);
    
    if (!success) {
      return res.status(404).json({ error: "السائق غير موجود" });
    }
    
    res.json({ success: true, message: "تم حذف السائق بنجاح" });
  } catch (error) {
    console.error("خطأ في حذف السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إحصائيات السائق
router.get("/drivers/:id/stats", async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    // جلب جميع الطلبات الخاصة بالسائق
    const allOrders = await storage.getOrders();
    let driverOrders = allOrders.filter(order => order.driverId === id);
    
    // تطبيق مرشح التاريخ إذا تم تحديده
    if (startDate) {
      const start = new Date(startDate as string);
      driverOrders = driverOrders.filter(order => order.createdAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      driverOrders = driverOrders.filter(order => order.createdAt <= end);
    }
    
    // حساب الإحصائيات
    const totalOrders = driverOrders.length;
    const completedOrders = driverOrders.filter(order => order.status === 'delivered').length;
    const cancelledOrders = driverOrders.filter(order => order.status === 'cancelled').length;
    
    // حساب إجمالي الأرباح (من حقل driverEarnings إذا وجد)
    const totalEarnings = driverOrders.reduce((sum, order) => {
      // افتراض أن driverEarnings موجود في Order أو حسابه من إجمالي الطلب
      const earnings = parseFloat((order as any).driverEarnings || "0");
      return sum + earnings;
    }, 0);
    
    const stats = {
      totalOrders,
      totalEarnings,
      completedOrders,
      cancelledOrders
    };
    
    res.json(stats);
  } catch (error) {
    console.error("خطأ في إحصائيات السائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ==================== إدارة مالية السائقين ====================

// جلب الملخص المالي لجميع السائقين
router.get("/drivers/finances", async (req, res) => {
  try {
    const driversList = await storage.getDrivers();
    const financialSummaries = await Promise.all(
      driversList.map(async (driver) => {
        const balance = await storage.getDriverBalance(driver.id);
        return {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          balance: balance || {
            totalBalance: "0",
            availableBalance: "0",
            withdrawnAmount: "0",
            pendingAmount: "0"
          }
        };
      })
    );
    res.json(financialSummaries);
  } catch (error) {
    console.error("خطأ في جلب البيانات المالية للسائقين:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب التفاصيل المالية لسائق محدد
router.get("/drivers/:id/finances", async (req, res) => {
  try {
    const { id } = req.params;
    const [balance, transactions, commissions, withdrawals] = await Promise.all([
      storage.getDriverBalance(id),
      storage.getDriverTransactions(id),
      storage.getDriverCommissions(id),
      storage.getDriverWithdrawals(id)
    ]);

    res.json({
      balance: balance || {
        totalBalance: "0",
        availableBalance: "0",
        withdrawnAmount: "0",
        pendingAmount: "0"
      },
      transactions: transactions || [],
      commissions: commissions || [],
      withdrawals: withdrawals || []
    });
  } catch (error) {
    console.error("خطأ في جلب التفاصيل المالية للسائق:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إضافة معاملة يدوية (مكافأة أو خصم)
router.post("/drivers/:id/transactions", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, description } = req.body;

    if (!amount || !type) {
      return res.status(400).json({ error: "المبلغ والنوع مطلوبان" });
    }

    const transaction = await storage.createDriverTransaction({
      driverId: id,
      amount: amount.toString(),
      type,
      description: description || "تسوية يدوية من الإدارة",
      referenceId: "admin_manual"
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error("خطأ في إنشاء المعاملة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب طلبات السحب المعلقة
router.get("/withdrawals/pending", async (req, res) => {
  try {
    const driversList = await storage.getDrivers();
    const allWithdrawals = await Promise.all(
      driversList.map(driver => storage.getDriverWithdrawals(driver.id))
    );
    
    const pendingWithdrawals = allWithdrawals
      .flat()
      .filter(w => w.status === 'pending')
      .map(w => {
        const driver = driversList.find(d => d.id === w.driverId);
        return {
          ...w,
          userName: driver?.name || 'سائق غير معروف',
          userType: 'driver'
        };
      });

    res.json(pendingWithdrawals);
  } catch (error) {
    console.error("خطأ في جلب طلبات السحب المعلقة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث حالة طلب سحب
router.put("/withdrawals/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({ error: "الحالة مطلوبة" });
    }

    const updated = await storage.updateWithdrawal(id, {
      status,
      adminNotes,
      processedAt: status === 'completed' ? new Date() : undefined
    });

    if (!updated) {
      return res.status(404).json({ error: "طلب السحب غير موجود" });
    }

    res.json(updated);
  } catch (error) {
    console.error("خطأ في تحديث طلب السحب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// الموافقة على طلب سحب
router.post("/withdrawals/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await storage.updateWithdrawal(id, {
      status: 'completed',
      processedAt: new Date()
    });

    if (!updated) {
      return res.status(404).json({ error: "طلب السحب غير موجود" });
    }

    res.json(updated);
  } catch (error) {
    console.error("خطأ في الموافقة على طلب السحب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// رفض طلب سحب
router.post("/withdrawals/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const updated = await storage.updateWithdrawal(id, {
      status: 'rejected',
      adminNotes: reason
    });

    if (!updated) {
      return res.status(404).json({ error: "طلب السحب غير موجود" });
    }

    res.json(updated);
  } catch (error) {
    console.error("خطأ في رفض طلب السحب:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث حالة عمولة
router.put("/commissions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "الحالة مطلوبة" });
    }

    const updated = await storage.updateDriverCommission(id, { status });

    if (!updated) {
      return res.status(404).json({ error: "العمولة غير موجودة" });
    }

    res.json(updated);
  } catch (error) {
    console.error("خطأ في تحديث العمولة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب المعاملات المالية الشاملة
router.get("/transactions", async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = to ? new Date(to as string) : new Date();
    
    // جلب جميع السائقين أولاً لربط الأسماء
    const driversList = await storage.getDrivers();
    
    // جلب معاملات جميع السائقين
    const allTransactions = await Promise.all(
      driversList.map(async (driver) => {
        const txs = await storage.getDriverTransactions(driver.id);
        return txs.map(tx => ({
          ...tx,
          userName: driver.name,
          userType: 'driver',
          fromUser: tx.type === 'withdrawal' ? driver.name : 'المنصة',
          toUser: tx.type === 'withdrawal' ? 'البنك / محفظة السائق' : driver.name,
          amount: parseFloat(tx.amount.toString()),
          status: 'completed' // في نظامنا الحالي المعاملات المسجلة هي مكتملة
        }));
      })
    );
    
    let flatTransactions = allTransactions.flat();
    
    // تصفية حسب التاريخ
    flatTransactions = flatTransactions.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate >= fromDate && txDate <= toDate;
    });
    
    // ترتيب تنازلي حسب التاريخ
    flatTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(flatTransactions);
  } catch (error) {
    console.error("خطأ في جلب المعاملات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب التقارير المالية
router.get("/financial-reports", async (req, res) => {
  try {
    const { from, to, type } = req.query;
    const fromDate = from ? new Date(from as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = to ? new Date(to as string) : new Date();

    const ordersList = await storage.getOrders();
    const filteredOrders = ordersList.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= fromDate && orderDate <= toDate;
    });
    
    const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered');
    
    // حساب الإحصائيات الأساسية
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || "0"), 0);
    const deliveryFees = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.deliveryFee || "0"), 0);
    const platformFees = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.companyEarnings || "0"), 0);
    const restaurantPayments = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.restaurantEarnings || "0"), 0);
    
    // جلب بيانات السائقين وسحوبات السائقين والمطاعم
    const driversList = await storage.getDrivers();
    const driverWithdrawals = (await Promise.all(driversList.map(d => storage.getDriverWithdrawals(d.id)))).flat();
    
    // سحوبات وتسويات المطاعم
    let restaurantSettlements: any[] = [];
    try {
      const restWRes = await db.execute(sql`SELECT * FROM withdrawal_requests WHERE entity_type = 'restaurant'`);
      restaurantSettlements = (restWRes.rows || restWRes).map((r: any) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        createdAt: r.created_at || r.createdAt
      }));
    } catch (_) {}

    const allWithdrawals = [...driverWithdrawals, ...restaurantSettlements];

    const filteredWithdrawals = allWithdrawals.filter(w => {
      const wDate = new Date(w.createdAt);
      return wDate >= fromDate && wDate <= toDate;
    });

    const pendingWithdrawals = filteredWithdrawals.filter(w => w.status === 'pending');
    const completedWithdrawals = filteredWithdrawals.filter(w => w.status === 'completed');
    const driverPayments = completedWithdrawals
      .filter(w => !restaurantSettlements.some(rs => rs.id === w.id))
      .reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0);

    const storeSettlementsPaid = completedWithdrawals
      .filter(w => restaurantSettlements.some(rs => rs.id === w.id))
      .reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0);

    // جلب الخرجيات والمصروفات الإدارية المفلترة بالفترة
    let totalAppExpenses = 0;
    try {
      const expensesRes = await db.execute(sql`
        SELECT * FROM app_expenses 
        WHERE expense_date >= ${fromDate} AND expense_date <= ${toDate}
      `);
      const rows = expensesRes.rows || expensesRes;
      totalAppExpenses = rows.reduce((s: number, r: any) => s + parseFloat(r.amount || '0'), 0);
    } catch (_) {
      try {
        const expensesRes = await db.execute(sql`SELECT * FROM app_expenses`);
        const rows = expensesRes.rows || expensesRes;
        totalAppExpenses = rows.reduce((s: number, r: any) => s + parseFloat(r.amount || '0'), 0);
      } catch (__) {}
    }

    // حساب صافي ربح المنصة الدقيق = عمولات المتاجر + رسوم التوصيل الصافية (رسوم التوصيل - مستحقات السائقين) - المصروفات التشغيلية
    const netPlatformDeliveryEarnings = Math.max(0, deliveryFees - driverPayments);
    const grossPlatformProfit = platformFees + netPlatformDeliveryEarnings;
    const netProfit = grossPlatformProfit - totalAppExpenses;

    // إنشاء التقرير
    const report = {
      id: "rep_" + Date.now(),
      period: type === 'monthly' ? fromDate.toLocaleDateString('ar-YE', { month: 'long', year: 'numeric' }) : "الفترة المختارة",
      totalRevenue,
      totalExpenses: driverPayments + storeSettlementsPaid + totalAppExpenses,
      totalAppExpenses,
      grossProfit: grossPlatformProfit,
      netProfit,
      commissionEarned: platformFees,
      deliveryFees,
      platformFees,
      restaurantPayments: restaurantPayments,
      storeSettlementsPaid: storeSettlementsPaid,
      driverPayments,
      withdrawalRequests: filteredWithdrawals.length,
      pendingWithdrawals: pendingWithdrawals.length,
      completedWithdrawals: completedWithdrawals.length,
      taxAmount: totalRevenue * 0.05,
      transactionCount: deliveredOrders.length,
      averageOrderValue: deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0,
      growthRate: 15.5,
      status: "published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.json([report]);
  } catch (error) {
    console.error("خطأ في جلب التقارير المالية:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ===== إدارة الخرجيات والمصروفات Operational Expenses =====

router.get("/expenses", async (req, res) => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'operational' NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        expense_date TIMESTAMP DEFAULT NOW() NOT NULL,
        notes TEXT,
        recipient VARCHAR(255),
        documents TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    const expensesList = await db.execute(sql`SELECT * FROM app_expenses ORDER BY expense_date DESC`);
    const rows = expensesList.rows || expensesList;
    res.json(rows.map((row: any) => {
      let docs: any[] = [];
      if (row.documents) {
        if (typeof row.documents === 'string') {
          try { docs = JSON.parse(row.documents); } catch { docs = [row.documents]; }
        } else if (Array.isArray(row.documents)) {
          docs = row.documents;
        }
      }
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        amount: parseFloat(row.amount || '0'),
        expenseDate: row.expense_date || row.expenseDate,
        notes: row.notes || '',
        recipient: row.recipient || '',
        documents: docs,
        createdBy: row.created_by || row.createdBy || 'المدير العام',
        createdAt: row.created_at || row.createdAt,
      };
    }));
  } catch (error) {
    console.error("خطأ في جلب المصروفات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/expenses", async (req, res) => {
  try {
    const { title, category, amount, expenseDate, notes, recipient, documents, createdBy } = req.body;
    if (!title || amount === undefined || amount === null || String(amount).trim() === '') {
      return res.status(400).json({ error: "البيان والمبلغ مطلوبة" });
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'operational' NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        expense_date TIMESTAMP DEFAULT NOW() NOT NULL,
        notes TEXT,
        recipient VARCHAR(255),
        documents TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    const docsJson = JSON.stringify(Array.isArray(documents) ? documents : (documents ? [documents] : []));
    const dateVal = expenseDate ? new Date(expenseDate) : new Date();
    const userVal = createdBy || (req as any).user?.name || 'المدير العام';

    const result = await db.execute(sql`
      INSERT INTO app_expenses (title, category, amount, expense_date, notes, recipient, documents, created_by)
      VALUES (${title}, ${category || 'operational'}, ${amount}, ${dateVal}, ${notes || ''}, ${recipient || ''}, ${docsJson}, ${userVal})
      RETURNING *
    `);

    const row: any = (result.rows || result)[0];
    let docsResult: any[] = [];
    if (row.documents) {
      if (typeof row.documents === 'string') {
        try { docsResult = JSON.parse(row.documents); } catch { docsResult = [row.documents]; }
      } else if (Array.isArray(row.documents)) {
        docsResult = row.documents;
      }
    }

    res.json({
      id: row.id,
      title: row.title,
      category: row.category,
      amount: parseFloat(row.amount || '0'),
      expenseDate: row.expense_date,
      notes: row.notes,
      recipient: row.recipient,
      documents: docsResult,
      createdBy: row.created_by,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error("خطأ في إضافة المصروفات:", error);
    res.status(500).json({ error: "فشل إضافة المصروفات" });
  }
});

router.delete("/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM app_expenses WHERE id = ${id}`);
    res.json({ success: true, message: "تم حذف البند بنجاح" });
  } catch (error) {
    console.error("خطأ في حذف المصروفات:", error);
    res.status(500).json({ error: "فشل حذف البند" });
  }
});

// إدارة العروض الخاصة
router.get("/special-offers", async (req, res) => {
  try {
    const offers = await storage.getSpecialOffers();
    
    // ترتيب العروض حسب تاريخ الإنشاء (الأحدث أولاً) بأسلوب آمن لتجنب خطأ getTime
    const sortedOffers = offers.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    
    res.json(sortedOffers);
  } catch (error) {
    console.error("خطأ في جلب العروض الخاصة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/special-offers", async (req, res) => {
  try {
    console.log("Special offer creation request data:", req.body);
    
    // تنظيف وتحويل البيانات باستخدام helper function
    const coercedData = coerceRequestData(req.body);
    
    // تقديم قيم افتراضية للحقول المطلوبة
    const offerData: any = {
      // الحقول المطلوبة
      title: coercedData.title || "عرض خاص جديد",
      description: coercedData.description || "وصف العرض الخاص",
      image: coercedData.image || "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
      
      // نوع العرض: discount | bundle
      offerType: coercedData.offerType || "discount",
      
      // تفاصيل الخصم (لالعروض من نوع discount)
      discountPercent: coercedData.offerType === "bundle" ? null : (coercedData.discountPercent ?? null),
      discountAmount: coercedData.offerType === "bundle" ? null : (coercedData.discountAmount ?? null),
      discountScope: coercedData.offerType === "discount" ? (coercedData.discountScope || "store") : null,
      minimumOrder: coercedData.minimumOrder || "0",
      
      // سعر المجموعة (لالعروض من نوع bundle)
      bundlePrice: coercedData.offerType === "bundle" ? (coercedData.bundlePrice ?? null) : null,
      
      // صلاحية العرض
      validUntil: coercedData.validUntil ?? null,
      
      // حالة العرض
      isActive: coercedData.isActive !== undefined ? coercedData.isActive : true,
      
      restaurantId: coercedData.restaurantId ?? null,
      menuItemId: coercedData.menuItemId ?? null,
      categoryId: coercedData.categoryId ?? null,
      sectionId: coercedData.sectionId ?? null,
      showBadge: coercedData.showBadge !== undefined ? coercedData.showBadge : true,
      badgeText1: coercedData.badgeText1 || "طازج يومياً",
      badgeText2: coercedData.badgeText2 || "عروض حصرية",
      
      // حقول التوقيت
      createdAt: new Date()
    };
    
    console.log("Processed special offer data:", offerData);

    // قواعد الربط:
    //   - عرض خاص بمتجر (restaurantId محدد):
    //       * لا يتم ربطه بالتصنيف العام "العروض"
    //       * إذا لم يحدد المسؤول قسماً: ابحث عن قسم اسمه "العروض" داخل المتجر،
    //         وإن لم يوجد فأنشئه تلقائياً واربط العرض به.
    //   - عرض عام (بدون restaurantId):
    //       * إذا لم يحدد تصنيفاً: تأكد من وجود تصنيف عام "العروض" واربط العرض به.
    if (offerData.restaurantId) {
      // عرض خاص بمتجر
      offerData.categoryId = null; // لا تربط العروض الخاصة بمتجر بتصنيف عام
      if (!offerData.sectionId) {
        try {
          const existingSections = await storage.getRestaurantSections(offerData.restaurantId);
          let offersSection = existingSections.find((s: any) => s.name === 'العروض' || s.name === 'Offers');
          if (!offersSection) {
            offersSection = await storage.createRestaurantSection({
              restaurantId: offerData.restaurantId,
              name: 'العروض',
              description: 'العروض الخاصة لهذا المتجر',
              sortOrder: -1,
              isActive: true,
            } as any);
          }
          if (offersSection) offerData.sectionId = offersSection.id;
        } catch (secErr) {
          console.error('Error ensuring offers section for store:', secErr);
        }
      }
    } else {
      // عرض عام (شركة بكاملها) - تأكد من وجود التصنيف العام "العروض"
      try {
        const allCategories = await storage.getCategories();
        let offersCategory = allCategories.find(c => c.name === 'العروض' || c.name === 'Offers');
        if (!offersCategory) {
          offersCategory = await storage.createCategory({
            name: 'العروض',
            icon: 'fas fa-tags',
            image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400',
            isActive: true,
            sortOrder: -1,
            type: 'primary'
          });
        }
        if (!offerData.categoryId && offersCategory) {
          offerData.categoryId = offersCategory.id;
        }
      } catch (catError) {
        console.error('Error ensuring Offers category exists:', catError);
      }
    }

    const validatedData = insertSpecialOfferSchema.parse(offerData);
    
    const newOffer = await storage.createSpecialOffer(validatedData);

    // إذا تم ربط العرض بمنتج، قم بتحديث المنتج ليكون عرضاً خاصاً
    if (newOffer.menuItemId) {
      await storage.updateMenuItem(newOffer.menuItemId, { isSpecialOffer: true });
    }
    
    broadcastEvent('menu_update', { action: 'offer_create', offer: newOffer });
    broadcastSettingsChanged('restaurants');
    res.status(201).json(newOffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Special offer validation errors:", error.errors);
      return res.status(400).json({ 
        error: "بيانات العرض الخاص غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في إضافة العرض الخاص:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/special-offers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // تطبيق coercion على البيانات المحدثة أيضاً
    const coercedData = coerceRequestData(req.body);
    
    const updatePayload: any = {
      title: coercedData.title,
      description: coercedData.description,
      image: coercedData.image,
      offerType: coercedData.offerType || "discount",
      discountPercent: coercedData.offerType === 'discount' ? (coercedData.discountPercent ?? null) : null,
      discountAmount: coercedData.offerType === 'discount' ? (coercedData.discountAmount ?? null) : null,
      discountScope: coercedData.offerType === 'discount' ? (coercedData.discountScope || "store") : null,
      minimumOrder: coercedData.minimumOrder !== undefined ? coercedData.minimumOrder : "0",
      bundlePrice: coercedData.offerType === 'bundle' ? (coercedData.bundlePrice ?? null) : null,
      validUntil: coercedData.validUntil ?? null,
      isActive: coercedData.isActive !== undefined ? coercedData.isActive : true,
      restaurantId: coercedData.restaurantId ?? null,
      menuItemId: coercedData.menuItemId ?? null,
      categoryId: coercedData.categoryId ?? null,
      sectionId: coercedData.sectionId ?? null,
      showBadge: coercedData.showBadge !== undefined ? coercedData.showBadge : true,
      badgeText1: coercedData.badgeText1,
      badgeText2: coercedData.badgeText2,
    };

    // إزالة المعرف id حتى لا يتم تعديله بجدول قاعدة البيانات
    delete updatePayload.id;

    // إذا تم تغيير المتجر أو طلب إنشاء قسم تلقائياً، نتحقق من وجود قسم "العروض"
    if (updatePayload.restaurantId && (req.body.autoCreateOffersSection || !updatePayload.sectionId)) {
      try {
        const existingSections = await storage.getRestaurantSections(updatePayload.restaurantId);
        let offersSection = existingSections.find((s: any) => s.name === 'العروض' || s.name === 'Offers');
        if (!offersSection) {
          offersSection = await storage.createRestaurantSection({
            restaurantId: updatePayload.restaurantId,
            name: 'العروض',
            description: 'العروض الخاصة لهذا المتجر',
            sortOrder: -1,
            isActive: true,
          } as any);
        }
        if (offersSection && !updatePayload.sectionId) {
          updatePayload.sectionId = offersSection.id;
        }
      } catch (secErr) {
        console.error('Error ensuring offers section for store on update:', secErr);
      }
    }
    
    const validatedData = insertSpecialOfferSchema.partial().parse(updatePayload);
    const updatedOffer = await storage.updateSpecialOffer(id, validatedData);
    
    if (!updatedOffer) {
      return res.status(404).json({ error: "العرض الخاص غير موجود" });
    }
    
    broadcastEvent('menu_update', { action: 'offer_update', offer: updatedOffer });
    broadcastSettingsChanged('restaurants');
    res.json(updatedOffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "بيانات تحديث العرض الخاص غير صحيحة", 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    console.error("خطأ في تحديث العرض الخاص:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/special-offers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await storage.deleteSpecialOffer(id);
    
    if (!success) {
      return res.status(404).json({ error: "العرض الخاص غير موجود" });
    }
    
    broadcastEvent('menu_update', { action: 'offer_delete', id });
    broadcastSettingsChanged('restaurants');
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف العرض الخاص:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إدارة الإشعارات
router.post("/notifications", async (req: any, res) => {
  try {
    const notificationData = {
      ...req.body,
      createdBy: req.admin?.id || null
    };
    
    const newNotification = await storage.createNotification(notificationData);
    
    // بث الإشعار عبر WebSocket لجميع المتصلين
    broadcastEvent('new_notification', {
      notification: newNotification,
      recipientType: notificationData.recipientType,
      recipientId: notificationData.recipientId,
      timestamp: new Date().toISOString()
    });
    
    res.json(newNotification);
  } catch (error) {
    console.error("خطأ في إنشاء الإشعار:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// جلب جميع إشعارات لوحة التحكم الإدارية
router.get("/notifications", async (req: any, res) => {
  try {
    const { recipientType, recipientId, limit: limitParam } = req.query;
    const limitNum = parseInt(limitParam as string) || 50;
    
    // افتراضياً لـ admin router، جلب إشعارات الإدارة فقط
    const targetRecipientType = (recipientType as string | undefined) || "admin";
    
    const notifs = await storage.getNotifications(
      targetRecipientType, 
      recipientId as string | undefined
    );
    
    // تصفية دقيقة لاستبعاد أي إشعارات موجهة للعملاء أو خاصة بتحديثات حالة الطلب الموجهة للعميل
    const customerExcludeTypes = [
      "wasalni_received",
      "wasalni_status_update",
      "order_status_update",
      "driver_assigned",
      "wasalni_driver_assigned"
    ];

    const customerExcludeTitles = [
      "تم استلام طلبك",
      "تم استلام الطلب",
      "تم تحديث طلبك",
      "تم تحديث الطلب",
      "تحديث حالة الطلب",
      "تحديث حالة طلبك",
      "تم استلام طلب وصل لي",
      "تحديث طلب وصل لي",
      "تم تحديد سائق لطلبك",
      "تم تعيين سائق لطلبك"
    ];

    const adminFilteredNotifs = notifs.filter((n: any) => {
      // استبعاد أي إشعار متلقيه عميل أو سائق
      if (n.recipientType === "customer" || n.recipientType === "driver") return false;
      
      // استبعاد الأنواع والعناوين الخاصة بإشعارات حالة الطلب الموجهة للعملاء
      if (customerExcludeTypes.includes(n.type)) return false;
      if (customerExcludeTitles.some(title => (n.title || "").includes(title))) return false;

      return true;
    });

    res.json(adminFilteredNotifs.slice(0, limitNum));
  } catch (error) {
    console.error("خطأ في جلب الإشعارات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إعدادات النظام
router.get("/settings", async (req, res) => {
  try {
    const settings = await db.select()
      .from(schema.systemSettings)
      .orderBy(schema.systemSettings.category, schema.systemSettings.key);
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/settings/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const [updatedSetting] = await db.update(schema.systemSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(schema.systemSettings.key, key))
      .returning();
    
    // بث التحديث عبر WebSocket
    broadcastSettingsChanged(key);

    res.json(updatedSetting);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تحديث أوقات العمل
router.put("/business-hours", async (req, res) => {
  try {
    const { opening_time, closing_time, store_status } = req.body;
    
    if (opening_time !== undefined && opening_time !== null) {
      await storage.updateUiSetting('opening_time', String(opening_time));
      broadcastSettingsChanged('opening_time');
    }
    
    if (closing_time !== undefined && closing_time !== null) {
      await storage.updateUiSetting('closing_time', String(closing_time));
      broadcastSettingsChanged('closing_time');
    }
    
    if (store_status !== undefined && store_status !== null) {
      await storage.updateUiSetting('store_status', String(store_status));
      broadcastSettingsChanged('store_status');
    }
    
    broadcastSettingsChanged('business_hours');
    
    res.json({ success: true, message: "تم تحديث أوقات العمل بنجاح" });
  } catch (error) {
    console.error("خطأ في تحديث أوقات العمل:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// إدارة المستخدمين الموحدة (عملاء، سائقين، مديرين)
router.get("/users", async (req, res) => {
  try {
    const isDb = storage.constructor.name === 'DatabaseStorage';
    let allUsers: any[] = [];

    if (isDb) {
      // جلب العملاء
      const customers = await db.select({
        id: schema.customers.id,
        name: schema.customers.name,
        email: schema.customers.email,
        phone: schema.customers.phone,
        role: sql<string>`'customer'`,
        isActive: schema.customers.isActive,
        createdAt: schema.customers.createdAt,
        address: schema.customers.address
      }).from(schema.customers);

      // جلب السائقين من جدول drivers
      let driversList: any[] = [];
      try {
        driversList = await db.select({
          id: schema.drivers.id,
          name: schema.drivers.name,
          email: schema.drivers.email,
          phone: schema.drivers.phone,
          role: sql<string>`'driver'`,
          isActive: schema.drivers.isActive,
          createdAt: schema.drivers.createdAt,
          address: sql<string>`NULL`
        }).from(schema.drivers);
      } catch (e) {
        console.error("خطأ في جلب السائقين لجدول المستخدمين:", e);
      }

      // جلب السائقين والمديرين من adminUsers
      const adminUsers = await db.select({
        id: schema.adminUsers.id,
        name: schema.adminUsers.name,
        email: schema.adminUsers.email,
        phone: schema.adminUsers.phone,
        role: schema.adminUsers.userType,
        isActive: schema.adminUsers.isActive,
        createdAt: schema.adminUsers.createdAt,
        address: sql<string>`NULL`
      }).from(schema.adminUsers);

      const userMap = new Map();
      for (const d of driversList) {
        userMap.set(d.id, d);
      }
      for (const a of adminUsers) {
        if (!userMap.has(a.id)) {
          userMap.set(a.id, a);
        }
      }
      for (const c of customers) {
        if (!userMap.has(c.id)) {
          userMap.set(c.id, c);
        }
      }

      allUsers = Array.from(userMap.values())
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      const rawCustomers = (await storage.getUsers?.()) || [];
      const rawDrivers = (await storage.getDrivers?.()) || [];

      const userMap = new Map();
      for (const d of rawDrivers) {
        userMap.set(d.id, { ...d, role: 'driver', email: d.email || '' });
      }
      for (const c of rawCustomers) {
        if (!userMap.has(c.id)) {
          userMap.set(c.id, { ...c, role: 'customer' });
        }
      }

      allUsers = Array.from(userMap.values())
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    res.json(allUsers);
  } catch (error) {
    console.error("خطأ في جلب المستخدمين:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, isActive, password } = req.body;
    
    let targetTable = 'customers';
    let currentUser = null;
    
    // 1. البحث عن المستخدم في جدول العملاء
    const customerResult = await db.select()
      .from(schema.customers)
      .where(eq(schema.customers.id, id))
      .limit(1);
    
    if (customerResult.length > 0) {
      currentUser = customerResult[0];
      targetTable = 'customers';
    } else {
      // 2. البحث في جدول السائقين
      const driverResult = await db.select()
        .from(schema.drivers)
        .where(eq(schema.drivers.id, id))
        .limit(1);

      if (driverResult.length > 0) {
        currentUser = driverResult[0];
        targetTable = 'drivers';
      } else {
        // 3. البحث في جدول المديرين
        const adminResult = await db.select()
          .from(schema.adminUsers)
          .where(eq(schema.adminUsers.id, id))
          .limit(1);
        
        if (adminResult.length > 0) {
          currentUser = adminResult[0];
          targetTable = 'adminUsers';
        }
      }
    }

    if (!currentUser) {
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }

    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    let updatedUser;
    
    if (targetTable === 'drivers') {
      if (role && role !== 'driver') {
        if (role === 'customer') {
          const [newCustomer] = await db.insert(schema.customers).values({
            name: name || currentUser.name,
            username: (email || currentUser.email || phone || id).split('@')[0],
            email: email || currentUser.email,
            phone: phone || currentUser.phone,
            isActive: isActive !== undefined ? isActive : currentUser.isActive
          }).returning();
          await db.delete(schema.drivers).where(eq(schema.drivers.id, id));
          updatedUser = { ...newCustomer, role: 'customer' };
        } else {
          const [newAdmin] = await db.insert(schema.adminUsers).values({
            name: name || currentUser.name,
            email: email || currentUser.email,
            phone: phone || currentUser.phone,
            userType: role,
            isActive: isActive !== undefined ? isActive : currentUser.isActive
          }).returning();
          await db.delete(schema.drivers).where(eq(schema.drivers.id, id));
          updatedUser = { ...newAdmin, role: newAdmin.userType };
        }
      } else {
        const [result] = await db.update(schema.drivers)
          .set(updateData)
          .where(eq(schema.drivers.id, id))
          .returning();
        updatedUser = { ...result, role: 'driver' };
      }
    } else if (role && role !== (currentUser as any).userType && role !== 'customer') {
      if (targetTable === 'customers' && (role === 'driver' || role === 'admin')) {
        if (role === 'driver') {
          const salt = await bcrypt.genSalt(10);
          const defaultHash = await bcrypt.hash(password || '123456', salt);
          const [newDriver] = await db.insert(schema.drivers).values({
            name: name || currentUser.name,
            phone: phone || currentUser.phone,
            email: email || currentUser.email,
            password: defaultHash,
            isActive: isActive !== undefined ? isActive : currentUser.isActive
          }).returning();
          await db.delete(schema.customers).where(eq(schema.customers.id, id));
          updatedUser = { ...newDriver, role: 'driver' };
        } else {
          const [newAdminUser] = await db.insert(schema.adminUsers).values({
            name: name || currentUser.name,
            email: email || currentUser.email,
            phone: phone || currentUser.phone,
            userType: role,
            isActive: isActive !== undefined ? isActive : currentUser.isActive
          }).returning();
          await db.delete(schema.customers).where(eq(schema.customers.id, id));
          updatedUser = { ...newAdminUser, role: newAdminUser.userType };
        }
      } else if (targetTable === 'adminUsers' && role === 'customer') {
        const [newCustomer] = await db.insert(schema.customers).values({
          name: name || currentUser.name,
          username: (email || currentUser.email || id).split('@')[0],
          email: email || currentUser.email,
          phone: phone || currentUser.phone,
          isActive: isActive !== undefined ? isActive : currentUser.isActive
        }).returning();
        await db.delete(schema.adminUsers).where(eq(schema.adminUsers.id, id));
        updatedUser = { ...newCustomer, role: 'customer' };
      } else if (targetTable === 'adminUsers') {
        updateData.userType = role;
        const [result] = await db.update(schema.adminUsers)
          .set(updateData)
          .where(eq(schema.adminUsers.id, id))
          .returning();
        updatedUser = { ...result, role: result.userType };
      }
    } else {
      if (targetTable === 'customers') {
        delete updateData.userType;
        const [result] = await db.update(schema.customers)
          .set(updateData)
          .where(eq(schema.customers.id, id))
          .returning();
        updatedUser = { ...result, role: 'customer' };
      } else {
        if (role && (role === 'driver' || role === 'admin')) {
          updateData.userType = role;
        }
        const [result] = await db.update(schema.adminUsers)
          .set(updateData)
          .where(eq(schema.adminUsers.id, id))
          .returning();
        updatedUser = { ...result, role: result.userType };
      }
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("خطأ في تحديث المستخدم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const customerResult = await db.select()
      .from(schema.customers)
      .where(eq(schema.customers.id, id))
      .limit(1);
    
    if (customerResult.length > 0) {
      await storage.deleteUser(id);
      res.json({ success: true, message: "تم حذف العميل بنجاح" });
      return;
    }

    const driverResult = await db.select()
      .from(schema.drivers)
      .where(eq(schema.drivers.id, id))
      .limit(1);

    if (driverResult.length > 0) {
      await storage.deleteDriver(id);
      res.json({ success: true, message: "تم حذف السائق بنجاح" });
      return;
    }
    
    const adminResult = await db.select()
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, id))
      .limit(1);
    
    if (adminResult.length > 0) {
      const user = adminResult[0];
      
      if (user.userType === 'admin' && user.email === 'admin@alsarie-one.com') {
        return res.status(403).json({ error: "لا يمكن حذف المدير الرئيسي" });
      }
      
      await storage.deleteAdminUser(id);
      res.json({ success: true, message: "تم حذف المستخدم بنجاح" });
      return;
    }

    res.status(404).json({ error: "المستخدم غير موجود" });
  } catch (error) {
    console.error("خطأ في حذف المستخدم:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// تم دمج مسارات الملف الشخصي في القسم الموجود أسفل (Admin Profile Routes)

// UI Settings Routes
router.get("/ui-settings", async (req, res) => {
  try {
    const settings = await storage.getUiSettings();
    res.json(settings);
  } catch (error) {
    console.error('خطأ في جلب إعدادات الواجهة:', error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/ui-settings/bulk", async (req, res) => {
  try {
    const settingsMap = req.body;
    if (!settingsMap || typeof settingsMap !== 'object') {
      return res.status(400).json({ error: "بيانات غير صالحة" });
    }

    for (const [key, value] of Object.entries(settingsMap)) {
      if (value !== undefined && value !== null) {
        await storage.updateUiSetting(key, String(value));
        broadcastSettingsChanged(key);
      }
    }

    res.json({ success: true, message: "تم تحديث إعدادات الواجهة بنجاح" });
  } catch (error) {
    console.error("خطأ في تحديث إعدادات الواجهة دفعة واحدة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/ui-settings/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ 
        error: "Missing required fields",
        details: "Key and value are required" 
      });
    }

    const setting = await storage.updateUiSetting(key, String(value));
    
    if (!setting) {
      return res.status(400).json({ error: "فشل في تحديث الإعداد" });
    }

    // بث التحديث عبر WebSocket لمزامنة جميع الأجهزة فوراً
    broadcastSettingsChanged(key);

    res.json(setting);
  } catch (error) {
    console.error("خطأ في تحديث إعداد الواجهة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Coupon Routes
router.get("/coupons", async (req, res) => {
  try {
    const coupons = await storage.getCoupons();
    res.json(coupons);
  } catch (error) {
    console.error("خطأ في جلب الكوبونات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/coupons", async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.restaurantId || data.restaurantId === "") data.restaurantId = null;
    if (!data.categoryId || data.categoryId === "") data.categoryId = null;
    if (data.usageLimit === "" || data.usageLimit === undefined) data.usageLimit = null;
    if (data.maxDiscount === "" || data.maxDiscount === undefined) data.maxDiscount = null;
    if (data.startDate === "") data.startDate = null;
    if (data.endDate === "") data.endDate = null;

    const coupon = await storage.createCoupon(data);
    res.status(201).json(coupon);
  } catch (error: any) {
    console.error("خطأ في إضافة الكوبون:", error);
    if (error?.code === '23505') {
      return res.status(400).json({ error: "كود الكوبون مستخدم بالفعل، يرجى اختيار كود آخر" });
    }
    res.status(500).json({ error: "خطأ في الخادم: " + (error?.message || '') });
  }
});

router.put("/coupons/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.restaurantId === "") data.restaurantId = null;
    if (data.categoryId === "") data.categoryId = null;
    if (data.usageLimit === "") data.usageLimit = null;
    if (data.maxDiscount === "") data.maxDiscount = null;
    if (data.startDate === "") data.startDate = null;
    if (data.endDate === "") data.endDate = null;

    const coupon = await storage.updateCoupon(req.params.id, data);
    if (!coupon) return res.status(404).json({ error: "الكوبون غير موجود" });
    res.json(coupon);
  } catch (error) {
    console.error("خطأ في تحديث الكوبون:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/coupons/:id", async (req, res) => {
  try {
    const success = await storage.deleteCoupon(req.params.id);
    if (!success) return res.status(404).json({ error: "الكوبون غير موجود" });
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف الكوبون:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Detailed Reports Routes
router.get("/reports/detailed", async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const report = await storage.getDetailedReport(filters);
    res.json(report);
  } catch (error) {
    console.error("خطأ في جلب التقرير التفصيلي:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Payment Methods Routes
router.get("/payment-methods", async (req, res) => {
  try {
    const methods = await storage.getPaymentMethods();
    const methodsWithDocs = await Promise.all(methods.map(async (m: any) => {
      const docs = await storage.getPaymentMethodDocuments(m.id);
      return { ...m, documents: docs };
    }));
    res.json(methodsWithDocs);
  } catch (error) {
    console.error("خطأ في جلب طرق الدفع:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/payment-methods", async (req, res) => {
  try {
    const method = await storage.createPaymentMethod(req.body);
    res.status(201).json(method);
  } catch (error) {
    console.error("خطأ في إضافة طريقة الدفع:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/payment-methods/:id", async (req, res) => {
  try {
    const method = await storage.updatePaymentMethod(req.params.id, req.body);
    if (!method) return res.status(404).json({ error: "طريقة الدفع غير موجودة" });
    res.json(method);
  } catch (error) {
    console.error("خطأ في تحديث طريقة الدفع:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/payment-methods/:id", async (req, res) => {
  try {
    const success = await storage.deletePaymentMethod(req.params.id);
    if (!success) return res.status(404).json({ error: "طريقة الدفع غير موجودة" });
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف طريقة الدفع:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/payment-methods/:id/documents", async (req, res) => {
  try {
    const docs = await storage.getPaymentMethodDocuments(req.params.id);
    res.json(docs);
  } catch (error) {
    console.error("خطأ في جلب وثائق طريقة الدفع:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/payment-methods/:id/documents", async (req, res) => {
  try {
    const doc = await storage.createPaymentMethodDocument({ ...req.body, paymentMethodId: req.params.id });
    res.status(201).json(doc);
  } catch (error) {
    console.error("خطأ في إضافة وثيقة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/payment-methods/:id/documents/:docId", async (req, res) => {
  try {
    const doc = await storage.updatePaymentMethodDocument(req.params.docId, req.body);
    if (!doc) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    res.json(doc);
  } catch (error) {
    console.error("خطأ في تحديث الوثيقة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/payment-methods/:id/documents/:docId", async (req, res) => {
  try {
    const success = await storage.deletePaymentMethodDocument(req.params.docId);
    if (!success) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    res.json({ success: true });
  } catch (error) {
    console.error("خطأ في حذف الوثيقة:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});


router.post("/orders/clear-all", async (req, res) => {
  try {
    await storage.clearOrders();
    res.json({ success: true, message: "تم حذف جميع الطلبات بنجاح" });
  } catch (error) {
    console.error("خطأ في حذف الطلبات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/orders/clear-all", async (req, res) => {
  try {
    await storage.clearOrders();
    res.json({ success: true, message: "تم حذف جميع الطلبات بنجاح" });
  } catch (error) {
    console.error("خطأ في حذف الطلبات:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/orders/reset-numbers", async (req, res) => {
  try {
    const allSettings = await storage.getUiSettings();
    const settingsMap = new Map(allSettings.map((s: any) => [s.key, s.value]));
    const prefix = req.body.prefix !== undefined ? req.body.prefix : (settingsMap.get('order_number_prefix') || 'ORD-');
    const startNum = parseInt(req.body.startNumber || settingsMap.get('order_number_start') || '1001', 10);
    const digits = parseInt(req.body.digits || settingsMap.get('order_number_digits') || '4', 10);

    const allOrders = await storage.getOrders();
    const sorted = [...allOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const seq = startNum + i;
      const newNumber = `${prefix}${String(seq).padStart(digits, '0')}`;
      await storage.updateOrder(sorted[i].id, { orderNumber: newNumber });
    }
    res.json({ success: true, message: `تم إعادة تسلسل ${sorted.length} طلب للمتاجر بنجاح` });
  } catch (error) {
    console.error("خطأ في إعادة تسلسل أرقام طلبات المتاجر:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/wasalni/reset-numbers", async (req, res) => {
  try {
    const allSettings = await storage.getUiSettings();
    const settingsMap = new Map(allSettings.map((s: any) => [s.key, s.value]));
    const prefix = req.body.prefix !== undefined ? req.body.prefix : (settingsMap.get('wasalni_number_prefix') || 'WSL-');
    const startNum = parseInt(req.body.startNumber || settingsMap.get('wasalni_number_start') || '1001', 10);
    const digits = parseInt(req.body.digits || settingsMap.get('wasalni_number_digits') || '4', 10);

    const allWasalni = await db.select().from(wasalniRequests);
    const sorted = [...allWasalni].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const seq = startNum + i;
      const newNumber = `${prefix}${String(seq).padStart(digits, '0')}`;
      await db.update(wasalniRequests)
        .set({ requestNumber: newNumber })
        .where(eq(wasalniRequests.id, sorted[i].id));
    }
    res.json({ success: true, message: `تم إعادة تسلسل ${sorted.length} طلب لوصل لي بنجاح` });
  } catch (error) {
    console.error("خطأ في إعادة تسلسل أرقام طلبات وصل لي:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/backup", async (req, res) => {
  try {
    const [
      allOrders, allDrivers, allRestaurants, allCategories,
      allMenuItems, allSpecialOffers, allUsers
    ] = await Promise.all([
      storage.getOrders(),
      storage.getDrivers(),
      storage.getRestaurants(),
      storage.getCategories(),
      storage.getAllMenuItems(),
      storage.getSpecialOffers(),
      storage.getUsers ? storage.getUsers() : [],
    ]);

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        orders: allOrders,
        drivers: allDrivers,
        restaurants: allRestaurants,
        categories: allCategories,
        menuItems: allMenuItems,
        specialOffers: allSpecialOffers,
        users: allUsers,
      },
      counts: {
        orders: allOrders.length,
        drivers: allDrivers.length,
        restaurants: allRestaurants.length,
        categories: allCategories.length,
        menuItems: allMenuItems.length,
        specialOffers: allSpecialOffers.length,
        users: allUsers.length,
      }
    };

    const filename = `tamtom-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (error) {
    console.error("خطأ في إنشاء النسخة الاحتياطية:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/backup/stats", async (req, res) => {
  try {
    const [
      allOrders, allDrivers, allRestaurants, allCategories,
      allMenuItems, allSpecialOffers
    ] = await Promise.all([
      storage.getOrders(),
      storage.getDrivers(),
      storage.getRestaurants(),
      storage.getCategories(),
      storage.getAllMenuItems(),
      storage.getSpecialOffers(),
    ]);

    res.json({
      counts: {
        orders: allOrders.length,
        drivers: allDrivers.length,
        restaurants: allRestaurants.length,
        categories: allCategories.length,
        menuItems: allMenuItems.length,
        specialOffers: allSpecialOffers.length,
      },
      lastBackup: null,
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Admin Profile Routes
router.get("/profile", async (req: any, res) => {
  try {
    let admin: any = null;
    if (req.admin) {
      admin = req.admin;
    } else {
      const [found] = await db.select().from(adminUsers).where(eq(adminUsers.userType, 'admin')).limit(1);
      admin = found;
    }
    if (!admin) return res.status(404).json({ error: "لم يتم العثور على ملف المدير" });
    const { password: _, ...safeAdmin } = admin as any;
    res.json(safeAdmin);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/profile", async (req: any, res) => {
  try {
    const { name, email, username, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "الاسم والبريد الإلكتروني مطلوبان" });
    }
    let adminId: string;
    if (req.admin) {
      adminId = req.admin.id;
    } else {
      const [found] = await db.select().from(adminUsers).where(eq(adminUsers.userType, 'admin')).limit(1);
      if (!found) return res.status(404).json({ error: "لم يتم العثور على ملف المدير" });
      adminId = found.id;
    }
    const updatePayload: any = {
      name,
      email,
      username: username && username.trim() ? username.trim() : null,
      phone: phone && phone.trim() ? phone.trim() : null,
    };
    const [updated] = await db.update(adminUsers).set(updatePayload).where(eq(adminUsers.id, adminId)).returning();
    if (!updated) return res.status(404).json({ error: "لم يتم العثور على ملف المدير" });
    const { password: _, ...safeAdmin } = updated as any;
    res.json(safeAdmin);
  } catch (error: any) {
    console.error('❌ خطأ في تحديث ملف المدير:', error);
    if (error?.code === '23505') {
      return res.status(400).json({ error: "البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل" });
    }
    res.status(500).json({ error: "خطأ في الخادم: " + (error?.message || '') });
  }
});

router.put("/change-password", async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    let admin: any = null;
    if (req.admin) {
      const [found] = await db.select().from(adminUsers).where(eq(adminUsers.id, req.admin.id)).limit(1);
      admin = found;
    } else {
      const [found] = await db.select().from(adminUsers).where(eq(adminUsers.userType, 'admin')).limit(1);
      admin = found;
    }
    if (!admin) return res.status(404).json({ error: "لم يتم العثور على المدير" });
    const isValid = await bcrypt.compare(currentPassword, admin.password || '');
    if (!isValid) {
      return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(adminUsers).set({ password: hashed } as any).where(eq(adminUsers.id, admin.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Sub-admins Management - للمدير الرئيسي فقط
router.get("/sub-admins", requirePermission('manage_admins'), async (req, res) => {
  try {
    const subAdmins = await db.select().from(adminUsers).where(eq(adminUsers.userType, 'sub_admin'));
    const safe = subAdmins.map((u: any) => { const { password: _, ...rest } = u; return rest; });
    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/sub-admins", requirePermission('manage_admins'), async (req, res) => {
  try {
    const { name, phone, password, permissions, isActive } = req.body;
    let { email, username } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "الاسم مطلوب" });
    if (!phone || !phone.trim()) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
    if (!password) return res.status(400).json({ error: "كلمة المرور مطلوبة" });
    // توليد بريد إلكتروني افتراضي إذا لم يُقدَّم
    if (!email || !email.trim()) {
      email = `${phone.replace(/\D/g, '')}@subadmin.local`;
    }
    const hashed = await bcrypt.hash(password, 10);
    const [newSubAdmin] = await db.insert(adminUsers).values({
      name, email, username: username || null, phone,
      password: hashed,
      userType: 'sub_admin',
      permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions || []),
      isActive: isActive !== false,
    } as any).returning();
    const { password: _, ...safe } = newSubAdmin as any;
    res.status(201).json(safe);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: "رقم الهاتف أو البريد الإلكتروني مستخدم بالفعل" });
    }
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/sub-admins/:id", requirePermission('manage_admins'), async (req, res) => {
  try {
    const { name, phone, password, permissions, isActive } = req.body;
    let { email, username } = req.body;
    const updateData: any = { name, phone, isActive };
    if (email !== undefined) updateData.email = email;
    if (username !== undefined) updateData.username = username || null;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (permissions !== undefined) {
      updateData.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
    }
    const [updated] = await db.update(adminUsers).set(updateData).where(eq(adminUsers.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ error: "المشرف غير موجود" });
    const { password: _, ...safe } = updated as any;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/sub-admins/:id", requirePermission('manage_admins'), async (req, res) => {
  try {
    await db.delete(adminUsers).where(eq(adminUsers.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ===== Security Logging & Settings Routes =====

router.get("/security/settings", async (req, res) => {
  try {
    const allSettings = await storage.getUiSettings();
    const map = new Map(allSettings.map((s: any) => [s.key, s.value]));

    let customerApiKey = map.get('sec_customer_api_key');
    let driverApiKey = map.get('sec_driver_api_key');

    if (!customerApiKey) {
      customerApiKey = `sareeone_cust_app_key_${Math.random().toString(36).substring(2, 8)}${Date.now().toString(36)}`;
      await storage.updateUiSetting('sec_customer_api_key', customerApiKey);
    }
    if (!driverApiKey) {
      driverApiKey = `sareeone_driver_app_key_${Math.random().toString(36).substring(2, 8)}${Date.now().toString(36)}`;
      await storage.updateUiSetting('sec_driver_api_key', driverApiKey);
    }

    res.json({
      twoFactorEnabled: map.get('sec_two_factor') === 'true',
      sessionTimeout: parseInt(map.get('sec_session_timeout') || '60', 10),
      passwordComplexity: map.get('sec_password_complexity') || 'medium',
      ipWhitelist: map.get('sec_ip_whitelist') ? map.get('sec_ip_whitelist')!.split(',').filter(Boolean) : [],
      maxLoginAttempts: parseInt(map.get('sec_max_login_attempts') || '5', 10),
      forceSsl: map.get('sec_force_ssl') !== 'false',
      loginNotifications: map.get('sec_login_notifications') === 'true',
      customerApiKey,
      driverApiKey,
      lastAudit: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/security/regenerate-api-key", async (req, res) => {
  try {
    const { target } = req.body; // 'customer' | 'driver'
    const newKey = `sareeone_${target === 'driver' ? 'driver' : 'cust'}_app_key_${Math.random().toString(36).substring(2, 8)}${Date.now().toString(36)}`;
    const keyName = target === 'driver' ? 'sec_driver_api_key' : 'sec_customer_api_key';
    await storage.updateUiSetting(keyName, newKey);
    res.json({ success: true, key: newKey, target });
  } catch (error) {
    res.status(500).json({ error: "فشل إعادة إنشاء مفتاح API" });
  }
});

router.post("/security/settings", async (req, res) => {
  try {
    const { twoFactorEnabled, sessionTimeout, passwordComplexity, ipWhitelist, maxLoginAttempts, forceSsl, loginNotifications } = req.body;

    const settingsToSave = [
      { key: 'sec_two_factor', value: String(!!twoFactorEnabled) },
      { key: 'sec_session_timeout', value: String(sessionTimeout || 60) },
      { key: 'sec_password_complexity', value: passwordComplexity || 'medium' },
      { key: 'sec_ip_whitelist', value: Array.isArray(ipWhitelist) ? ipWhitelist.join(',') : (ipWhitelist || '') },
      { key: 'sec_max_login_attempts', value: String(maxLoginAttempts || 5) },
      { key: 'sec_force_ssl', value: String(forceSsl !== false) },
      { key: 'sec_login_notifications', value: String(!!loginNotifications) },
    ];

    for (const s of settingsToSave) {
      await storage.updateUiSetting(s.key, s.value);
    }

    res.json({ success: true, message: "تم حفظ إعدادات الأمان بنجاح" });
  } catch (error) {
    console.error("خطأ في حفظ إعدادات الأمان:", error);
    res.status(500).json({ error: "فشل حفظ إعدادات الأمان" });
  }
});

router.post("/security/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword, adminId } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    }

    const targetAdminId = adminId || (req as any).user?.id;
    if (!targetAdminId) {
      return res.status(400).json({ error: "معرف المدير غير محدد" });
    }

    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, targetAdminId)).limit(1);
    if (!admin) {
      return res.status(404).json({ error: "حساب المدير غير موجود" });
    }

    // التحديث المباشر لكلمة المرور
    await db.update(adminUsers)
      .set({ password: newPassword })
      .where(eq(adminUsers.id, targetAdminId));

    // تسجيل الحدث الأمني
    await db.insert(auditLogs).values({
      adminId: targetAdminId,
      action: 'password_change',
      entityType: 'auth',
      entityId: targetAdminId,
      ipAddress: req.ip || 'unknown',
      oldData: JSON.stringify({ action: 'تغيير كلمة المرور' }),
      newData: JSON.stringify({ status: 'success' }),
    });

    res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("خطأ في تغيير كلمة المرور:", error);
    res.status(500).json({ error: "فشل تغيير كلمة المرور" });
  }
});

router.post("/security/clear-logs", async (req, res) => {
  try {
    await db.delete(auditLogs).where(sql`${auditLogs.entityType} = 'auth'`);
    res.json({ success: true, message: "تم مسح سجلات الوصول الأمني بنجاح" });
  } catch (error) {
    console.error("خطأ في مسح سجلات الأمان:", error);
    res.status(500).json({ error: "فشل مسح السجلات" });
  }
});

router.get("/security/logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await db
      .select({
        id: auditLogs.id,
        adminId: auditLogs.adminId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
      })
      .from(auditLogs)
      .where(sql`${auditLogs.entityType} = 'auth'`)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    const adminIds = [...new Set(logs.map(l => l.adminId))];
    let adminMap: Record<string, string> = {};
    if (adminIds.length > 0) {
      const admins = await db.select({ id: adminUsers.id, name: adminUsers.name }).from(adminUsers).where(inArray(adminUsers.id, adminIds));
      admins.forEach(a => { adminMap[a.id] = a.name; });
    }

    const formatted = logs.map(log => ({
      id: log.id,
      userId: log.adminId,
      userName: adminMap[log.adminId] || 'مدير النظام',
      action: log.action === 'login' ? 'تسجيل الدخول' : log.action === 'logout' ? 'تسجيل الخروج' : log.action === 'password_change' ? 'تغيير كلمة المرور' : log.action,
      ipAddress: log.ipAddress || '127.0.0.1',
      device: log.oldData ? (() => { try { return JSON.parse(log.oldData)?.device || 'متصفح الويب'; } catch { return 'متصفح الويب'; } })() : 'متصفح الويب',
      location: 'اليمن',
      createdAt: log.createdAt,
      status: (log.newData ? (() => { try { return JSON.parse(log.newData)?.status || 'success'; } catch { return 'success'; } })() : 'success') as 'success' | 'failure' | 'warning',
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/security/log-login", async (req, res) => {
  try {
    const { adminId, ipAddress, device } = req.body;
    if (!adminId) return res.status(400).json({ error: "معرف المدير مطلوب" });
    await db.insert(auditLogs).values({
      adminId,
      action: 'login',
      entityType: 'auth',
      entityId: adminId,
      ipAddress: ipAddress || req.ip || 'unknown',
      oldData: JSON.stringify({ device: device || req.headers['user-agent'] || 'غير معروف' }),
      newData: JSON.stringify({ status: 'success' }),
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/security/log-logout", async (req, res) => {
  try {
    const { userId, userName } = req.body;
    if (!userId) return res.status(400).json({ error: "معرف المستخدم مطلوب" });
    // التحقق من وجود المدير أولاً
    const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);
    if (!admin) return res.json({ success: true }); // تجاهل إذا لم يوجد
    await db.insert(auditLogs).values({
      adminId: userId,
      action: 'logout',
      entityType: 'auth',
      entityId: userId,
      ipAddress: req.ip || 'unknown',
      oldData: JSON.stringify({ device: req.headers['user-agent'] || 'غير معروف', name: userName }),
      newData: JSON.stringify({ status: 'success' }),
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export { router as adminRoutes };

