import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface AuthenticatedRequest extends Request {
  driverId?: string;
  userType?: string;
}

/**
 * Middleware to require driver authentication
 * Extracts driverId from Bearer token
 */
export async function requireDriverAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح - الرجاء تسجيل الدخول'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Fetch driver from storage (works seamlessly in memory and database mode)
    const driver = await storage.getDriver(token);

    if (!driver) {
      return res.status(401).json({
        success: false,
        message: 'جلسة غير صالحة'
      });
    }

    if (!driver.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير مفعل'
      });
    }

    // Attach driver information to request
    req.driverId = driver.id;
    req.userType = 'driver';
    
    next();
  } catch (error) {
    console.error('Driver authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في المصادقة'
    });
  }
}
