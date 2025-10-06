import { SubBrokerSummary } from "./broker";

export interface GroupCreate {
  user_id: string;
  name: string;
  qty: number;
  sub_brokers: string[];
}

export interface GroupEdit {
  id: string;
  name: string;
  qty: number;
  sub_brokers: string[];
}

export interface GroupInfo {
    id: string;
    name: string;
    qty: number;
    sub_brokers: SubBrokerSummary[];
}