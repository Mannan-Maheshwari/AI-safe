import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });
export const errMsg = (e) => e?.response?.data?.error || e?.message || 'Something went wrong';
export default api;
