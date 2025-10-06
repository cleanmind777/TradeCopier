import axios, { AxiosError } from "axios";
import { User, UserFilter } from "../types/user";
import {
  BrokerFilter,
  BrokerInfo,
  SubBrokerFilter,
  SubBrokerInfo,
  SubBrokerChange,
  BrokerChange,
  TradeDate,
  TradovateContractItemResponse,
  TradovateContractMaturityItemResponse,
  TradovateOrderListResponse,
  TradovatePositionListResponse,
  TradovateProductItemResponse,
  TradovateAccountsResponse,
  SubBrokerSummary,
  ExitPostion
} from "../types/broker";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

export const addBroker = async (
  userFilter: UserFilter
): Promise<[User] | null> => {
  try {
    const response = await axios.post(`${API_BASE}/broker/add`, userFilter);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Fetch users:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected fetch users error:", error);
    }
    return null;
  }
};

export const getBrokers = async (
  brokerFilter: BrokerFilter
): Promise<BrokerInfo[] | null> => {
  try {
    const response = await axios.post(`${API_BASE}/broker/get`, brokerFilter);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Get Brokers:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected fetch brokers error:", error);
    }
    return null;
  }
};
export const delBroker = async (
  id: string
): Promise<BrokerInfo[] | null> => {
  try {
    const response = await axios.delete(`${API_BASE}/broker/delete`, {
      params: { id },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Del Brokers:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected delete brokers error:", error);
    }
    return null;
  }
};
export const getSubBrokers = async (
  subBrokerFilter: SubBrokerFilter
): Promise<SubBrokerInfo[] | null> => {
  try {
    const response = await axios.post(
      `${API_BASE}/subbroker/get`,
      subBrokerFilter
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Get Brokers:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected fetch brokers error:", error);
    }
    return null;
  }
};

export const changeSubBrokerAccount = async (
  subBrokerChange: SubBrokerChange
): Promise<SubBrokerInfo[] | null> => {
  try {
    const response = await axios.post(
      `${API_BASE}/subbroker/change`,
      subBrokerChange
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Change SubBrokers:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected Change Sub brokers error:", error);
    }
    return null;
  }
};

export const changeBrokerAccount = async (
  brokerChange: BrokerChange
): Promise<SubBrokerInfo[] | null> => {
  try {
    const response = await axios.post(
      `${API_BASE}/broker/change`,
      brokerChange
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Change SubBrokers:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected Change Sub brokers error:", error);
    }
    return null;
  }
};

export const getPositions = async (
  user_id: string
): Promise<TradovatePositionListResponse[] | null> => {
  try {
    const params = { user_id };
    const response = await axios.get(
      `${API_BASE}/broker/positions`,
      { params }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Get Postions:", error.response?.data);
      alert(error.response?.data?.detail ?? "Unknown error");
    } else {
      console.error("Unexpected Get Postions error:", error);
    }
    return null;
  }
};

export const getOrders = async (
  user_id: string
): Promise<TradovateOrderListResponse[] | null> => {
  try {
    const params = { user_id };
    const response = await axios.get(
      `${API_BASE}/broker/orders`,
      { params }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Get Orders:", error.response?.data);
      alert(error.response?.data?.detail ?? "Unknown error");
    } else {
      console.error("Unexpected Get Orders error:", error);
    }
    return null;
  }
};

export const getAccounts = async (
  user_id: string
): Promise<TradovateAccountsResponse[] | null> => {
  try {
    const params = { user_id };
    const response = await axios.get(
      `${API_BASE}/broker/accounts`,
      { params }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Get Accounts:", error.response?.data);
      alert(error.response?.data?.detail ?? "Unknown error");
    } else {
      console.error("Unexpected Get Accounts error:", error);
    }
    return null;
  }
};

export const getSubBrokersForGroup = async (
  user_id: string
): Promise<SubBrokerSummary[] | null> => {
  try {
    const params = { user_id };
    const response = await axios.get(
      `${API_BASE}/subbroker/get-for-group`,
      { params }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Get SubBrokers:", error.response?.data);
      alert(error.response?.data?.detail ?? "Unknown error");
    } else {
      console.error("Unexpected Get SubBrokers error:", error);
    }
    return null;
  }
};

export const exitPostion = async (
  exitPostionData: ExitPostion
) => {
  try {
    const response = await axios.post(
      `${API_BASE}/broker/position/exit`,
      exitPostionData
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Exit Postion:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected exit position error:", error);
    }
    return null;
  }
};