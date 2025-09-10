import axios, { AxiosError } from "axios";
import { User, UserFilter } from "../types/user";
import {
  BrokerFilter,
  BrokerInfo,
  SubBrokerFilter,
  SubBrokerInfo,
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
