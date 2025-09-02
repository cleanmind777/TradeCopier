import axios from "axios";
import { UserCreate } from "../types/user";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

export const signUp = async (userInfo: UserCreate): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE}/auth/signup`, userInfo);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      alert(
        error.response?.data?.detail || "Sign up failed. Please try again."
      );
    } else {
      alert("An unexpected error occurred during sign up.");
    }
    return false;
  }
};

export const sendEmailOTP = async (email: string): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE}/auth/email-otp`, { email });
    return response.status === 200;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      alert(
        error.response?.data?.detail || "Failed to send OTP. Please try again."
      );
    } else {
      alert("An unexpected error occurred while sending OTP.");
    }
    return false;
  }
};

export const verifyEmailOTP = async (
  email: string,
  otp: string
): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE}/auth/verify-email-otp`, {
      email,
      otp,
    });
    return response.status === 200;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      alert(error.response?.data?.detail || "Invalid OTP. Please try again.");
    } else {
      alert("An unexpected error occurred while verifying OTP.");
    }
    return false;
  }
};

export const loginWithGoogle = async (tokenId: string) => {
  try {
    const response = await axios.post(`${API_BASE}/auth/google`, { tokenId });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      alert(
        error.response?.data?.detail || "Google login failed. Please try again."
      );
    } else {
      alert("An unexpected error occurred during Google login.");
    }
    return null;
  }
};
