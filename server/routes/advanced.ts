// @ts-nocheck
import express from "express";
import { storage } from "../storage";
import { AdvancedDatabaseStorage } from "../db-advanced";
import { DatabaseStorage, db } from "../db";
import { adminUsers } from "@shared/schema";
import { z } from "zod";
import { coerceRequestData } from "../utils/coercion";

const router = express.Router();

export function registerAdvancedRoutes(app: express.Express) {
  const dbStorage = storage as any;
  const advancedDb = new AdvancedDatabaseStorage((storage as any).db);

  // ===================== DRIVER ROUTES =====================

  // Get driver details with wallet and earnings
  app.get("/api/admin/drivers/:driverId/details", async (req, res) => {
    try {
      const { driverId } = req.params;

      const driver = await dbStorage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ error: "Driver not found" });
      }

      const balance = await dbStorage.getDriverBalance(driverId);
      const wallet = balance ? {
        id: balance.id,
        driverId: balance.driverId,
        balance: balance.availableBalance,
        totalEarned: balance.totalBalance,
        updatedAt: balance.updatedAt
      } : null;
      
      const earnings = await advancedDb.getDriverEarningsStats(driverId);
      const reviews = await advancedDb.getDriverReviews(driverId);
      const stats = await advancedDb.getDriverPerformanceStats(driverId);

      res.json({
        driver,
        wallet,
        earnings,
        stats,
        reviews: reviews.slice(0, 10)
      });
    } catch (error) {
      console.error("Error fetching driver details:", error);
      res.status(500).json({ error: "Failed to fetch driver details" });
    }
  });

  // Get driver stats for advanced dashboard
  app.get("/api/admin/drivers/stats", async (req, res) => {
    try {
      const drivers = await dbStorage.getDrivers();
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const weekStart = new Date(new Date().setDate(now.getDate() - 7));
      const monthStart = new Date(new Date().setDate(now.getDate() - 30));

      const stats = await Promise.all(
        drivers.map(async (driver) => {
          const performance = await advancedDb.getDriverPerformanceStats(driver.id);
          const performanceToday = await advancedDb.getDriverPerformanceStats(driver.id, todayStart);
          const performanceWeekly = await advancedDb.getDriverPerformanceStats(driver.id, weekStart);
          const performanceMonthly = await advancedDb.getDriverPerformanceStats(driver.id, monthStart);
          
          const balance = await dbStorage.getDriverBalance(driver.id);
          const withdrawals = await advancedDb.getWithdrawalRequests(driver.id, 'driver');
          const reviews = await advancedDb.getDriverReviews(driver.id);
          const avgRating = reviews.length > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
            : 0;
            
          return {
            id: driver.id,
            name: driver.name,
            email: driver.email || `${driver.phone}@wasel.app`,
            phone: driver.phone,
            status: driver.isActive ? "active" : "inactive",
            rating: avgRating,
            totalOrders: performance.totalOrders,
            completedOrders: performance.completedOrders,
            cancelledOrders: performance.totalOrders - performance.completedOrders,
            totalEarnings: performance.totalEarnings,
            todayEarnings: performanceToday.totalEarnings,
            weeklyEarnings: performanceWeekly.totalEarnings,
            monthlyEarnings: performanceMonthly.totalEarnings,
            avgRating: avgRating,
            joinDate: driver.createdAt.toISOString(),
            lastActive: driver.updatedAt?.toISOString() || driver.createdAt.toISOString(),
            isVerified: true,
            vehicleType: driver.vehicleType || "دراجة نارية",
            vehicleNumber: driver.vehicleNumber || "غير مسجل",
            walletBalance: parseFloat(balance?.availableBalance?.toString() || "0"),
            withdrawalRequests: withdrawals.map(w => ({
              id: w.id,
              amount: parseFloat(w.amount.toString()),
              status: w.status,
              createdAt: w.createdAt.toISOString()
            })),
            performance: {
              acceptanceRate: performance.successRate,
              onTimeRate: 90, // Placeholder
              customerSatisfaction: avgRating * 20
            },
            documents: []
          };
        })
      );
      res.json(stats);
    } catch (error) {
      console.error("Error fetching drivers stats:", error);
      res.status(500).json({ error: "Failed to fetch driver stats" });
    }
  });

  // Get all drivers with summary
  app.get("/api/admin/drivers-summary", async (req, res) => {
    try {
      const drivers = await dbStorage.getDrivers();
      const summaries = await Promise.all(
        drivers.map(async (driver) => {
          const stats = await advancedDb.getDriverPerformanceStats(driver.id);
          const balance = await dbStorage.getDriverBalance(driver.id);
          const wallet = balance ? {
            balance: balance.availableBalance,
            totalEarned: balance.totalBalance
          } : { balance: 0, totalEarned: 0 };

          return {
            ...driver,
            stats,
            wallet
          };
        })
      );
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching drivers summary:", error);
      res.status(500).json({ error: "Failed to fetch drivers summary" });
    }
  });

  // Driver reviews
  app.get("/api/admin/drivers/:driverId/reviews", async (req, res) => {
    try {
      const { driverId } = req.params;
      const reviews = await advancedDb.getDriverReviews(driverId);
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      res.json({
        reviews,
        averageRating: avgRating.toFixed(2),
        totalReviews: reviews.length
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver reviews" });
    }
  });

  // ===================== RESTAURANT ROUTES =====================

  // Get restaurant details with financial data
  app.get("/api/admin/restaurants/:restaurantId/details", async (req, res) => {
    try {
      const { restaurantId } = req.params;

      const restaurant = await dbStorage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const wallet = await advancedDb.getRestaurantWallet(restaurantId);
      const stats = await advancedDb.getRestaurantPerformanceStats(restaurantId);

      res.json({
        restaurant,
        wallet,
        stats
      });
    } catch (error) {
      console.error("Error fetching restaurant details:", error);
      res.status(500).json({ error: "Failed to fetch restaurant details" });
    }
  });

  // Get all restaurants with financial summary
  app.get("/api/admin/restaurants-summary", async (req, res) => {
    try {
      const restaurants = await dbStorage.getRestaurants();
      const summaries = await Promise.all(
        restaurants.map(async (restaurant) => {
          const stats = await advancedDb.getRestaurantPerformanceStats(restaurant.id);
          const wallet = await advancedDb.getRestaurantWallet(restaurant.id);
          return {
            ...restaurant,
            stats,
            wallet: {
              balance: wallet?.balance || 0,
              totalEarned: wallet?.totalEarned || 0,
              totalCommission: wallet?.totalCommission || 0
            }
          };
        })
      );
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching restaurants summary:", error);
      res.status(500).json({ error: "Failed to fetch restaurants summary" });
    }
  });

  // Get restaurant stats for advanced dashboard
  app.get("/api/admin/restaurants/stats", async (req, res) => {
    try {
      const restaurants = await dbStorage.getRestaurants();
      const stats = await Promise.all(
        restaurants.map(async (restaurant) => {
          const performance = await advancedDb.getRestaurantPerformanceStats(restaurant.id);
          const wallet = await advancedDb.getRestaurantWallet(restaurant.id);
          
          return {
            id: restaurant.id,
            name: restaurant.name,
            ownerName: "صاحب المطعم", // Mock for now
            phone: restaurant.phone || "",
            email: "restaurant@example.com",
            address: restaurant.address || "",
            status: restaurant.isActive ? "active" : "inactive",
            rating: parseFloat(restaurant.rating || "0"),
            totalOrders: performance.totalOrders,
            completedOrders: performance.completedOrders,
            cancelledOrders: performance.totalOrders - performance.completedOrders,
            totalRevenue: performance.totalRevenue,
            commissionEarned: performance.totalCommission,
            pendingCommission: 0, // Calculated if needed
            todayRevenue: 0, // Needs date-specific stats
            weeklyRevenue: 0,
            monthlyRevenue: 0,
            avgOrderValue: performance.averageOrderValue,
            joinDate: restaurant.createdAt.toISOString(),
            walletBalance: parseFloat(wallet?.balance?.toString() || "0"),
            withdrawalRequests: [],
            performance: {
              orderCompletionRate: performance.totalOrders > 0 ? (performance.completedOrders / performance.totalOrders) * 100 : 0,
              customerSatisfaction: parseFloat(restaurant.rating || "0") * 20,
              averagePreparationTime: 25
            },
            businessHours: {
              opening: restaurant.openingTime || "08:00",
              closing: restaurant.closingTime || "23:00",
              days: (restaurant.workingDays || "0,1,2,3,4,5,6").split(",")
            }
          };
        })
      );
      res.json(stats);
    } catch (error) {
      console.error("Error fetching restaurants stats:", error);
      res.status(500).json({ error: "Failed to fetch restaurant stats" });
    }
  });

  // ===================== WALLET ROUTES =====================

  // Driver wallet operations
  app.post("/api/drivers/:driverId/wallet/add-balance", async (req, res) => {
    try {
      const { driverId } = req.params;
      const coercedData = coerceRequestData(req.body);
      const { amount, description } = coercedData;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // createDriverTransaction تستدعي updateDriverBalance داخلياً - لا نستدعيه مرتين
      await dbStorage.createDriverTransaction({
        driverId,
        amount: amount.toString(),
        type: 'bonus',
        description: description || "إضافة يدوية للرصيد"
      });

      const updatedBalance = await dbStorage.getDriverBalance(driverId);
      res.json({
        id: updatedBalance?.id,
        driverId: updatedBalance?.driverId,
        balance: updatedBalance?.availableBalance,
        totalEarned: updatedBalance?.totalBalance
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get driver wallet
  app.get("/api/drivers/:driverId/wallet", async (req, res) => {
    try {
      const { driverId } = req.params;
      const balance = await dbStorage.getDriverBalance(driverId);

      if (!balance) {
        return res.status(404).json({ error: "Balance not found" });
      }

      res.json({
        id: balance.id,
        driverId: balance.driverId,
        balance: balance.availableBalance,
        totalEarned: balance.totalBalance,
        updatedAt: balance.updatedAt
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });

  // ===================== WITHDRAWAL ROUTES =====================
  
  // Create withdrawal request
  app.post("/api/withdrawal-requests", async (req, res) => {
    try {
      const coercedData = coerceRequestData(req.body);
      const { entityType, entityId, amount, accountNumber, bankName, accountHolder, requestedBy } = coercedData;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const numericAmount = parseFloat(amount);

      // Check balance before creating request
      if (entityType === 'driver') {
        const balance = await dbStorage.getDriverBalance(entityId);
        const available = parseFloat(balance?.availableBalance?.toString() || "0");
        if (available < numericAmount) {
          return res.status(400).json({ error: "Insufficient balance" });
        }
      } else if (entityType === 'restaurant') {
        const wallet = await advancedDb.getRestaurantWallet(entityId);
        const balance = parseFloat(wallet?.balance?.toString() || "0");
        if (balance < numericAmount) {
          return res.status(400).json({ error: "Insufficient balance" });
        }
      }

      const request = await advancedDb.createWithdrawalRequest({
        entityType,
        entityId,
        amount: amount, // Keeping as string for schema if it expects string/decimal
        accountNumber,
        bankName,
        accountHolder,
        requestedBy,
        status: "pending"
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ error: "Failed to create withdrawal request" });
    }
  });

  // Approve withdrawal request
  app.post("/api/admin/withdrawal-requests/:requestId/approve", async (req, res) => {
    try {
      const { requestId } = req.params;
      const { approvedBy } = req.body;

      const request = await advancedDb.approveWithdrawalRequest(requestId, approvedBy);
      
      // Update wallet balance
      if (request.entityType === 'driver') {
        // createDriverTransaction تستدعي updateDriverBalance داخلياً - لا نستدعيه مرتين
        await dbStorage.createDriverTransaction({
          driverId: request.entityId,
          amount: request.amount.toString(),
          type: 'withdrawal',
          description: `سحب نقدي معتمد (طلب رقم ${request.id})`,
          referenceId: request.id
        });
      } else if (request.entityType === 'restaurant') {
        await advancedDb.deductRestaurantWalletBalance(
          request.entityId,
          parseFloat(request.amount.toString())
        );
      }

      res.json(request);
    } catch (error: any) {
      console.error("Error approving withdrawal:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reject withdrawal request
  app.post("/api/admin/withdrawal-requests/:requestId/reject", async (req, res) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      const request = await advancedDb.rejectWithdrawalRequest(requestId, reason);
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject withdrawal request" });
    }
  });

  // Get pending withdrawal requests
  app.get("/api/admin/withdrawal-requests/pending", async (req, res) => {
    try {
      const requests = await advancedDb.getPendingWithdrawalRequests();
      
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          let userName = "غير معروف";
          if (request.entityType === 'driver') {
            const driver = await dbStorage.getDriver(request.entityId);
            userName = driver?.name || "سائق غير معروف";
          } else if (request.entityType === 'restaurant') {
            const restaurant = await dbStorage.getRestaurant(request.entityId);
            userName = restaurant?.name || "مطعم غير معروف";
          }
          
          return {
            ...request,
            userName,
            userType: request.entityType,
            userId: request.entityId,
            requestedAt: request.createdAt,
            method: 'bank_transfer', // Default for now
            amount: parseFloat(request.amount.toString())
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching pending withdrawals:", error);
      res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });

  // ===================== SECURITY ROUTES =====================
  app.get("/api/admin/security/settings", async (req, res) => {
    try {
      res.json({
        twoFactorEnabled: false,
        sessionTimeout: 30,
        passwordComplexity: "medium",
        lastAudit: "2026-01-08"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch security settings" });
    }
  });

  app.get("/api/admin/security/logs", async (req, res) => {
    try {
      res.json([
        {
          id: "log_1",
          userName: "Admin",
          action: "دخول للنظام",
          ipAddress: "192.168.1.1",
          device: "Chrome / Windows",
          location: "صنعاء",
          status: "success",
          createdAt: new Date().toISOString()
        }
      ]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch security logs" });
    }
  });

  // ===================== AUDIT LOG ROUTES =====================

  // Get audit logs
  app.get("/api/admin/audit-logs", async (req, res) => {
    try {
      const { userId, entityType, action, startDate, endDate } = req.query;

      const logs = await advancedDb.getAuditLogs({
        userId: userId as string,
        entityType: entityType as string,
        action: action as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });

      // Fetch all admins to map names
      const allAdmins = await db.select().from(adminUsers).catch(() => []);
      const adminMap = Object.fromEntries(allAdmins.map((a: any) => [a.id, a.name]));

      const mappedLogs = logs.map(log => {
        let actionDesc = 'عملية';
        if (log.action.startsWith('create_')) actionDesc = 'إضافة';
        else if (log.action.startsWith('update_')) actionDesc = 'تحديث';
        else if (log.action.startsWith('delete_')) actionDesc = 'حذف';
        else if (log.action === 'login') actionDesc = 'تسجيل دخول';
        else actionDesc = log.action;
        
        let entityName = log.entityType;
        const eMap: Record<string, string> = {
          'categories': 'تصنيف',
          'restaurants': 'مطعم',
          'menu-items': 'عنصر قائمة',
          'users': 'مستخدم',
          'customers': 'عميل',
          'drivers': 'سائق',
          'sub-admins': 'مشرف',
          'orders': 'طلب',
          'special-offers': 'عرض خاص',
          'coupons': 'كوبون'
        };
        entityName = eMap[entityName] || entityName;

        return {
          id: log.id,
          createdAt: log.createdAt,
          userId: adminMap[log.adminId] || log.adminId || 'نظام',
          action: actionDesc,
          entityType: entityName,
          description: `قام بـ ${actionDesc} ${entityName}`,
          status: 'success'
        };
      });

      res.json(mappedLogs.slice(0, 100));
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Create audit log
  app.post("/api/audit-logs", async (req, res) => {
    try {
      const { action, entityType, entityId, userId, userType, description, changes } = req.body;

      const log = await advancedDb.createAuditLog({
        action,
        entityType,
        entityId,
        userId,
        userType,
        description,
        changes,
        status: "success"
      });

      res.json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to create audit log" });
    }
  });

  // ===================== COMMISSION ROUTES =====================

  // Get commission settings
  app.get("/api/admin/commission-settings", async (req, res) => {
    try {
      const defaultPercent = await advancedDb.getDefaultCommissionPercent();
      res.json({ defaultCommissionPercent: defaultPercent });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch commission settings" });
    }
  });

  // ===================== STATISTICS ROUTES =====================

  // Get driver performance over date range
  app.get("/api/admin/drivers/:driverId/performance", async (req, res) => {
    try {
      const { driverId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await advancedDb.getDriverPerformanceStats(
        driverId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch performance stats" });
    }
  });

  // Get restaurant performance over date range
  app.get("/api/admin/restaurants/:restaurantId/performance", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await advancedDb.getRestaurantPerformanceStats(
        restaurantId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch performance stats" });
    }
  });

  // Get driver work sessions
  app.get("/api/admin/drivers/:driverId/work-sessions", async (req, res) => {
    try {
      const { driverId } = req.params;
      const { startDate, endDate } = req.query;

      const sessions = await advancedDb.getDriverWorkSessions(
        driverId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work sessions" });
    }
  });

  // Driver withdrawal request endpoint (for driver app)
  app.post("/api/drivers/:driverId/withdrawal-request", async (req, res) => {
    try {
      const { driverId } = req.params;
      const { amount, accountNumber, bankName, accountHolder } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // Check driver balance
      const balance = await dbStorage.getDriverBalance(driverId);
      const available = parseFloat(balance?.availableBalance?.toString() || "0");
      
      if (available < parseFloat(amount)) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Create withdrawal request
      const request = await advancedDb.createWithdrawalRequest({
        entityType: "driver",
        entityId: driverId,
        amount: amount.toString(),
        accountNumber,
        bankName,
        accountHolder,
        requestedBy: driverId,
        status: "pending"
      });

      res.status(201).json({
        success: true,
        message: "تم تقديم طلب السحب بنجاح",
        request
      });
    } catch (error) {
      console.error("Error creating driver withdrawal request:", error);
      res.status(500).json({ error: "Failed to create withdrawal request" });
    }
  });

  // مسارات التحليلات المتقدمة الجديدة
  app.get("/api/admin/analytics/daily-revenue", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await advancedDb.getDailyRevenue(days);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily revenue" });
    }
  });

  app.get("/api/admin/analytics/customer-retention", async (req, res) => {
    try {
      const data = await advancedDb.getCustomerRetentionStats();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch retention stats" });
    }
  });

  app.get("/api/admin/analytics/top-areas", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const data = await advancedDb.getTopDeliveryAreas(limit);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top areas" });
    }
  });

  // مسارات التسويق الذكي
  app.get("/api/admin/marketing/inactive-users", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const users = await advancedDb.getInactiveUsers(days);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inactive users" });
    }
  });

  app.post("/api/admin/marketing/send-mass-notification", async (req, res) => {
    try {
      const { userIds, title, message, type = "offer" } = req.body;

      if (!userIds || !Array.isArray(userIds) || !title || !message) {
        return res.status(400).json({ error: "بيانات ناقصة" });
      }

      const results = await Promise.all(
        userIds.map(userId => 
          dbStorage.createNotification({
            type,
            title,
            message,
            recipientType: "customer",
            recipientId: userId,
            isRead: false
          })
        )
      );

      res.json({
        success: true,
        message: `تم إرسال ${results.length} إشعار بنجاح`,
        count: results.length
      });
    } catch (error) {
      console.error("Error sending mass notification:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  // Get all customers for WhatsApp / SMS marketing
  app.get("/api/admin/marketing/customers", async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const customers = allUsers.map(u => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        createdAt: u.createdAt,
      }));
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers for marketing:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Get all employees (adminUsers) for WhatsApp / SMS marketing
  app.get("/api/admin/marketing/employees", async (req, res) => {
    try {
      const allAdmins = await db.select().from(adminUsers).catch(() => []);
      const employees = allAdmins.map((a: any) => ({
        id: a.id,
        name: a.name,
        phone: a.phone || '',
        email: a.email,
        role: a.userType,
      })).filter((e: any) => e.phone);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees for marketing:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  // Get all drivers for WhatsApp / SMS marketing
  app.get("/api/admin/marketing/drivers", async (req, res) => {
    try {
      const allDrivers = await dbStorage.getDrivers().catch(() => []);
      const drivers = allDrivers.map((d: any) => ({
        id: d.id,
        name: d.name,
        phone: d.phone || '',
        email: d.email,
      })).filter((d: any) => d.phone);
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching drivers for marketing:", error);
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  // Send WhatsApp / SMS campaign log
  app.post("/api/admin/marketing/whatsapp-campaign", async (req, res) => {
    try {
      const { recipients, message, channel = 'whatsapp', method = 'manual' } = req.body;
      if (!recipients || !Array.isArray(recipients) || !message) {
        return res.status(400).json({ error: "بيانات الحملة غير مكتملة" });
      }

      if (method === 'server') {
        const settings = await (storage as any).getUiSettings();
        const getSetting = (k: string) => settings.find((s: any) => s.key === k)?.value;
        
        let successCount = 0;
        let failCount = 0;

        if (channel === 'whatsapp') {
          const waToken = getSetting('whatsapp_access_token');
          const waPhoneId = getSetting('whatsapp_phone_number_id');
          
          if (!waToken || !waPhoneId) {
            return res.status(400).json({ error: "يرجى إعداد رمز الوصول ومعرف الهاتف للواتساب في الإعدادات أولاً" });
          }

          for (const recipient of recipients) {
            try {
               let phone = recipient.phone.replace(/[^0-9]/g, '');
               if (phone.startsWith('00')) phone = phone.substring(2);
               
               const msgContent = message.replace(/{name}/g, recipient.name || 'عزيزنا');
               
               // Simulate Meta WhatsApp API call
               const waRes = await fetch(`https://graph.facebook.com/v17.0/${waPhoneId}/messages`, {
                 method: 'POST',
                 headers: {
                   'Authorization': `Bearer ${waToken}`,
                   'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({
                   messaging_product: "whatsapp",
                   to: phone,
                   type: "text",
                   text: { body: msgContent }
                 })
               });

               if (waRes.ok) {
                 successCount++;
               } else {
                 failCount++;
                 console.error("WhatsApp API Error:", await waRes.text());
               }
            } catch (err) {
               failCount++;
            }
          }
        } else if (channel === 'sms') {
          const smsGateway = getSetting('otp_sms_provider_url');

          if (!smsGateway) {
            return res.status(400).json({ error: "يرجى إعداد مزود SMS في إعدادات النظام أولاً" });
          }

          for (const recipient of recipients) {
             let phone = recipient.phone.replace(/[^0-9]/g, '');
             const msgContent = message.replace(/{name}/g, recipient.name || 'عزيزنا');
             
             // Simulate SMS Gateway call
             try {
                // If it's a GET request format in URL
                if (smsGateway.includes('{phone}') || smsGateway.includes('{msg}')) {
                   const finalUrl = smsGateway
                     .replace('{phone}', phone)
                     .replace('{msg}', encodeURIComponent(msgContent));
                   await fetch(finalUrl);
                }
                successCount++;
             } catch (err) {
                failCount++;
             }
          }
        }

        // Insert into audit logs
        try {
          await db.insert(auditLogs).values({
            adminId: req.admin?.id || '00000000-0000-0000-0000-000000000000',
            action: `send_mass_${channel}`,
            entityType: 'marketing',
            entityId: '00000000-0000-0000-0000-000000000000',
            newData: JSON.stringify({ successCount, failCount }),
            ipAddress: req.ip || 'unknown'
          });
        } catch (e) {}

        return res.json({
          success: true,
          message: `تم الإرسال التلقائي عبر الخادم. نجاح: ${successCount}، فشل: ${failCount}`,
          count: successCount
        });
      }

      // Log or process campaign dispatch (Manual)
      res.json({
        success: true,
        message: `تم فتح نوافذ الإرسال اليدوي لـ ${recipients.length} مستلم بنجاح`,
        count: recipients.length
      });
    } catch (error) {
      console.error("Error sending WhatsApp campaign:", error);
      res.status(500).json({ error: "Failed to send WhatsApp campaign" });
    }
  });
}
