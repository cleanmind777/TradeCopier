import { SrvRecord } from "dns";

export interface UserCreate {
  email: string;
  name: string;
  avatar?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  admin_role: boolean;
  is_accepted: boolean;
  created_at: Date;
}

export interface UserFilter {
  id?: string;
  name?: string;
  email?: string;
  admin_role?: boolean;
  created_at?: Date;
  is_verified?: boolean;
  is_accepted?: boolean;
}
