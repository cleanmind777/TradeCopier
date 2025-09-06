import axios, { AxiosError } from "axios";
import { User, UserFilter } from "../types/user";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

export const getUsers = async (
  userFilter: UserFilter
): Promise<[User] | null> => {
  try {
    const response = await axios.post(`${API_BASE}/admin/users`, userFilter);
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

export const acceptUser = async (id: string): Promise<User[] | null> => {
  try {
    const params = {
      id: id,
    };
    const response = await axios.post(`${API_BASE}/admin/accept-user`, { id });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Accept user:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected accept user error:", error);
    }
    return null;
  }
};
