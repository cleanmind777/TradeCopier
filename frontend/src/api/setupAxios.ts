import axios from 'axios';

// Always send cookies (HttpOnly JWT) with requests to the backend
axios.defaults.withCredentials = true;

export {};


