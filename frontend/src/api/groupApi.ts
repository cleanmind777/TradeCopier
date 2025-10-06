import axios, { AxiosError } from "axios";
import { GroupCreate, GroupInfo, GroupEdit } from "../types/group";
const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

export const createGroup = async (
  groupCreate: GroupCreate
): Promise<GroupInfo[]> => {
  try {
    const response = await axios.post(`${API_BASE}/group/create`, groupCreate);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Create Group:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected Create users error:", error);
    }
    return [];
  }
};

export const getGroup = async (userID: string): Promise<GroupInfo[]> => {
  const params = {
    user_id: userID,
  };
  try {
    const response = await axios.get(`${API_BASE}/group/get`, { params });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Get Group:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected Get users error:", error);
    }
    return [];
  }
};

export const editGroup = async (editGroup: GroupEdit): Promise<GroupInfo[]> => {
  try {
    const response = await axios.post(`${API_BASE}/group/edit`, editGroup);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Edit Group:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected Edit users error:", error);
    }
    return [];
  }
};

export const deleteGroup = async (groupID: string): Promise<GroupInfo[]> => {
  try {
    const response = await axios.delete(`${API_BASE}/group/delete`, {
      params: { group_id: groupID },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Delete Group:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected Delete users error:", error);
    }
    return [];
  }
};
