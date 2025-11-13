import axios from "axios";
import { UserContractCreate, UserContractInfo } from "../types/userContract";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

export const addUserContract = async (
  contractCreate: UserContractCreate
): Promise<UserContractInfo> => {
  try {
    const response = await axios.post<UserContractInfo>(
      `${API_BASE}/usercontract/add`,
      contractCreate
    );
    return response.data;
  } catch (error) {
    console.error("Error adding user contract:", error);
    throw error;
  }
};

export const getUserContracts = async (
  user_id: string
): Promise<UserContractInfo[]> => {
  try {
    const response = await axios.get<UserContractInfo[]>(
      `${API_BASE}/usercontract/get`,
      {
        params: { user_id },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error getting user contracts:", error);
    throw error;
  }
};

export const deleteUserContract = async (
  contract_id: string,
  user_id: string
): Promise<void> => {
  try {
    await axios.delete(`${API_BASE}/usercontract/delete`, {
      params: { contract_id, user_id },
    });
  } catch (error) {
    console.error("Error deleting user contract:", error);
    throw error;
  }
};

