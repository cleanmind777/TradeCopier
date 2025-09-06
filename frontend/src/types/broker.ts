export interface BrokerFilter {
  id?: string;
  user_id?: string;
  nickname?: string;
  type?: string;
  status?: boolean;
}

export interface BrokerInfo {
  id: string;
  user_id: string;
  nickname: string;
  type: string;
  last_sync: Date;
  status: boolean;
}
