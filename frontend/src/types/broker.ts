export interface BrokerFilter {
  id?: string;
  user_id?: string;
  user_broker_id?: string;
  nickname?: string;
  type?: string;
  status?: boolean;
}

export interface BrokerInfo {
  id: string;
  user_id: string;
  user_broker_id: string;
  nickname: string;
  type: string;
  last_sync: Date;
  status: boolean;
}

export interface SubBrokerInfo {
  id: string;
  user_id: string;
  user_broker_id: string;
  sub_account_id: string;
  nickname: string;
  sub_account_name: string;
  type: string;
  account_type: string;
  last_sync: Date;
  is_demo: boolean;
  status: boolean;
  is_active: boolean;
  balance?: number;
}

export interface SubBrokerFilter {
  id?: string;
  user_id?: string;
  user_broker_id?: string;
  sub_account_id?: string;
  nickname?: string;
  sub_account_name?: string;
  type?: string;
  is_demo?: boolean;
  status?: boolean;
  is_active?: boolean;
}

export interface BrokerChange {
  id: string;
  nickname?: string;
  status?: boolean;
}

export interface SubBrokerChange {
  id: string;
  nickname?: string;
  is_active?: boolean;
}
