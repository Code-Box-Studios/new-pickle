/**
 * Delivery seam. The in-app row is the store the notification center reads;
 * this channel is the "also send it somewhere" hook — dev-logged now, an email
 * (via the EmailSender seam) or push channel later, with no caller changes.
 */
export interface DeliverableNotification {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  bookingId?: string | null;
}

export interface NotificationDelivery {
  deliver(n: DeliverableNotification): Promise<void>;
}

export class DevLogDelivery implements NotificationDelivery {
  async deliver(n: DeliverableNotification): Promise<void> {
    console.log(`🔔 [notify] ${n.userId} · ${n.type} · ${n.title}`);
  }
}

export const notificationDelivery: NotificationDelivery = new DevLogDelivery();
