// src/features/notificationTemplate/entities/model.ts

export type NotificationTemplate = {
  id: string;
  name: string;
  title: string;
  body: string;
  variables: any | null;
  category: 'system' | 'manual';
  createdAt: Date | null;
  updatedAt: Date | null;
};
