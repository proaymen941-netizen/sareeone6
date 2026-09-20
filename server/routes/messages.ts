import express from "express";
import { storage } from "../storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";

const router = express.Router();

// Get messages for an order
router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const messages = await storage.getMessages(orderId);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Get conversation between two users
router.get("/conversation", async (req, res) => {
  try {
    const { userId1, userId2 } = req.query;
    
    if (!userId1 || !userId2) {
      return res.status(400).json({ message: "Missing user IDs" });
    }

    const messages = await storage.getAdminChatMessages(userId1 as string, 'customer'); // Simplified
    res.json(messages);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ message: "Failed to fetch conversation" });
  }
});

// Get admin chat messages
router.get("/admin-chat", async (req, res) => {
  try {
    const { userId, userType } = req.query;
    
    if (!userId || !userType) {
      return res.status(400).json({ message: "Missing user ID or type" });
    }

    const messages = await storage.getAdminChatMessages(userId as string, userType as string);
    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching admin chat:", error);
    res.status(500).json({ message: "Failed to fetch admin chat" });
  }
});

// Get admin conversations
router.get("/admin/conversations", async (req, res) => {
  try {
    const conversations = await storage.getAdminConversations();
    res.json({ success: true, conversations });
  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    res.status(500).json({ message: "Failed to fetch admin conversations" });
  }
});

// Send a new message
router.post("/", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      orderId: req.body.orderId || null,
      senderId: String(req.body.senderId || '').trim(),
      receiverId: String(req.body.receiverId || '').trim(),
      senderType: String(req.body.senderType || '').trim(),
      receiverType: String(req.body.receiverType || '').trim(),
      content: String(req.body.content || '').trim(),
    };

    const validatedData = insertMessageSchema.parse(payload);
    const message = await storage.createMessage(validatedData as any);
    
    // Broadcast via WebSocket if available
    const ws = (req as any).app?.get('ws');
    if (ws) {
      ws.broadcast('new_message', {
        messageId: message.id,
        orderId: message.orderId,
        senderId: message.senderId,
        senderType: message.senderType,
        receiverId: message.receiverId,
        receiverType: message.receiverType,
        content: message.content,
        createdAt: message.createdAt
      });
    }
    
    res.status(201).json(message);
  } catch (error) {
    console.error("Error creating message:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid message data", details: error.errors });
    }
    res.status(500).json({ message: "Failed to create message" });
  }
});

// Mark messages as read
router.put("/read", async (req, res) => {
  try {
    const { orderId, receiverId } = req.body;
    
    if (!orderId || !receiverId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await storage.markMessagesAsRead(orderId, receiverId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ message: "Failed to mark messages as read" });
  }
});

// Get unread message count
router.get("/unread/:userId/:userType", async (req, res) => {
  try {
    const { userId, userType } = req.params;
    
    // Get all messages and count unread
    const messages = await storage.getMessages("");
    const unread = messages.filter((m: any) => 
      m.receiverId === userId && 
      m.receiverType === userType && 
      !m.isRead
    );
    
    res.json({ count: unread.length });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

export default router;
