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
  live: number;
  paper: number;
  enable: number;
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

export interface SubBroker {
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
}

export interface SubBrokerSummary {
  id: string;
  nickname: string;
  sub_account_name: string;
  qty: number;
}

export interface SubBrokerSummaryForGet {
  id: string;
  nickname: string;
  sub_account_name: string;
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

export interface TradeDate {
  year: number;
  month: number;
  day: number;
}
export interface TradovatePositionListResponse {
  id: number;
  accountId: number;
  accountNickname: string;
  symbol: string;
  netPos: number;
  netPrice: number;
  bought: number;
  boughtValue: number;
  sold: number;
  soldValue: number;
  accountDisplayName: string;
}

export interface TradovateOrderListResponse {
  id: number;
  accountId: number;
  accountNickname: string;
  contractId: number;
  timestamp: Date;
  action: string;
  ordStatus: string;
  executionProviderId: number;
  archived: boolean;
  external: boolean;
  admin: boolean;
  symbol: string;
  price: number;
  accountDisplayName: string;
}

export interface TradovateProductItemResponse {
  id: number;
  name: string;
  currencyId: number;
  productType: string;
  description: string;
  exchangeId: number;
  exchangeChannelId: number;
  contractGroupId: number;
  riskDiscountContractGroupId: number;
  status: string;
  months: string;
  valuePerPoint: number;
  priceFormatType: string;
  priceFormat: number;
  tickSize: number;
  allowProviderContractInfo: boolean;
  isMicro: boolean;
  marketDataSource: string;
  lookupWeight: number;
  hasReplay: boolean;
  settlementMethod: string;
}

export interface TradovateContractMaturityItemResponse {
  id: number;
  productId: number;
  expirationMonth: number;
  expirationDate: Date;
  archived: boolean;
  seqNo: number;
  isFront: boolean;
}

export interface TradovateContractItemResponse {
  id: number;
  name: string;
  contractMaturityId: number;
  status: string;
  providerTickSize: number;
}

export interface TradovateAccountsResponse {
  id: number;
  accountId: number;
  accountNickname: string;
  timestamp: Date;
  currencyId: number;
  amount: number;
  realizedPnL: number;
  weekRealizedPnL: number;
  archived: boolean;
  amountSOD: number;
  accountDisplayName: string;
}

export interface ExitPostion {
  accountId: number;
  action: string;
  symbol: string;
  orderQty: number;
  orderType: string;
  isAutomated: boolean;
}

export interface SubBrokerForCreate {
  id: string;
  qty: number;
}