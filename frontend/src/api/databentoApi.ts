import axios, { AxiosError } from "axios";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface HistoricalCandle {
  timestamp: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalChartResponse {
  symbol: string;
  start: string;
  end: string;
  schema: string;
  count: number;
  data: HistoricalCandle[];
}

export const getHistoricalChart = async (
  symbol: string,
  start: string,
  end: string,
  schema: string = "ohlcv-1m"
): Promise<HistoricalChartResponse | null> => {
  try {
    const response = await axios.get(`${API_BASE}/databento/historical`, {
      params: { symbol, start, end, schema },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Get Historical Chart:", error.response?.data);
      alert(error.response?.data?.detail ?? "Unknown error");
    } else {
      console.error("Unexpected Get Historical Chart error:", error);
    }
    return null;
  }
};

export interface AvailableSymbolsResponse {
  futures: { symbol: string; name: string }[];
}

export const getAvailableSymbols = async (): Promise<AvailableSymbolsResponse | null> => {
  try {
    const response = await axios.get(`${API_BASE}/databento/symbols`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Get Symbols:", error.response?.data);
      alert(error.response?.data?.detail ?? "Unknown error");
    } else {
      console.error("Unexpected Get Symbols error:", error);
    }
    return null;
  }
};

