import { Role } from '@prisma/client';

/** Har bir so'rovda guard tomonidan req.user ga yoziladigan foydalanuvchi */
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  studentProfile: {
    userId: string;
    groupId: string | null;
    isApproved: boolean;
    currentPoints: number;
  } | null;
}
