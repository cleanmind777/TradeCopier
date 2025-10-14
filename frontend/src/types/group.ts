import { SubBrokerSummary, SubBrokerForCreate } from "./broker";

export interface GroupCreate {
  user_id: string;
  name: string;
  sl: number;
  tp: number;
  sub_brokers: SubBrokerForCreate[];
}

export interface GroupEdit {
  id: string;
  name: string;
  sl: number;
  tp: number;
  sub_brokers: SubBrokerForCreate[];
}

export interface GroupInfo {
  id: string;
  name: string;
  sl: number;
  tp: number;
  sub_brokers: SubBrokerSummary[];
}
