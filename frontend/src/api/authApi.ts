import axios, { AxiosError } from "axios";
import { UserCreate, User } from "../types/user";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

export const signUp = async (userInfo: UserCreate): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE}/auth/signup`, userInfo);
    return true;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Sign up error:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected sign up error:", error);
    }
    return false;
  }
};

export const sendEmailOTP = async (email: string): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE}/auth/email-otp`, { email });
    return true;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Send OTP error:", error.response?.data);
      alert(error.response?.data.detail);
    } else {
      console.error("Unexpected OTP send error:", error);
    }
    return false;
  }
};

export const verifyEmailOTP = async (
  email: string,
  otp: string
): Promise<User | boolean> => {
  try {
    const response = await axios.post(`${API_BASE}/auth/verify-email-otp`, {
      email,
      otp,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      alert(error.response?.data.detail);
      console.error("Verify OTP error:", error.response?.data);
    } else {
      console.error("Unexpected OTP verification error:", error);
    }
    return false;
  }
};

export const loginWithGoogle = async (token: string) => {
  const params = new URLSearchParams();
  params.append("token", token);

  try {
    const response = await axios.post(`${API_BASE}/auth/google`, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      withCredentials: true,
    });
    return response.data; // properly returning response data
  } catch (error) {
    if (error instanceof AxiosError) {
      alert(error.response?.data.detail);
      console.error("Login with Google failed:", error.response?.data);
    } else {
      console.error("Unexpected Google login error:", error);
    }
    return null;
  }
};
